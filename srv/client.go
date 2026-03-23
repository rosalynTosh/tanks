package main

import (
	"bytes"
	"encoding/binary"
	"math"
	"sync"
	"time"
	"unicode/utf8"
)

type Client struct {
	mu sync.Mutex

	hub *Hub

	id   uint32
	pass uint32

	tank *Tank
}

func (c *Client) parseTankCustomization(buf []byte) (*Tank, bool) {
	p := bytes.NewBuffer(buf)

	displayNameSize, err := p.ReadByte()

	if err != nil || displayNameSize < 2 || displayNameSize >= 128 {
		return nil, false
	}

	displayNameBytes := make([]byte, 0, displayNameSize)

	n, err := p.Read(displayNameBytes)

	if err != nil || n != int(displayNameSize) || !utf8.Valid(displayNameBytes) { // TODO: grapheme count
		return nil, false
	}

	displayName := string(displayNameBytes)

	if p.Len() != 0 {
		return nil, false
	}

	c.hub.tanksMu.Lock()
	tank := &Tank{
		id:          c.hub.unusedTankId(),
		displayName: displayName,

		position: TankPosition{ // TODO
			x:    0,
			dx:   0,
			y:    0,
			dy:   0,
			dir:  0,
			ddir: 0,
		},
		turretPosition: TurretPosition{
			dir: 0,
		},
		hitPoints:           100, // TODO
		positionUpdatedTime: time.Now(),
	}
	c.hub.tanks[tank.id] = tank
	c.hub.tanksMu.Unlock()

	return tank, true
}

func (c *Client) parseTankPosition(buf []byte) (*TankPosition, *TurretPosition, bool) {
	if len(buf) != 22 {
		return nil, nil, false
	}

	return &TankPosition{
			x:    math.Float32frombits(binary.BigEndian.Uint32(buf[0:4])),
			dx:   math.Float32frombits(binary.BigEndian.Uint32(buf[4:8])),
			y:    math.Float32frombits(binary.BigEndian.Uint32(buf[8:12])),
			dy:   math.Float32frombits(binary.BigEndian.Uint32(buf[12:16])),
			dir:  int16(binary.BigEndian.Uint16(buf[16:18])),
			ddir: int16(binary.BigEndian.Uint16(buf[18:20])),
		}, &TurretPosition{
			dir: int16(binary.BigEndian.Uint16(buf[20:22])),
		}, true
}

func (c *Client) parseBullet(buf []byte) (*Bullet, uint16, bool) {
	if len(buf) != 14 {
		return nil, 0, false
	}

	return &Bullet{
		initX:       math.Float32frombits(binary.BigEndian.Uint32(buf[2:6])),
		initY:       math.Float32frombits(binary.BigEndian.Uint32(buf[6:10])),
		dir:         math.Float32frombits(binary.BigEndian.Uint32(buf[10:14])),
		ownerTankId: c.tank.id,
	}, binary.BigEndian.Uint16(buf[0:2]), true
}

func (c *Client) parse(typeCode byte, buf []byte) bool {
	switch typeCode {
	case 's':
		if c.tank != nil {
			return false
		}

		tank, ok := c.parseTankCustomization(buf)
		if !ok {
			return false
		}
		c.tank = tank

		// TODO: send 'S', 'N'

		return true
	case 'p':
		if c.tank == nil {
			return false
		}

		position, turretPosition, ok := c.parseTankPosition(buf[1:])
		if !ok {
			return false
		}

		c.tank.mu.Lock()
		c.tank.position = *position
		c.tank.turretPosition = *turretPosition
		c.tank.mu.Unlock()

		return true
	case 'b':
		if c.tank == nil {
			return false
		}

		bullet, clientSideId, ok := c.parseBullet(buf)
		if !ok {
			return false
		}

		// TODO: send 'B'

		return true
	default:
		return false
	}
}

func (c *Client) initialGameState() []byte {
	timestamp := time.Now().UnixMilli()

	buf := make([]byte, 15)
	buf[0] = 'I'

	binary.BigEndian.PutUint32(buf[1:5], c.id)
	binary.BigEndian.PutUint32(buf[5:9], c.pass)

	binary.BigEndian.PutUint32(buf[9:13], uint32(timestamp>>16))
	binary.BigEndian.PutUint16(buf[13:15], uint16(timestamp))

	c.hub.tanksMu.RLock()
	for _, tank := range c.hub.tanks {
		binary.BigEndian.AppendUint32(buf, tank.id)
		buf = append(buf, uint8(len(tank.displayName)))
		buf = append(buf, []byte(tank.displayName)...)
		binary.BigEndian.AppendUint32(buf, math.Float32bits(tank.position.x))
		binary.BigEndian.AppendUint32(buf, math.Float32bits(tank.position.dx))
		binary.BigEndian.AppendUint32(buf, math.Float32bits(tank.position.y))
		binary.BigEndian.AppendUint32(buf, math.Float32bits(tank.position.dy))
		binary.BigEndian.AppendUint16(buf, uint16(tank.position.dir))
		binary.BigEndian.AppendUint16(buf, uint16(tank.position.ddir))
		binary.BigEndian.AppendUint16(buf, uint16(tank.turretPosition.dir))
		binary.BigEndian.AppendUint16(buf, uint16(math.Round(float64(tank.hitPoints)/100*65535))) // TODO
		updatedTimestamp := tank.positionUpdatedTime.UnixMilli()
		binary.BigEndian.AppendUint32(buf, uint32(updatedTimestamp>>16))
		binary.BigEndian.AppendUint16(buf, uint16(updatedTimestamp))
	}
	c.hub.tanksMu.RUnlock()

	buf = append(buf, 0) // TODO: bullets
	buf = append(buf, 0) // TODO: objects

	return buf
}
