import { CanvasManager } from "./canvasManager";
import { Controls } from "./controls";
import { Fixed } from "./fixed";
import { GameState, TPS } from "./gameState";
import { GameObject } from "./object";
import { Settings } from "./settings";
import { Tank, TankCustomization, TankPosition, TurretType } from "./tank";

//function rectRadiusAtAngle(width: number, height: number, angle: number): number {
//    return Math.min(
//        Math.abs((width / 2) / Math.cos(angle)),
//        Math.abs((height / 2) / Math.sin(-angle))
//    );
//}

function boxCorners(box: GameObject): [[number, number], [number, number], [number, number], [number, number]] {
    return [
        [
            box.x - Math.cos(box.rot) * box.width / 2 - Math.cos(box.rot + Math.PI / 2) * box.height / 2,
            box.y - Math.sin(box.rot) * box.width / 2 - Math.sin(box.rot + Math.PI / 2) * box.height / 2
        ],
        [
            box.x - Math.cos(box.rot) * box.width / 2 + Math.cos(box.rot + Math.PI / 2) * box.height / 2,
            box.y - Math.sin(box.rot) * box.width / 2 + Math.sin(box.rot + Math.PI / 2) * box.height / 2
        ],
        [
            box.x + Math.cos(box.rot) * box.width / 2 + Math.cos(box.rot + Math.PI / 2) * box.height / 2,
            box.y + Math.sin(box.rot) * box.width / 2 + Math.sin(box.rot + Math.PI / 2) * box.height / 2
        ],
        [
            box.x + Math.cos(box.rot) * box.width / 2 - Math.cos(box.rot + Math.PI / 2) * box.height / 2,
            box.y + Math.sin(box.rot) * box.width / 2 - Math.sin(box.rot + Math.PI / 2) * box.height / 2
        ]
    ];
}

const SNEAK_SCALE_INV = 4;
const SNEAK_TURN_SCALE_INV = 4;

export class PlayerTank extends Tank {
    private controls: Controls;
    private settings: Settings;
    private state: GameState;

    public id: string;

    public position: TankPosition;
    public turretDir: Fixed;
    public lastShotTime?: Date;
    public clientTimeLastUpdated: Date;
    public customization: TankCustomization;

    private hitPoints: number;
    private lastSideTurretShotTime?: Date;

    constructor(canvasMgr: CanvasManager, settings: Settings, state: GameState, id: string, initialPosition: TankPosition, initialHitPoints: number, customization: TankCustomization) {
        super();

        this.controls = new Controls(canvasMgr);
        this.settings = settings;
        this.state = state;

        this.id = id;

        this.position = initialPosition;
        this.turretDir = Fixed.fromNumber(this.controls.pointingDir() ?? Math.atan2(-initialPosition.y.toNumber(), -initialPosition.x.toNumber()));
        this.clientTimeLastUpdated = new Date();
        this.customization = customization;

        this.hitPoints = initialHitPoints;

        this.controls.onMouseMove((pointingDir: number | null) => {
            if (!this.settings.rotateFov) {
                this.turretDir = Fixed.fromNumber(pointingDir ?? 0);
            } else {
                this.turretDir = Fixed.fromNumber((pointingDir ?? 0) - (Math.PI * 3/2 - this.position.dir.toNumber()));
            }
        });

        this.controls.onBindNowDown("shoot", () => {
            if (this.canShoot()) {
                this.shoot();
            } else if (this.canShootSideTurrets()) {
                this.shootSideTurrets();
            }
        });
    }

    public getScaledHitPoints(): number {
        return this.hitPoints / (10 + this.customization.armor);
    }

    public tick() {
        const now = new Date();

        const forwardIsDown = this.controls.isBindDown("forward");
        const backwardIsDown = this.controls.isBindDown("backward");

        const zoomIsDown = this.controls.isBindDown("zoom");

        const dposHypot = this.position.dx.sq().add(this.position.dy.sq()).sqrt();

        const tickAccel = this.customization.acceleration.invScale(TPS);

        if (dposHypot.lt(tickAccel)) {
            this.position.dx = Fixed.zero();
            this.position.dy = Fixed.zero();
        } else {
            this.position.dx.addAssignClamped(this.position.dx.div(dposHypot).mul(tickAccel));
            this.position.dy.addAssignClamped(this.position.dy.div(dposHypot).mul(tickAccel));
        }

        //for (const [_, object] of this.state.objects) { // TODO: optimize with subgrids
        //    //const dir = Math.atan2(object.y - this.position.y, object.x - this.position.x);

        //    //const tankRectRadius = rectRadiusAtAngle(1, 0.875, dir - this.position.dir);
        //    //const objectRectRadius = rectRadiusAtAngle(object.width, object.height, (dir + Math.PI) - object.rot);

        //    //if (Math.hypot(object.x - this.position.x, object.y - this.position.y) < tankRectRadius + objectRectRadius) {
        //    //    this.position.dx -= Math.cos(dir) * diff * 100;
        //    //    this.position.dy -= Math.sin(dir) * diff * 100;
        //    //}

        //    const objectCorners = boxCorners(object);
        //    const tankCorners = boxCorners({
        //        x: this.position.x,
        //        y: this.position.y,
        //        width: 1,
        //        height: 0.875,
        //        rot: this.position.dir
        //    });

        //    const tankCornerCollisions: (null | { oproj: number, dir: number })[] = [null, null, null, null];

        //    for (let i = 0; i < 4; i++) {
        //        const c0 = objectCorners[i];
        //        const c1 = objectCorners[(i+1) % 4];
        //        const c2 = objectCorners[(i+2) % 4];

        //        const b = [c1[0] - c0[0], c1[1] - c0[1]];
        //        const bHypot2 = (b[0] * b[0] + b[1] * b[1]);

        //        const otherHypot = Math.hypot(c1[0] - c2[0], c1[1] - c2[1]);

        //        for (let j = 0; j < 4; j++) {
        //            const tankCorner = tankCorners[j];

        //            const a = [tankCorner[0] - c0[0], tankCorner[1] - c0[1]];

        //            const proj = (a[0] * b[0] + a[1] * b[1]) / bHypot2;

        //            if (proj < 0 || proj > 1) continue;

        //            const oproj = ((a[0] - b[0] * proj) * -b[1] + (a[1] - b[1] * proj) * b[0]) / Math.sqrt(bHypot2);

        //            if (oproj < -otherHypot || oproj > 0) continue;

        //            if (tankCornerCollisions[j] === null || tankCornerCollisions[j]!.oproj < oproj) {
        //                tankCornerCollisions[j] = {
        //                    oproj,
        //                    dir: Math.atan2(c1[1] - c2[1], c1[0] - c2[0])
        //                };
        //            }
        //        }
        //    }

        //    for (const collision of tankCornerCollisions) {
        //        if (collision !== null) {
        //            const impactDecel = Math.cos(collision.dir) * this.position.dx + Math.sin(collision.dir) * this.position.dy;

        //            if (impactDecel < 0) {
        //                this.position.dx -= Math.cos(collision.dir) * impactDecel;
        //                this.position.dy -= Math.sin(collision.dir) * impactDecel;
        //            }

        //            this.position.dx += Math.cos(collision.dir) * 10 * (1 - collision.oproj * 10) * diff;
        //            this.position.dy += Math.sin(collision.dir) * 10 * (1 - collision.oproj * 10) * diff;
        //        }
        //    }
        //}

        const speed = this.position.dx.mul(this.position.dir.cos()).add(this.position.dy.mul(this.position.dir.sin())).scale(Number(forwardIsDown) - Number(backwardIsDown));
        const maxAccel = this.customization.movementSpeed.invScale(zoomIsDown ? SNEAK_SCALE_INV : 1).sub(speed).clampLower(Fixed.zero());

        const accel = this.customization.acceleration.scale(2).invScale(TPS).clampUpper(maxAccel);

        this.position.dx.addAssignClamped(this.position.dir.cos().mul(accel).scale(Number(forwardIsDown) - Number(backwardIsDown)));
        this.position.dy.addAssignClamped(this.position.dir.sin().mul(accel).scale(Number(forwardIsDown) - Number(backwardIsDown)));

        this.position.x.addAssignClamped(this.position.dx.invScale(TPS));
        this.position.y.addAssignClamped(this.position.dy.invScale(TPS));

        const turnLeftIsDown = this.controls.isBindDown("turn_left");
        const turnRightIsDown = this.controls.isBindDown("turn_right");

        const dirChange = this.customization.turningSpeed.invScale(zoomIsDown ? SNEAK_TURN_SCALE_INV : 1).invScale(TPS);

        if (turnLeftIsDown && !turnRightIsDown) {
            this.position.dir.subAssignAngle(dirChange);
        } else if (turnRightIsDown && !turnLeftIsDown) {
            this.position.dir.addAssignAngle(dirChange);
        } else if (this.controls.isBindDown("turn_compass")) {
            const targDir = Math.round(this.position.dir / (Math.PI / 2)) * (Math.PI / 2);

            if (Math.abs(targetDir - this.position.dir) < turnDiff) {
                this.position.dir = targetDir;
            } else {
                this.position.dir += turnDiff * Math.sign(targetDir - this.position.dir);
            }
        }

        if (this.settings.rotateFov && turnLeftIsDown != turnRightIsDown) {
            this.turretDir = (this.controls.pointingDir() ?? 0) - (Math.PI * 3/2 - this.position.dir);
        }

        this.clientTimeLastUpdated = now;

        const shootIsDown = this.controls.isBindDown("shoot");

        if (shootIsDown) {
            if (this.canShootBindDown()) {
                this.shoot();
            } else if (this.canShootSideTurretsBindDown()) {
                this.shootSideTurrets();
            }
        }
    }

    public manualCooldown(): number {
        return this.customization.cooldown * (this.customization.fullAuto ? 0.9 : 1);
    }

    private canShoot(): boolean {
        if (this.customization.turretType == TurretType.None) return false;

        return this.lastShotTime === undefined || (new Date().getTime() - this.lastShotTime.getTime()) / 1000 >= this.manualCooldown();
    }

    private canShootBindDown(): boolean {
        if (this.customization.turretType == TurretType.None) return false;
        if (!(this.customization.fullAuto || this.customization.turretType == TurretType.Multi)) return false;

        return this.lastShotTime === undefined || (new Date().getTime() - this.lastShotTime.getTime()) / 1000 >= this.manualCooldown() * 1.5;
    }

    private canShootSideTurrets(): boolean {
        if (this.customization.turretType != TurretType.Multi) return false;

        return this.lastSideTurretShotTime === undefined || (new Date().getTime() - this.lastSideTurretShotTime.getTime()) / 1000 >= this.manualCooldown() / 2;
    }

    private canShootSideTurretsBindDown(): boolean {
        if (this.customization.turretType != TurretType.Multi) return false;

        return this.lastSideTurretShotTime === undefined || (new Date().getTime() - this.lastSideTurretShotTime.getTime()) / 1000 >= this.manualCooldown() / 2 * 1.5;
    }

    private shoot() {
        const recoilAccel = 0.0375 + 0.625 * this.customization.damageCost / 100 * Math.sqrt(this.customization.acceleration);

        switch (this.customization.turretType) {
            case TurretType.Fixed:
                this.shootInDir(this.position.dir);
                this.position.dx -= Math.cos(this.position.dir) * recoilAccel;
                this.position.dy -= Math.sin(this.position.dir) * recoilAccel;
                break;
            case TurretType.Single:
                this.shootInDir(this.turretDir);
                this.position.dx -= Math.cos(this.turretDir) * recoilAccel;
                this.position.dy -= Math.sin(this.turretDir) * recoilAccel;
                break;
            case TurretType.Double:
                this.shootInDir(this.turretDir);
                this.shootInDir(this.turretDir + Math.PI);
                break;
            case TurretType.Quad:
                this.shootInDir(this.turretDir);
                this.shootInDir(this.turretDir + Math.PI / 2);
                this.shootInDir(this.turretDir + Math.PI);
                this.shootInDir(this.turretDir + Math.PI * 3/2);
                break;
            case TurretType.Multi:
                this.shootInDir(this.turretDir);
                this.shootSideTurrets();
                this.position.dx -= Math.cos(this.turretDir) * recoilAccel;
                this.position.dy -= Math.sin(this.turretDir) * recoilAccel;
                break;
        }

        this.lastShotTime = new Date();
    }

    private shootSideTurrets() {
        const sideBarrelLength = this.sideTurretBarrelLength();
        const sideBarrelBulletOffset = this.sideTurretOffset() / 2 + 0.1;

        this.shootInDir(this.turretDir, sideBarrelLength, this.customization.accuracy / 2, 1/2, -sideBarrelBulletOffset);
        this.shootInDir(this.turretDir, sideBarrelLength, this.customization.accuracy / 2, 1/2, sideBarrelBulletOffset);

        this.lastSideTurretShotTime = new Date();
    }

    private normRandomDirOffset(accuracyInRadians: number) {
        function normRandomOffset(std: number) {
            const u = 1 - Math.random();
            const v = Math.random();
            const z = Math.sqrt(Math.log(u) * -2) * Math.cos(v * Math.PI * 2);

            return z * std;
        }

        if (accuracyInRadians < 1e-10) {
            return 0;
        }

        let offset;

        do {
            offset = normRandomOffset(accuracyInRadians / 2);
        } while (Math.abs(offset) > accuracyInRadians * 2.5);

        return offset;
    }

    private shootInDir(dir: number, barrelLength: number = this.barrelLength(), accuracy: number = this.customization.accuracy, size: number = 1, offset: number = 0) {
        this.state.clientSideBullets.set(this.state.clientSideBulletCounter++ % 65536, {
            initX: this.position.x + Math.cos(dir + Math.PI / 2) * offset + Math.cos(dir) * (barrelLength + 0.25),
            initY: this.position.y + Math.sin(dir + Math.PI / 2) * offset + Math.sin(dir) * (barrelLength + 0.25),
            dir: dir + this.normRandomDirOffset(accuracy / 180 * Math.PI),
            size,
            shotTime: new Date(),
            fadeStartTime: new Date(),
            ownerTankId: this.id
        });
    }

    public close() {
        this.controls.close();
    }
}