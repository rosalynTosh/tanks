import { BufferFormatError, BufferReader, InsufficientDataError } from "./bufferReader";
import { Bullet } from "./bullet";
import { GameObject } from "./object";
import { ServerSideTank, ServerSideTankUpdate } from "./serverSideTank";
import { TankCustomization, TankPosition, TurretType } from "./tank";

export interface ClientUpdate {
    playerPosition: TankPosition;
}

export interface InitialState {
    tanks: Map<string, ServerSideTank>;
    bullets: Map<string, Bullet>;
    objects: Map<string, GameObject>;
}

export class NetClient {
    private uri: string;
    private ws?: WebSocket;
    private id?: number;
    private pass?: number;

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

    constructor(uri: string) {
        this.uri = uri;

        this.openSocket();
    }

    private openSocket() {
        this.ws = new WebSocket(this.uri);

        this.ws.onopen = () => {
            console.log("WebSocket opened");

            this.ws!.binaryType = "arraybuffer";

            for (const listener of this.openListeners) {
                listener();
            }

            if (this.id === undefined) {
                this.ws!.send(new Uint8Array('i'.charCodeAt(0)));
            } else {
                const buf = new ArrayBuffer(9);
                const dv = new DataView(buf);

                dv.setUint8(0, 'i'.charCodeAt(0));
                dv.setUint32(1, this.id, false);
                dv.setUint32(5, this.pass!, false);

                this.ws!.send(buf);
            }
        };
        
        this.ws.onmessage = (event: MessageEvent) => {
            const buf: ArrayBuffer = event.data;
            if (buf.byteLength == 0) {
                this.ws!.send(new ArrayBuffer(0));
                return;
            }

            const reader = new BufferReader(buf);

            while (!reader.isFinished()) {
                const type = reader.nextUint8();
                const typeChar = String.fromCharCode(type);
                try {
                    if (typeChar == 'I') {
                        if (this.id !== undefined) {
                            const gotId = reader.nextUint32();

                            if (this.id != gotId) {
                                this.ws!.close(1008, "'I' ID mismatch: was " + this.id + ", got " + gotId);
                                return;
                            }
                        } else {
                            this.id = reader.nextUint32();

                            if (this.id === 0) {
                                this.ws!.close(1008, "'I' ID got 0");
                                return;
                            }
                        }

                        this.pass = reader.nextUint32();

                        const _ = reader.nextTimestamp();

                        const tanks = reader.nextTanks();
                        const bullets = reader.nextBullets();
                        const objects = reader.nextObjects();

                        for (const listener of this.initialGameStateListeners) {
                            listener({ tanks, bullets, objects });
                        }
                    } else if (typeChar == 'C') {
                        const budget = reader.nextUint32();

                        for (const listener of this.chooserBudgetListeners) {
                            listener(budget);
                        }
                    } else if (typeChar == 'S') {
                        const playerId = reader.nextId();
                        const position = reader.nextTankPosition();
                        const hitPoints = reader.nextFloat32();

                        for (const listener of this.dropInSuccessListeners) {
                            listener(playerId, position, hitPoints);
                        }
                    } else if (typeChar == 'N') {
                        const id = reader.nextId();
                        const customization = reader.nextTankCustomization();
                        const serverSideUpdate = reader.nextTankUpdate();

                        for (const listener of this.insertTankListeners) {
                            listener(id, new ServerSideTank(serverSideUpdate, customization));
                        }
                    } else if (typeChar == 'X') {
                        const id = reader.nextId();

                        for (const listener of this.deleteTankListeners) {
                            listener(id);
                        }
                    } else if (typeChar == 'P') {
                        const _ = reader.nextTimestamp();
                        const updates = reader.nextTankUpdates();

                        for (const listener of this.serverSideTankUpdateListeners) {
                            listener(updates);
                        }
                    } else if (typeChar == 'B') {
                        const id = reader.nextId();
                        const bullet = reader.nextBullet();

                        for (const listener of this.bulletListeners) {
                            listener(id, bullet);
                        }
                    } else if (typeChar == 'D') {
                        const killedBy = reader.nextId();

                        for (const listener of this.deathListeners) {
                            listener(killedBy);
                        }
                    } else {
                        this.ws!.close(1008, "unknown type '" + typeChar + "' + (0x" + type.toString(16).padStart(2, "0") + ")");
                        return;
                    }
                } catch (error) {
                    if (error instanceof InsufficientDataError) {
                        this.ws!.close(1008, "'" + typeChar + "' insufficient data");
                        return;
                    }
                    if (error instanceof BufferFormatError) {
                        this.ws!.close(1008, "'" + typeChar + "' " + error.message);
                        return;
                    }

                    throw error;
                }
            }
        };

        this.ws.onclose = (event: CloseEvent) => {
            console.log("WebSocket closed (" + event.code + (event.reason ? ": " + event.reason : "") + ")");

            for (const listener of this.closeListeners) {
                listener();
            }

            if (event.code == 1008) {
                alert("Connection closed: You may need to update your client (Ctrl+Shift+R)");
            } else {
                setTimeout(() => this.openSocket(), 500);
            }
        };
    }

    public dropIn(customization: TankCustomization) {
        const displayNameBuf = new TextEncoder().encode(customization.displayName);

        const buf = new ArrayBuffer(2 + displayNameBuf.length + 19);
        const dv = new DataView(buf);

        dv.setUint8(0, 's'.charCodeAt(0));
        dv.setUint8(1, customization.displayName.length);
        
        new Uint8Array(buf).set(displayNameBuf, 2);

        dv.setUint16(displayNameBuf.length + 2, Math.round(customization.movementSpeedCost * 100), false);
        dv.setUint16(displayNameBuf.length + 4, Math.round(customization.turningSpeedCost * 100), false);
        dv.setUint16(displayNameBuf.length + 6, Math.round(customization.accelerationCost * 100), false);
        dv.setUint16(displayNameBuf.length + 8, Math.round(customization.scopeCost * 100), false);
        dv.setUint16(displayNameBuf.length + 10, Math.round(customization.armorCost * 100), false);
        dv.setUint16(displayNameBuf.length + 12, Math.round(customization.crushingDamageCost * 100), false);
        dv.setUint16(displayNameBuf.length + 14, Math.round(customization.damageCost * 100), false);
        dv.setUint16(displayNameBuf.length + 16, Math.round(customization.cooldownCost * 100), false);
        dv.setUint16(displayNameBuf.length + 18, Math.round(customization.accuracyCost * 100), false);
        dv.setUint8(displayNameBuf.length + 20, (
            [TurretType.None, TurretType.Fixed, TurretType.Single, TurretType.Double, TurretType.Quad, TurretType.Multi].indexOf(customization.turretType) * 8,
            Number(customization.shield) * 4 + Number(customization.piercing) * 2 + Number(customization.fullAuto)
        ));

        this.ws!.send(buf);
    }

    public sendBullet(bullet: Bullet) {
        const buf = new ArrayBuffer(13);
        const dv = new DataView(buf);

        dv.setUint8(0, 'b'.charCodeAt(0));
        dv.setFloat32(1, bullet.initX, false);
        dv.setFloat32(5, bullet.initY, false);
        dv.setFloat32(9, bullet.dir, false);

        this.ws!.send(buf);
    }

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