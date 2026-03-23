package main

import (
	"crypto/rand"
	"encoding/binary"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 512
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

type Conn struct {
	hub *Hub

	conn *websocket.Conn

	send chan []byte

	client *Client
}

func (c *Conn) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()
	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error { c.conn.SetReadDeadline(time.Now().Add(pongWait)); return nil })
	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("error: %v", err)
			}
			if e, ok := err.(*websocket.CloseError); ok {
				if e.Code == 1001 && c.client != nil {
					c.hub.clientsMu.Lock()
					delete(c.hub.clients, c.client.id)
					c.hub.clientsMu.Unlock()
				}
			}
			break
		}

		if len(message) != 0 {
			if message[0] == 'i' {
				if c.client != nil {
					c.conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(1008, ""))
					return
				}

				switch len(message) {
				case 1:
					var passBuf [4]byte
					rand.Read(passBuf[:])
					pass := binary.BigEndian.Uint32(passBuf[:])

					c.hub.clientsMu.Lock()
					client := &Client{
						hub: c.hub,

						id:   c.hub.unusedClientId(),
						pass: pass,

						tank: nil,
					}
					c.hub.clients[client.id] = client
					c.hub.clientsMu.Unlock()

					c.client = client
				case 9:
					id := binary.BigEndian.Uint32(message[1:5])
					pass := binary.BigEndian.Uint32(message[5:9])

					c.hub.clientsMu.Lock()
					client, ok := c.hub.clients[id]
					if !ok {
						c.conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(1008, ""))
						return
					}
					c.hub.clientsMu.Unlock()

					client.mu.Lock()
					if client.pass != pass {
						c.conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(1008, ""))
						return
					}

					var passBuf [4]byte
					rand.Read(passBuf[:])
					client.pass = binary.BigEndian.Uint32(passBuf[:])
					client.mu.Unlock()

					c.client = client
				default:
					c.conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(1008, ""))
					return
				}

				c.client.mu.Lock()
				reply := c.client.initialGameState()
				c.client.mu.Unlock()

				select {
				case c.send <- reply:
				default:
					return
				}

				// TODO: send 'I', plus 'C'/'S'
			} else {
				if c.client == nil {
					c.conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(1008, ""))
					return
				}

				c.client.mu.Lock()
				ok := c.client.parse(message[0], message[1:])
				if !ok {
					c.conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(1008, ""))
					return
				}
				defer c.client.mu.Unlock()
			}
		}
	}
}

func (c *Conn) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()
	for {
		select {
		case message, ok := <-c.send:
			log.Println(message, ok)
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// The hub closed the channel.
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.BinaryMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Add queued chat messages to the current websocket message.
			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func serveWs(hub *Hub, w http.ResponseWriter, r *http.Request) {
	upgrader.CheckOrigin = func(r *http.Request) bool {
		return true
	}
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}
	client := &Conn{
		hub: hub,

		conn:   conn,
		client: nil,

		send: make(chan []byte, 256),
	}
	client.hub.register <- client

	go client.writePump()
	go client.readPump()
}
