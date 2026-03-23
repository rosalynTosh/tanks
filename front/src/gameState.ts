import { Bullet } from "./bullet";
import { CanvasManager } from "./canvasManager";
import { Graphics } from "./graphics";
import { InitialState, NetClient } from "./netClientShim";
import { GameObject } from "./object";
import { PlayerTank } from "./playerTank";
import { ServerSideTank, ServerSideTankUpdate } from "./serverSideTank";
import { DEFAULT_SETTINGS, Settings } from "./settings";
import { TankCustomization, TankPosition } from "./tank";

export class GameState {
    private canvasMgr: CanvasManager;
    private graphics: Graphics;
    private settings: Settings = DEFAULT_SETTINGS;

    public player?: PlayerTank;
    public tanks: Map<string, ServerSideTank>;
    public bullets: Map<string, Bullet>;
    public clientSideBullets: Map<number, Bullet> = new Map();
    private clientSideBulletCounter: number = 0;
    public objects: Map<string, GameObject>;

    private netClient: NetClient;

    private lastAnimationId?: number;

    private insertTankListener: (id: string, tank: ServerSideTank) => void;
    private deleteTankListener: (id: string) => void;
    private serverSideTankUpdateListener: (updates: Map<string, ServerSideTankUpdate>) => void;
    private bulletListener: (id: string, bullet: Bullet) => void;

    constructor(canvas: HTMLCanvasElement, netClient: NetClient, initialState: InitialState) {
        this.canvasMgr = new CanvasManager(canvas);
        this.graphics = new Graphics(this.canvasMgr, this.settings, this);

        //
        //this.bullets = new Map();
        //this.objects = new Map([["", {
        //    x: 1,
        //    y: 1,
        //    width: 1,
        //    height: 2,
        //    rot: Math.PI / 16
        //}]]);

        this.tanks = initialState.tanks;
        this.bullets = new Map();
        this.objects = initialState.objects;

        this.netClient = netClient;

        this.netClient.onInsertTank(this.insertTankListener = (id: string, tank: ServerSideTank) => {
            this.tanks.set(id, tank);
        });

        this.netClient.onDeleteTank(this.deleteTankListener = (id: string) => {
            this.tanks.delete(id);
        });

        this.netClient.onServerSideTankUpdate(this.serverSideTankUpdateListener = (updates: Map<string, ServerSideTankUpdate>) => {
            for (const [id, update] of updates) {
                if (!this.tanks.has(id)) {
                    throw new Error("no customization for tank ID " + id);
                }

                this.tanks.get(id)!.position = update.position;
                this.tanks.get(id)!.turretPosition = update.turretPosition;
                this.tanks.get(id)!.clientTimeLastUpdated = update.clientTimeLastUpdated;
                this.tanks.get(id)!.scaledHitPoints = update.scaledHitPoints;
            }
        });

        this.netClient.onBullet(this.bulletListener = (id: string, bullet: Bullet) => {
            this.bullets.set(id, bullet);

            if (!this.tanks.has(bullet.ownerTankId)) {
                throw new Error("no tank stored with bullet owner ID " + bullet.ownerTankId); // TODO: ensure 'N' sent before 'B', figure out how 'I' bullets will maintain this (or remove them)
            }

            this.tanks.get(bullet.ownerTankId)!.updateLastShotTime();
        });

        this.tick();
    }

    public resize(width: number, height: number) {
        this.canvasMgr.resize(width, height);
    }

    private tick() {
        if (this.player !== undefined) {
            this.player.tick();
        }

        this.graphics.paint();

        this.lastAnimationId = window.requestAnimationFrame(this.tick.bind(this));
    }

    public buildPlayer(playerId: string, initialPosition: TankPosition, initialHitPoints: number, customization: TankCustomization) {
        this.player = new PlayerTank(this.canvasMgr, this.settings, this, playerId, initialPosition, initialHitPoints, customization);
    }

    public shootBullet(bullet: Bullet) {
        this.clientSideBullets.set(this.clientSideBulletCounter++ % 65536, bullet);

        this.netClient.sendBullet(bullet);
    }

    public close() {
        if (this.player !== undefined) {
            this.player.close();
        }

        if (this.lastAnimationId !== undefined) {
            window.cancelAnimationFrame(this.lastAnimationId!);
        }

        this.netClient.disableOnInsertTankListener(this.insertTankListener);
        this.netClient.disableOnDeleteTankListener(this.deleteTankListener);
        this.netClient.disableOnServerSideTankUpdateListener(this.serverSideTankUpdateListener);
        this.netClient.disableOnBulletListener(this.bulletListener);
    }
}