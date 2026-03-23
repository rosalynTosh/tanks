import { CanvasManager } from "./canvasManager";
import { Controls } from "./controls";
import { GameState } from "./gameState";
import { GameObject } from "./object";
import { Settings } from "./settings";
import { Tank, TANK_LENGTH, TANK_WIDTH, TankCustomization, TankPosition, TurretPosition, TurretType } from "./tank";

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

const SNEAK_MULTIPLIER = 0.25;
const SNEAK_TURN_MULTIPLIER = 0.25;

export class PlayerTank extends Tank {
    private controls: Controls;
    private settings: Settings;
    private state: GameState;

    public id: string;

    public position: TankPosition;
    public turretPosition: TurretPosition;
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
        this.turretPosition = {
            dir: this.controls.pointingDir() ?? Math.atan2(-initialPosition.y, -initialPosition.x)
        };
        this.clientTimeLastUpdated = new Date();
        this.customization = customization;

        this.hitPoints = initialHitPoints;

        this.controls.onMouseMove((pointingDir: number | null) => {
            if (!this.settings.rotateFov) {
                this.turretPosition.dir = pointingDir ?? 0;
            } else {
                this.turretPosition.dir = (pointingDir ?? 0) - (Math.PI * 3/2 - this.position.dir);
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
        const diff = Math.min((now.getTime() - this.clientTimeLastUpdated.getTime()) / 1000, 0.25);

        const forwardIsDown = this.controls.isBindDown("forward");
        const backwardIsDown = this.controls.isBindDown("backward");

        const zoomIsDown = this.controls.isBindDown("zoom");

        const friction = Math.hypot(this.position.dx, this.position.dy);
        const frictionDir = Math.atan2(-this.position.dy, -this.position.dx);

        if (friction < this.customization.acceleration * diff) {
            this.position.dx = 0;
            this.position.dy = 0;
        } else {
            this.position.dx += Math.cos(frictionDir) * this.customization.acceleration * diff;
            this.position.dy += Math.sin(frictionDir) * this.customization.acceleration * diff;
        }

        const speed = Math.hypot(this.position.dx, this.position.dy);
        const speedDotProd = (this.position.dx * Math.cos(this.position.dir) + this.position.dy * Math.sin(this.position.dir)) * (Number(forwardIsDown) - Number(backwardIsDown));
        const maxAccel = Math.max(this.customization.movementSpeed * (zoomIsDown ? SNEAK_MULTIPLIER : 1) - (speed * Math.sign(speedDotProd)), 0);

        this.position.dx += Math.cos(this.position.dir) * Math.min(this.customization.acceleration * 2 * diff, maxAccel) * (Number(forwardIsDown) - Number(backwardIsDown));
        this.position.dy += Math.sin(this.position.dir) * Math.min(this.customization.acceleration * 2 * diff, maxAccel) * (Number(forwardIsDown) - Number(backwardIsDown));

        const tankCorners = boxCorners({
            x: this.position.x,
            y: this.position.y,
            width: TANK_LENGTH,
            height: TANK_WIDTH,
            rot: this.position.dir
        });

        const collisionDirs: number[] = [];

        for (const [_, object] of this.state.objects) { // TODO: optimize with subgrids
            const objectCorners = boxCorners(object);

            for (let j = 0; j < 4; j++) {
                const tankCorner = tankCorners[j];

                let collision: null | { oproj: number, dir: number } = null;

                for (let i = 0; i < 4; i++) {
                    const c0 = objectCorners[i];
                    const c1 = objectCorners[(i+1) % 4];
                    const c2 = objectCorners[(i+2) % 4];

                    const b = [c1[0] - c0[0], c1[1] - c0[1]];
                    const bHypot2 = (b[0] * b[0] + b[1] * b[1]);

                    const otherHypot = Math.hypot(c1[0] - c2[0], c1[1] - c2[1]);

                    const a = [tankCorner[0] - c0[0], tankCorner[1] - c0[1]];

                    const proj = (a[0] * b[0] + a[1] * b[1]) / bHypot2;

                    if (proj < 0 || proj > 1) continue;

                    const oproj = ((a[0] - b[0] * proj) * -b[1] + (a[1] - b[1] * proj) * b[0]) / Math.sqrt(bHypot2);

                    if (oproj < -otherHypot || oproj > 0) continue;

                    if (collision === null || collision.oproj < oproj) {
                        collision = {
                            oproj,
                            dir: Math.atan2(c1[1] - c2[1], c1[0] - c2[0])
                        };
                    }
                }

                if (collision !== null) {
                    collisionDirs.push(collision.dir);

                    this.position.dx += Math.cos(collision.dir) * 10 * (1 - collision.oproj * 10) * diff;
                    this.position.dy += Math.sin(collision.dir) * 10 * (1 - collision.oproj * 10) * diff;
                }
            }
        }

        for (const [_, object] of this.state.objects) {
            for (let j = 0; j < 4; j++) {
                let collision: null | { oproj: number, dir: number } = null;

                for (let i = 0; i < 4; i++) {
                    const c0 = tankCorners[i];
                    const c1 = tankCorners[(i+1) % 4];
                    const c2 = tankCorners[(i+2) % 4];
        
                    const b = [c1[0] - c0[0], c1[1] - c0[1]];
                    const bHypot2 = (b[0] * b[0] + b[1] * b[1]);
        
                    const otherHypot = Math.hypot(c1[0] - c2[0], c1[1] - c2[1]);

                    const objectCorner = boxCorners(object)[j];
                    
                    const a = [objectCorner[0] - c0[0], objectCorner[1] - c0[1]];

                    const proj = (a[0] * b[0] + a[1] * b[1]) / bHypot2;

                    if (proj < 0 || proj > 1) continue;

                    const oproj = ((a[0] - b[0] * proj) * -b[1] + (a[1] - b[1] * proj) * b[0]) / Math.sqrt(bHypot2);

                    if (oproj < -otherHypot || oproj > 0) continue;

                    if (collision === null || collision.oproj < oproj) {
                        collision = {
                            oproj,
                            dir: object.rot + Math.PI * (5 - j * 2) / 4//Math.atan2(c1[1] - c2[1], c1[0] - c2[0]);
                        };
                    }
                }

                if (collision !== null) {
                    collisionDirs.push(collision.dir);

                    this.position.dx += Math.cos(collision.dir) * 10 * (1 - collision.oproj * 10) * diff;
                    this.position.dy += Math.sin(collision.dir) * 10 * (1 - collision.oproj * 10) * diff;
                }
            }
        }

        for (const dir of collisionDirs) {
            const collisionDecel = Math.cos(dir) * this.position.dx + Math.sin(dir) * this.position.dy;

            if (collisionDecel < 0) {
                this.position.dx -= Math.cos(dir) * collisionDecel;
                this.position.dy -= Math.sin(dir) * collisionDecel;
            }
        }

        this.position.x += this.position.dx * diff;
        this.position.y += this.position.dy * diff;

        const turnLeftIsDown = this.controls.isBindDown("turn_left");
        const turnRightIsDown = this.controls.isBindDown("turn_right");

        if (turnLeftIsDown && !turnRightIsDown) {
            this.position.dir -= this.customization.turningSpeed * (zoomIsDown ? SNEAK_TURN_MULTIPLIER : 1) * diff;
        } else if (turnRightIsDown && !turnLeftIsDown) {
            this.position.dir += this.customization.turningSpeed * (zoomIsDown ? SNEAK_TURN_MULTIPLIER : 1) * diff;
        } else if (this.controls.isBindDown("turn_compass")) {
            const targetDir = Math.round(this.position.dir / (Math.PI / 2)) * (Math.PI / 2);
            const turnDiff = this.customization.turningSpeed * (zoomIsDown ? SNEAK_TURN_MULTIPLIER : 1) * diff;

            if (Math.abs(targetDir - this.position.dir) < turnDiff) {
                this.position.dir = targetDir;
            } else {
                this.position.dir += turnDiff * Math.sign(targetDir - this.position.dir);
            }
        }

        if (this.settings.rotateFov && turnLeftIsDown != turnRightIsDown) {
            this.turretPosition.dir = (this.controls.pointingDir() ?? 0) - (Math.PI * 3/2 - this.position.dir);
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
        if (!this.customization.fullAuto) return false;

        return this.lastShotTime === undefined || (new Date().getTime() - this.lastShotTime.getTime()) / 1000 >= this.manualCooldown() * 1.5;
    }

    private canShootSideTurrets(): boolean {
        if (this.customization.turretType != TurretType.Multi) return false;

        return this.lastSideTurretShotTime === undefined || (new Date().getTime() - this.lastSideTurretShotTime.getTime()) / 1000 >= this.manualCooldown() / 2;
    }

    private canShootSideTurretsBindDown(): boolean {
        if (this.customization.turretType != TurretType.Multi) return false;
        if (!this.customization.fullAuto) return false;

        return this.lastSideTurretShotTime === undefined || (new Date().getTime() - this.lastSideTurretShotTime.getTime()) / 1000 >= this.manualCooldown() / 2 * 1.5;
    }

    private shoot() {
        const recoilAccel = 0.0375 + 0.625 * Math.sqrt(this.customization.damage) / 10 * Math.sqrt(this.customization.acceleration);

        switch (this.customization.turretType) {
            case TurretType.Fixed:
                this.shootInDir(this.position.dir);
                this.position.dx -= Math.cos(this.position.dir) * recoilAccel;
                this.position.dy -= Math.sin(this.position.dir) * recoilAccel;
                break;
            case TurretType.Single:
                this.shootInDir(this.turretPosition.dir);
                this.position.dx -= Math.cos(this.turretPosition.dir) * recoilAccel;
                this.position.dy -= Math.sin(this.turretPosition.dir) * recoilAccel;
                break;
            case TurretType.Double:
                this.shootInDir(this.turretPosition.dir);
                this.shootInDir(this.turretPosition.dir + Math.PI);
                break;
            case TurretType.Quad:
                this.shootInDir(this.turretPosition.dir);
                this.shootInDir(this.turretPosition.dir + Math.PI / 2);
                this.shootInDir(this.turretPosition.dir + Math.PI);
                this.shootInDir(this.turretPosition.dir + Math.PI * 3/2);
                break;
            case TurretType.Multi:
                this.shootInDir(this.turretPosition.dir);
                this.shootSideTurrets();
                this.position.dx -= Math.cos(this.turretPosition.dir) * recoilAccel;
                this.position.dy -= Math.sin(this.turretPosition.dir) * recoilAccel;
                break;
        }

        this.lastShotTime = new Date();
        
        this.hitPoints -= 1;
    }

    private shootSideTurrets() {
        const sideBarrelLength = this.sideTurretBarrelLength();
        const sideBarrelBulletOffset = this.sideTurretOffset() / 2 + 0.1;

        this.shootInDir(this.turretPosition.dir, sideBarrelLength, this.customization.accuracy / 2, 1/2, -sideBarrelBulletOffset);
        this.shootInDir(this.turretPosition.dir, sideBarrelLength, this.customization.accuracy / 2, 1/2, sideBarrelBulletOffset);

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
        this.state.shootBullet({
            initX: this.position.x + Math.cos(dir + Math.PI / 2) * offset + Math.cos(dir) * (barrelLength + 0.25),
            initY: this.position.y + Math.sin(dir + Math.PI / 2) * offset + Math.sin(dir) * (barrelLength + 0.25),
            dir: dir + this.normRandomDirOffset(accuracy / 180 * Math.PI),
            size,
            fadeStartTime: new Date(),
            ownerTankId: this.id
        });
    }

    public close() {
        this.controls.close();
    }
}