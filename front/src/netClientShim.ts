import { Bullet } from "./bullet";
import { GameObject } from "./object";
import { ServerSideTank, ServerSideTankUpdate } from "./serverSideTank";
import { TankCustomization, TankPosition } from "./tank";

export interface ClientUpdate {
    playerPosition: TankPosition;
}

export interface InitialState {
    tanks: Map<string, ServerSideTank>;
    objects: Map<string, GameObject>;
}

export class NetClient {
    private openListeners: (() => void)[] = [];
    private closeListeners: (() => void)[] = [];

    private initialGameStateListeners: ((initialState: InitialState) => void)[] = [];
    private chooserBudgetListeners: ((budget: number) => void)[] = [];
    private dropInSuccessListeners: ((playerId: string, position: TankPosition, hitPoints: number) => void)[] = [];
    private insertTankListeners: ((id: string, tank: ServerSideTank) => void)[] = [];
    private deleteTankListeners: ((id: string) => void)[] = [];
    private serverSideTankUpdateListeners: ((updates: Map<string, ServerSideTankUpdate>) => void)[] = [];
    private bulletListeners: ((id: string, bullet: Bullet) => void)[] = [];
    private deathListeners: ((killedBy: string) => void)[] = [];

    constructor(_uri: string) {
        this.openSocket();
    }

    private openSocket() {
        window.setTimeout(() => {
            console.log("WebSocket opened");

            for (const listener of this.openListeners) {
                listener();
            }

            window.setTimeout(() => {
                const tanks = new Map();
                const objects = new Map([
                    ["0", {
                        x: 2,
                        y: 2,
                        width: 10,
                        height: 1,
                        rot: 0
                    }],
                    ["1", {
                        x: 6.5,
                        y: 2,
                        width: 1,
                        height: 4,
                        rot: 0
                    }],
                    ["2", {
                        x: -4,
                        y: 1,
                        width: 1,
                        height: 1,
                        rot: Math.PI / 4
                    }]
                ]);
        
                for (const listener of this.initialGameStateListeners) {
                    listener({ tanks, objects });
                }
            }, 0);
        }, 0);
    }

    public dropIn(customization: TankCustomization) {
        window.setTimeout(() => {
            const playerId = "SHIMID00";
            const position = {
                x: 0,
                dx: 0,
                y: 0,
                dy: 0,
                dir: 0,
                ddir: 0
            };
            const hitPoints = 10 + customization.armor;
    
            for (const listener of this.dropInSuccessListeners) {
                listener(playerId, position, hitPoints);
            }
        }, 0);
    }

    public sendBullet(_bullet: Bullet) {}

    public onOpen(fn: () => void) {
        this.openListeners.push(fn);
    }

    public onClose(fn: () => void) {
        this.closeListeners.push(fn);
    }

    public onInitialGameState(fn: (initialState: InitialState) => void) {
        this.initialGameStateListeners.push(fn);
    }

    public onChooserBudget(fn: (budget: number) => void) {
        this.chooserBudgetListeners.push(fn);
    }

    public onDropInSuccess(fn: (playerId: string, position: TankPosition, hitPoints: number) => void) {
        this.dropInSuccessListeners.push(fn);
    }

    public onInsertTank(fn: (id: string, tank: ServerSideTank) => void) {
        this.insertTankListeners.push(fn);
    }

    public onDeleteTank(fn: (id: string) => void) {
        this.deleteTankListeners.push(fn);
    }

    public onServerSideTankUpdate(fn: (updates: Map<string, ServerSideTankUpdate>) => void) {
        this.serverSideTankUpdateListeners.push(fn);
    }

    public onBullet(fn: (id: string, bullet: Bullet) => void) {
        this.bulletListeners.push(fn);
    }

    public onDeath(fn: (killedBy: string) => void) {
        this.deathListeners.push(fn);
    }

    public disableOnDropInSuccessListener(fn: (playerId: string, position: TankPosition, hitPoints: number) => void) {
        this.dropInSuccessListeners = this.dropInSuccessListeners.filter(l => l != fn);
    }

    public disableOnInsertTankListener(fn: (id: string, tank: ServerSideTank) => void) {
        this.insertTankListeners = this.insertTankListeners.filter(l => l != fn);
    }

    public disableOnDeleteTankListener(fn: (id: string) => void) {
        this.deleteTankListeners = this.deleteTankListeners.filter(l => l != fn);
    }

    public disableOnServerSideTankUpdateListener(fn: (updates: Map<string, ServerSideTankUpdate>) => void) {
        this.serverSideTankUpdateListeners = this.serverSideTankUpdateListeners.filter(l => l != fn);
    }

    public disableOnBulletListener(fn: (id: string, bullet: Bullet) => void) {
        this.bulletListeners = this.bulletListeners.filter(l => l != fn);
    }

    public disableOnDeathListener(fn: (killedBy: string) => void) {
        this.deathListeners = this.deathListeners.filter(l => l != fn);
    }
}