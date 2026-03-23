package main

import (
	"crypto/rand"
	"encoding/binary"
	"sync"
	"time"
)

type Hub struct {
	conns       map[*Conn]bool
	clientsMu   sync.Mutex
	clients     map[uint32]*Client
	tanksMu     sync.RWMutex
	tanks       map[uint32]*Tank
	bulletIdsMu sync.Mutex
	bulletIds   map[uint32]bool

	register   chan *Conn
	unregister chan *Conn
	broadcast  chan []byte
}

func newHub() *Hub {
	return &Hub{
		conns:     make(map[*Conn]bool),
		clients:   make(map[uint32]*Client),
		tanks:     make(map[uint32]*Tank),
		bulletIds: make(map[uint32]bool),

		register:   make(chan *Conn),
		unregister: make(chan *Conn),
		broadcast:  make(chan []byte),
	}
}

func (h *Hub) run() {
	ticker := time.NewTicker(time.Millisecond * 50)
	quit := make(chan struct{})
	go func() {
		for {
			select {
			case <-ticker.C:
				h.sendStateUpdate()
			case <-quit:
				ticker.Stop()
				return
			}
		}
	}()

	for {
		select {
		case conn := <-h.register:
			h.conns[conn] = true
		case conn := <-h.unregister:
			if _, ok := h.conns[conn]; ok {
				delete(h.conns, conn)
				close(conn.send)
			}
		case message := <-h.broadcast:
			for conn := range h.conns {
				select {
				case conn.send <- message:
				default:
					close(conn.send)
					delete(h.conns, conn)
				}
			}
		}
	}
}

func (h *Hub) unusedClientId() uint32 {
	if len(h.clients) == 0xffff_ffff {
		panic("No more 32-bit client IDs (???)")
	}

	for {
		var idBuf [4]byte
		rand.Read(idBuf[:])
		id := binary.BigEndian.Uint32(idBuf[:])

		if id == 0 {
			continue
		}

		_, ok := h.clients[id]
		if !ok {
			return id
		}
	}
}

func (h *Hub) unusedTankId() uint32 {
	if len(h.tanks) == 0xffff_ffff {
		panic("No more 32-bit tank IDs (???)")
	}

	for {
		var idBuf [4]byte
		rand.Read(idBuf[:])
		id := binary.BigEndian.Uint32(idBuf[:])

		if id == 0 {
			continue
		}

		_, ok := h.tanks[id]
		if !ok {
			return id
		}
	}
}

func (h *Hub) unusedBulletId() uint32 {
	if len(h.bulletIds) == 0xffff_ffff {
		panic("No more 32-bit bullet IDs (???)")
	}

	for {
		var idBuf [4]byte
		rand.Read(idBuf[:])
		id := binary.BigEndian.Uint32(idBuf[:])

		if id == 0 {
			continue
		}

		_, ok := h.bulletIds[id]
		if !ok {
			return id
		}
	}
}

func (h *Hub) sendStateUpdate() {
	//buf := make([]byte, 0, len(h.playerIds)*36+8)

	//var nowBuf [8]byte
	//binary.BigEndian.PutUint64(nowBuf[:], uint64(time.Now().UnixMilli()))
	//buf = append(buf, nowBuf[2:]...)

	//for playerId, player := range h.playerIds {
	//	var idBuf [4]byte
	//	binary.BigEndian.PutUint32(idBuf[:], playerId)
	//	buf = append(buf, idBuf[:]...)

	//	var float32buf [4]byte
	//	binary.BigEndian.PutUint32(float32buf[:], math.Float32bits(player.position.x))
	//	buf = append(buf, float32buf[:]...)
	//	binary.BigEndian.PutUint32(float32buf[:], math.Float32bits(player.position.dx))
	//	buf = append(buf, float32buf[:]...)
	//	binary.BigEndian.PutUint32(float32buf[:], math.Float32bits(player.position.y))
	//	buf = append(buf, float32buf[:]...)
	//	binary.BigEndian.PutUint32(float32buf[:], math.Float32bits(player.position.dy))
	//	buf = append(buf, float32buf[:]...)

	//	var int16buf [2]byte
	//	binary.BigEndian.PutUint16(int16buf[:], uint16(player.position.dir))
	//	buf = append(buf, int16buf[:]...)
	//	binary.BigEndian.PutUint16(int16buf[:], uint16(player.position.ddir))
	//	buf = append(buf, int16buf[:]...)
	//	binary.BigEndian.PutUint16(int16buf[:], uint16(player.turretPosition.dir))
	//	buf = append(buf, int16buf[:]...)
	//	binary.BigEndian.PutUint16(int16buf[:], uint16(player.turretPosition.ddir))
	//	buf = append(buf, int16buf[:]...)

	//	binary.BigEndian.PutUint32(float32buf[:], math.Float32bits(player.hitPoints))
	//	buf = append(buf, float32buf[:]...)

	//	var updatedTimeBuf [4]byte
	//	binary.BigEndian.PutUint32(updatedTimeBuf[:], uint32(player.positionUpdatedTime.UnixMilli()))
	//	buf = append(buf, updatedTimeBuf[:]...)
	//}

	//h.broadcast <- buf
}
