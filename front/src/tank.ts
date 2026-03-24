export const TANK_LENGTH = 1;
export const TANK_WIDTH = 0.75;

export interface TankPosition {
    x: number;
    dx: number;
    y: number;
    dy: number;
    dir: number;
    ddir: number;
}

export interface TurretPosition {
    dir: number;
}

export enum TurretType {
    None = "none",
    Fixed = "fixed",
    Single = "single",
    Double = "double",
    Quad = "quad",
    Multi = "multi"
}

export interface VisibleTankCustomization {
    displayName: string;

    turretType: TurretType;
    
    damageCost: number;
    accuracyCost: number;
}

export interface TankCustomization extends VisibleTankCustomization {
    movementSpeedCost: number;
    movementSpeed: number;
    turningSpeedCost: number;
    turningSpeed: number;
    accelerationCost: number;
    acceleration: number;
    scopeCost: number;
    scope: number;

    armorCost: number;
    armor: number;
    crushingDamageCost: number;
    crushingDamage: number;
    shield: boolean;

    damage: number;
    cooldownCost: number;
    cooldown: number;
    accuracy: number;
    piercing: boolean;
    fullAuto: boolean;
}

export abstract class Tank {
    public abstract position: TankPosition;
    public abstract turretPosition: TurretPosition;
    public abstract lastShotTime?: Date;
    public abstract clientTimeLastUpdated: Date;
    public abstract customization: VisibleTankCustomization;

    public abstract getScaledHitPoints(): number;

    public getPredictedPositionAtClientTime(time: Date): TankPosition {
        const diff = (time.getTime() - this.clientTimeLastUpdated.getTime()) / 1000;

        return {
            x: this.position.x + this.position.dx * diff,
            dx: this.position.dx,
            y: this.position.y + this.position.dy * diff,
            dy: this.position.dy,
            dir: this.position.dir + this.position.ddir * diff,
            ddir: this.position.ddir
        };
    }

    public barrelLength() {
        return 0.25 + (this.customization.accuracyCost * 0.625 / 40);
    }

    public sideTurretOffset(): number {
        return 0.125 - this.customization.accuracyCost / 40 * 0.05;
    }

    public sideTurretBarrelLength(): number {
        return this.barrelLength() / 2;
    }
}