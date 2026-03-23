import { Tank, TankPosition, TurretPosition, VisibleTankCustomization } from "./tank";

export interface ServerSideTankUpdate {
    position: TankPosition;
    turretPosition: TurretPosition;
    clientTimeLastUpdated: Date;
    scaledHitPoints: number;
}

export class ServerSideTank extends Tank {
    public position: TankPosition;
    public turretPosition: TurretPosition;
    public lastShotTime?: Date;
    public clientTimeLastUpdated: Date;
    public customization: VisibleTankCustomization;

    public scaledHitPoints: number;

    constructor(serverSideUpdate: ServerSideTankUpdate, customization: VisibleTankCustomization) {
        super();

        this.position = serverSideUpdate.position;
        this.turretPosition = serverSideUpdate.turretPosition;
        this.clientTimeLastUpdated = serverSideUpdate.clientTimeLastUpdated;
        this.customization = customization;
        
        this.scaledHitPoints = serverSideUpdate.scaledHitPoints;
    }

    public getScaledHitPoints(): number {
        return this.scaledHitPoints;
    }

    public updateLastShotTime() {
        this.lastShotTime = new Date();
    }
}