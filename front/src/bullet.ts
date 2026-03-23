export interface Bullet {
    initX: number;
    initY: number;
    dir: number;
    size: number;
    fadeStartTime: Date;
    ownerTankId: string;
}