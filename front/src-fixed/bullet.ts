export interface Bullet {
    initX: number;
    initY: number;
    dir: number;
    size: number;
    shotTime: Date;
    fadeStartTime: Date;
    ownerTankId: string;
}