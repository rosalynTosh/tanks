import { Bullet } from "./bullet";
import { CanvasManager } from "./canvasManager";
import { GameState } from "./gameState";
import { GameObject } from "./object";
import { PlayerTank } from "./playerTank";
import { Settings } from "./settings";
import { Tank, TankPosition, TurretType } from "./tank";

const RECOIL_DURATION_MS = 25;
const RECOIL_RETURN_DURATION_MS = 85;

export class Graphics {
    private canvasMgr: CanvasManager;
    private settings: Settings;

    private state: GameState;
    private lastPlayerPosition: TankPosition = {
        x: 0,
        dx: 0,
        y: 0,
        dy: 0,
        dir: Math.PI * 3/2,
        ddir: 0
    };

    private ctx: CanvasRenderingContext2D;

    constructor(canvasMgr: CanvasManager, settings: Settings, state: GameState) {
        this.canvasMgr = canvasMgr;
        this.settings = settings;

        this.state = state;

        this.ctx = this.canvasMgr.canvas.getContext("2d")!;
    }

    private drawGrid(playerPosition: TankPosition, scale: number) {
        this.ctx.strokeStyle = "#ddd";
        this.ctx.lineWidth = 0.0125;

        let halfWidth, halfHeight;

        if (!this.settings.rotateFov) {
            halfWidth = this.canvasMgr.width / 2 / scale;
            halfHeight = this.canvasMgr.height / 2 / scale;
        } else {
            halfWidth = halfHeight = Math.hypot(this.canvasMgr.width / 2, this.canvasMgr.height / 2) / scale;
        }

        const minX = Math.floor(playerPosition.x - halfWidth);
        const maxX = Math.ceil(playerPosition.x + halfWidth);
        const minY = Math.floor(playerPosition.y - halfHeight);
        const maxY = Math.ceil(playerPosition.y + halfHeight);

        for (let x = minX; x <= maxX; x++) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, minY);
            this.ctx.lineTo(x, maxY);
            this.ctx.stroke();
        }

        for (let y = minY; y <= maxY; y++) {
            this.ctx.beginPath();
            this.ctx.moveTo(minX, y);
            this.ctx.lineTo(maxX, y);
            this.ctx.stroke();
        }
    }

    private drawTankBody(tank: Tank, time: Date) {
        this.ctx.save();

        const predictedPosition = tank.getPredictedPositionAtClientTime(time); // TODO: synchronize date?

        this.ctx.translate(predictedPosition.x, predictedPosition.y);
        this.ctx.rotate(predictedPosition.dir);
        
        this.ctx.strokeStyle = "#000";
        this.ctx.lineWidth = 0.025;

        const tankHalfWidth = 0.4375;
        
        this.ctx.fillStyle = "#444";

        this.ctx.fillRect(-0.625, -tankHalfWidth - 0.125, 1.25, 0.25);
        this.ctx.strokeRect(-0.625, -tankHalfWidth - 0.125, 1.25, 0.25);
        this.ctx.fillRect(-0.625, tankHalfWidth - 0.125, 1.25, 0.25);
        this.ctx.strokeRect(-0.625, tankHalfWidth - 0.125, 1.25, 0.25);

        this.ctx.fillStyle = "#eee";

        this.ctx.beginPath();
        this.ctx.moveTo(0.5, -tankHalfWidth);
        this.ctx.lineTo(0.5, tankHalfWidth);
        this.ctx.lineTo(-0.5, tankHalfWidth);
        this.ctx.lineTo(-0.5, -tankHalfWidth);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.moveTo(0.5, -0.28125);
        this.ctx.lineTo(0.625, -0.125);
        this.ctx.lineTo(0.625, 0.125);
        this.ctx.lineTo(0.5, 0.28125);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();

        this.ctx.restore();
    }

    private drawTankTurret(tank: Tank, time: Date) {
        this.ctx.save();

        const predictedPosition = tank.getPredictedPositionAtClientTime(time); // TODO: synchronize with tankbody? maybe return a closure?

        this.ctx.translate(predictedPosition.x, predictedPosition.y);
        this.ctx.rotate(tank.customization.turretType == TurretType.Fixed ? predictedPosition.dir : tank.turretPosition.dir);

        if (tank.lastShotTime !== undefined && tank.customization.turretType != TurretType.Double && tank.customization.turretType != TurretType.Quad) {
            const lastShotDiffMs = time.getTime() - tank.lastShotTime.getTime();
            const recoilDist = 0.0625 + 0.125 * tank.customization.damageCost / 100;

            this.ctx.translate(lastShotDiffMs > RECOIL_DURATION_MS + RECOIL_RETURN_DURATION_MS ? 0 : lastShotDiffMs > RECOIL_DURATION_MS ? (RECOIL_DURATION_MS + RECOIL_RETURN_DURATION_MS - lastShotDiffMs) / RECOIL_RETURN_DURATION_MS * -recoilDist : lastShotDiffMs / RECOIL_DURATION_MS * -recoilDist, 0);
        }

        this.ctx.strokeStyle = "#000";
        this.ctx.lineWidth = 0.025;

        this.ctx.fillStyle = "#ccc";

        this.ctx.fillRect(-0.25, -0.25, 0.5, 0.5);
        this.ctx.strokeRect(-0.25, -0.25, 0.5, 0.5);
        
        this.ctx.fillStyle = tank.customization.turretType == TurretType.Fixed ? "#ddd" : "#eee";
        
        const barrelLength = tank.barrelLength();

        if (tank.customization.turretType == TurretType.None) {
            // nothing
        } else if (tank.customization.turretType == TurretType.Fixed || tank.customization.turretType == TurretType.Single) {
            this.ctx.fillRect(0.25, -0.1, barrelLength, 0.2);
            this.ctx.strokeRect(0.25, -0.1, barrelLength, 0.2);
        } else if (tank.customization.turretType == TurretType.Double) {
            this.ctx.fillRect(0.25, -0.1, barrelLength, 0.2);
            this.ctx.strokeRect(0.25, -0.1, barrelLength, 0.2);
    
            this.ctx.fillRect(-0.25 - barrelLength, -0.1, barrelLength, 0.2);
            this.ctx.strokeRect(-0.25 - barrelLength, -0.1, barrelLength, 0.2);
        } else if (tank.customization.turretType == TurretType.Quad) {
            this.ctx.fillRect(0.25, -0.1, barrelLength, 0.2);
            this.ctx.strokeRect(0.25, -0.1, barrelLength, 0.2);
    
            this.ctx.fillRect(-0.25 - barrelLength, -0.1, barrelLength, 0.2);
            this.ctx.strokeRect(-0.25 - barrelLength, -0.1, barrelLength, 0.2);

            this.ctx.fillRect(-0.1, 0.25, 0.2, barrelLength);
            this.ctx.strokeRect(-0.1, 0.25, 0.2, barrelLength);
    
            this.ctx.fillRect(-0.1, -0.25 - barrelLength, 0.2, barrelLength);
            this.ctx.strokeRect(-0.1, -0.25 - barrelLength, 0.2, barrelLength);
        } else if (tank.customization.turretType == TurretType.Multi) {
            const sideBarrelOffset = tank.sideTurretOffset();
            const sideBarrelLength = tank.sideTurretBarrelLength();
            
            this.ctx.fillRect(0.25, -0.1 - sideBarrelOffset, sideBarrelLength, 0.2);
            this.ctx.strokeRect(0.25, -0.1 - sideBarrelOffset, sideBarrelLength, 0.2);

            this.ctx.fillRect(0.25, -0.1 + sideBarrelOffset, sideBarrelLength, 0.2);
            this.ctx.strokeRect(0.25, -0.1 + sideBarrelOffset, sideBarrelLength, 0.2);
        
            this.ctx.fillRect(0.25, -0.1, barrelLength, 0.2);
            this.ctx.strokeRect(0.25, -0.1, barrelLength, 0.2);
        }

        this.ctx.restore();
    }

    private drawTankHpBar(tank: Tank, time: Date) {
        this.ctx.save();

        const predictedPosition = tank.getPredictedPositionAtClientTime(time); // TODO: synchronize date?

        this.ctx.translate(predictedPosition.x, predictedPosition.y);

        this.ctx.fillStyle = "#000";
        this.ctx.strokeStyle = "#000";
        this.ctx.lineWidth = 0.05;

        this.ctx.fillRect(-0.46875, -0.475, 0.9375, 0.05);
        this.ctx.strokeRect(-0.46875, -0.475, 0.9375, 0.05);

        const scaledHitPoints = tank.getScaledHitPoints();

        this.ctx.fillStyle = "hsl(" + (Math.max(scaledHitPoints - 0.125, 0) * 120 / 0.875) + ", 100%, 40%)";
        this.ctx.fillRect(-0.46875, -0.475, 0.9375 * scaledHitPoints, 0.05);

        this.ctx.restore();
    }

    private drawTankDisplayName(tank: Tank, time: Date, scale: number) {
        this.ctx.save();

        const predictedPosition = tank.getPredictedPositionAtClientTime(time); // TODO: synchronize date?

        this.ctx.translate(predictedPosition.x * scale, predictedPosition.y * scale);

        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "bottom";
        this.ctx.font = "bold " + Math.round(scale * 0.1875) + "px system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'";

        this.ctx.strokeStyle = "#000";
        this.ctx.fillStyle = "#fff";
        this.ctx.lineWidth = 0.0375 * scale;

        this.ctx.strokeText(tank.customization.displayName, 0, -0.525 * scale);
        this.ctx.fillText(tank.customization.displayName, 0, -0.525 * scale);

        this.ctx.restore();
    }

    private drawBullet(bullet: Bullet) {
        const diff = (new Date().getTime() - bullet.fadeStartTime.getTime()) / 1000;
        const fadeMultiplier = 1 - (diff / 1) ** 2;

        if (fadeMultiplier < 0) return;

        this.ctx.strokeStyle = "rgba(63, 63, 63, " + fadeMultiplier * 0.4 + ")";
        this.ctx.lineWidth = fadeMultiplier * bullet.size * 0.0625;

        this.ctx.beginPath();
        this.ctx.moveTo(bullet.initX, bullet.initY);
        this.ctx.lineTo(bullet.initX + Math.cos(bullet.dir) * 1000, bullet.initY + Math.sin(bullet.dir) * 1000);
        this.ctx.stroke();
    }

    private drawObject(object: GameObject) {
        this.ctx.save();

        this.ctx.translate(object.x, object.y);
        this.ctx.rotate(object.rot);

        this.ctx.fillStyle = "#999";
        this.ctx.strokeStyle = "#000";
        this.ctx.lineWidth = 0.025;

        this.ctx.fillRect(-object.width / 2, -object.height / 2, object.width, object.height);
        this.ctx.strokeRect(-object.width / 2, -object.height / 2, object.width, object.height);

        this.ctx.restore();
    }

    private drawCooldownTimer(player: PlayerTank, scale: number) {
        const maxCooldown = player.manualCooldown();

        if (maxCooldown < 0.4) return;

        const cooldown = player.lastShotTime === undefined ? 0 : (player.lastShotTime.getTime() / 1000 + maxCooldown) - new Date().getTime() / 1000;

        if (cooldown <= 0) return;

        const cooldownProportion = cooldown / maxCooldown;

        this.ctx.save();

        this.ctx.translate(this.canvasMgr.width / 2, this.canvasMgr.height / 2);
        this.ctx.scale(scale, scale);

        this.ctx.fillStyle = "rgba(0, 0, 0, 0.5)";

        this.ctx.beginPath();
        this.ctx.arc(0, 0, 0.35, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = "#fff";

        this.ctx.beginPath();
        this.ctx.arc(0, 0, 0.3125, Math.PI * 3/2, Math.PI * (3/2 + cooldownProportion * 2), false);
        this.ctx.arc(0, 0, 0.265, Math.PI * (3/2 + cooldownProportion * 2), Math.PI * 3/2, true);
        this.ctx.closePath();
        this.ctx.fill();

        this.ctx.restore();

        this.ctx.save();
        
        this.ctx.translate(this.canvasMgr.width / 2, this.canvasMgr.height / 2);

        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.font = "bold " + Math.round(scale * 0.1875) + "px system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'";

        this.ctx.fillStyle = "#fff";

        this.ctx.fillText(cooldown.toFixed(1), 0, 0);

        this.ctx.restore();
    }

    public paint() {
        this.ctx.clearRect(0, 0, this.canvasMgr.width, this.canvasMgr.height);

        let playerPosition: TankPosition;
        
        if (this.state.player === undefined) {
            playerPosition = this.lastPlayerPosition;
        } else {
            this.lastPlayerPosition = playerPosition = this.state.player.position;
        }

        const scale = Math.sqrt(this.canvasMgr.width * this.canvasMgr.height) / (this.state.player === undefined ? 24 : this.state.player.customization.scope);

        this.ctx.save();

        this.ctx.translate(this.canvasMgr.width / 2, this.canvasMgr.height / 2);
        this.ctx.scale(scale, scale);
        if (this.settings.rotateFov) this.ctx.rotate(Math.PI * 3/2 - playerPosition.dir);
        this.ctx.translate(-playerPosition.x, -playerPosition.y);

        const time = new Date();

        this.drawGrid(playerPosition, scale);

        if (this.state.player !== undefined) {
            this.drawTankBody(this.state.player, time);
        }

        for (const [tankId, tank] of this.state.tanks) {
            if (this.state.player === undefined || tankId != this.state.player.id) {
                this.drawTankBody(tank, time);
                this.drawTankHpBar(tank, time);
            }
        }

        for (const [_, object] of this.state.objects) {
            this.drawObject(object);
        }

        if (this.state.player !== undefined && this.state.player.customization.turretType != TurretType.None) {
            this.drawTankTurret(this.state.player, time);
            this.drawTankHpBar(this.state.player, time);
        }

        for (const [tankId, tank] of this.state.tanks) {
            if ((this.state.player === undefined || tankId != this.state.player.id) && tank.customization.turretType != TurretType.None) {
                this.drawTankTurret(tank, time);
            }
        }

        for (const [_, bullet] of this.state.bullets) {
            this.drawBullet(bullet);
        }
        for (const [_, bullet] of this.state.clientSideBullets) {
            this.drawBullet(bullet);
        }

        this.ctx.restore();

        this.ctx.save();

        this.ctx.translate(this.canvasMgr.width / 2, this.canvasMgr.height / 2);
        this.ctx.translate(-playerPosition.x * scale, -playerPosition.y * scale);

        for (const [tankId, tank] of this.state.tanks) {
            if (this.state.player === undefined || tankId != this.state.player.id) {
                this.drawTankDisplayName(tank, time, scale);
            }
        }

        if (this.state.player !== undefined) {
            this.drawTankDisplayName(this.state.player, time, scale);
        }

        this.ctx.restore();

        if (this.state.player !== undefined) {
            this.drawCooldownTimer(this.state.player, scale);
        }

        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.font = "bold " + Math.round(scale * 0.125) + "px system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'";

        for (const dbgPoint of window.dbgPoints) {
            const width = this.ctx.measureText(dbgPoint.dbg).width;
            
            this.ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
            this.ctx.fillRect((dbgPoint.x - (this.state.player?.position.x ?? 0)) * scale - width / 2 - 2 + this.canvasMgr.width / 2, (dbgPoint.y - (this.state.player?.position.y ?? 0)) * scale - Math.round(scale * 0.125) / 2 - 2 + this.canvasMgr.height / 2, width + 4, Math.round(scale * 0.125) + 4);
            this.ctx.fillStyle = "#fff";
            this.ctx.fillText(dbgPoint.dbg, (dbgPoint.x - (this.state.player?.position.x ?? 0)) * scale + this.canvasMgr.width / 2, (dbgPoint.y - (this.state.player?.position.y ?? 0)) * scale + this.canvasMgr.height / 2);
        }
        
        window.dbgPoints = [];

        this.ctx.textAlign = "left";
        this.ctx.textBaseline = "top";
        this.ctx.font = "16px system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'";

        const playerDbg = this.state.player === undefined ? "" : (
            "\nx: " + this.state.player.position.x +
            "\ndx: " + this.state.player.position.dx +
            "\ny: " + this.state.player.position.y +
            "\ndy: " + this.state.player.position.dy +
            "\ndir: " + this.state.player.position.dir
        );

        const dbg = Date() + playerDbg;

        let y = 4;

        for (const row of dbg.split("\n")) {
            this.ctx.fillText(row, 4, y);
            y += 18;
        }
    }
}