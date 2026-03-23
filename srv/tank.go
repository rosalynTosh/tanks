package main

import (
	"sync"
	"time"
)

type TankPosition struct {
	x    float32
	dx   float32
	y    float32
	dy   float32
	dir  int16
	ddir int16
}

type TurretPosition struct {
	dir int16
}

type Tank struct {
	mu sync.RWMutex

	id          uint32
	displayName string

	position            TankPosition
	turretPosition      TurretPosition
	hitPoints           float32
	positionUpdatedTime time.Time
}
