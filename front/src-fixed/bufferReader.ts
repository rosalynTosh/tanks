import { Bullet } from "./bullet";
import { GameObject } from "./object";
import { ServerSideTank, ServerSideTankUpdate } from "./serverSideTank";
import { TankPosition, TurretType, VisibleTankCustomization } from "./tank";

export class InsufficientDataError extends Error {
    constructor() {
        super();

        this.name = this.constructor.name;
    }
}

export class BufferFormatError extends Error {
    constructor(message: string) {
        super();

        this.name = this.constructor.name;
        this.message = message;
    }
}

export class BufferReader {
    public buffer: ArrayBuffer;
    private dv: DataView;
    private index: number;

    constructor(buffer: ArrayBuffer, index: number = 0) {
        this.buffer = buffer;
        this.dv = new DataView(buffer);
        this.index = index;
    }

    public nextUint8(): number {
        if (this.buffer.byteLength < this.index + 1) throw new InsufficientDataError();

        const uint8 = this.dv.getUint8(this.index);
        this.index += 1;
        return uint8;
    }

    public nextInt16(): number {
        if (this.buffer.byteLength < this.index + 2) throw new InsufficientDataError();

        const int16 = this.dv.getInt16(this.index, false);
        this.index += 2;
        return int16;
    }

    public nextUint16(): number {
        if (this.buffer.byteLength < this.index + 2) throw new InsufficientDataError();

        const uint16 = this.dv.getUint16(this.index, false);
        this.index += 2;
        return uint16;
    }

    public nextUint32(): number {
        if (this.buffer.byteLength < this.index + 4) throw new InsufficientDataError();

        const uint32 = this.dv.getUint32(this.index, false);
        this.index += 4;
        return uint32;
    }

    public nextTimestamp(): Date {
        if (this.buffer.byteLength < this.index + 6) throw new InsufficientDataError();

        const uint48 = this.dv.getUint32(this.index, false) * 65536 + this.dv.getUint16(this.index + 4, false);
        this.index += 6;
        return new Date(uint48);
    }

    public nextFloat32(): number {
        if (this.buffer.byteLength < this.index + 4) throw new InsufficientDataError();

        const float32 = this.dv.getFloat32(this.index, false);
        this.index += 4;
        return float32;
    }

    public nextCount(max?: number): number {
        if (this.buffer.byteLength < this.index + 1) throw new InsufficientDataError();

        let usize = 0;

        while (true) {
            if (this.buffer.byteLength < this.index + 1) throw new InsufficientDataError();

            const byte = this.dv.getUint8(this.index++);

            usize *= 128;
            usize += byte % 128;

            if (max !== undefined && usize > max) throw new InsufficientDataError();

            if (byte < 128) break;
        }

        return usize;
    }

    public nextSizedBuffer(maxBytes?: number): ArrayBuffer {
        const size = this.nextCount(maxBytes);
        const slice = this.buffer.slice(this.index, this.index + size);
        this.index += size;
        return slice;
    }

    public nextUtf8String(maxBytes?: number): string {
        return new TextDecoder().decode(this.nextSizedBuffer(maxBytes));
    }

    public nextId(): string {
        return this.nextUint32().toString(16).padStart(8, "0");
    }

    public nextTankUpdates(): Map<string, ServerSideTankUpdate> {
        const updates = new Map();
        const count = this.nextCount();

        for (let i = 0; i < count; i++) {
            const id = this.nextId();
            const update = this.nextTankUpdate();

            if (updates.has(id)) {
                throw new BufferFormatError("duplicate tank update ID" + id);
            }

            updates.set(id, update);
        }

        return updates;
    }

    public nextTanks(): Map<string, ServerSideTank> {
        const tanks = new Map();
        const count = this.nextCount();

        for (let i = 0; i < count; i++) {
            const id = this.nextId();
            const customization = this.nextTankCustomization();
            const serverSideUpdate = this.nextTankUpdate();

            if (tanks.has(id)) {
                throw new BufferFormatError("duplicate tank ID " + id);
            }

            tanks.set(id, new ServerSideTank(serverSideUpdate, customization));
        }

        return tanks;
    }

    public nextTankUpdate(): ServerSideTankUpdate {
        return {
            position: this.nextTankPosition(),
            turretPosition: {
                dir: this.nextInt16() / 32768 * Math.PI
            },
            clientTimeLastUpdated: new Date(), // TODO
            scaledHitPoints: this.nextUint16() / 65535
        };
    }

    public nextTankPosition(): TankPosition {
        return {
            x: this.nextFloat32(),
            dx: this.nextFloat32(),
            y: this.nextFloat32(),
            dy: this.nextFloat32(),
            dir: this.nextInt16() / 32768 * Math.PI,
            ddir: this.nextInt16() / 32768 * Math.PI
        };
    }

    public nextTankCustomization(): VisibleTankCustomization {
        const displayName = this.nextUtf8String();
        const turretTypeCode = this.nextUint8();
        const accuracyCost = this.nextUint8();
        const damageCost = this.nextUint8();

        if (turretTypeCode >= 6) {
            throw new BufferFormatError("unknown turretType code " + turretTypeCode);
        }

        if (accuracyCost > 40) {
            throw new BufferFormatError("accuracyCost " + accuracyCost + " too high");
        }
        if (damageCost > 100) {
            throw new BufferFormatError("damageCost " + accuracyCost + " too high");
        }

        return {
            displayName,

            turretType: [TurretType.None, TurretType.Fixed, TurretType.Single, TurretType.Double, TurretType.Quad, TurretType.Multi][turretTypeCode],

            accuracyCost,
            damageCost
        };
    }

    public nextBullets(): Map<string, Bullet> {
        const bullets: Map<string, Bullet> = new Map();
        const count = this.nextCount();

        for (let i = 0; i < count; i++) {
            const id = this.nextId();
            const bullet = this.nextBullet();

            if (bullets.has(id)) {
                throw new BufferFormatError("duplicate bullet ID " + id);
            }

            bullets.set(id, bullet);
        }

        return bullets;
    }

    public nextObjects(): Map<string, GameObject> {
        const objects: Map<string, GameObject> = new Map();
        const count = this.nextCount();

        for (let i = 0; i < count; i++) {
            const id = this.nextId();
            const object = this.nextObject();

            if (objects.has(id)) {
                throw new BufferFormatError("duplicate bullet ID " + id);
            }

            objects.set(id, object);
        }

        return objects;
    }

    public nextBullet(): Bullet {
        return {
            initX: this.nextFloat32(),
            initY: this.nextFloat32(),
            dir: this.nextFloat32(),
            size: this.nextUint8() / 64,
            shotTime: new Date(), // TODO
            fadeStartTime: new Date(),
            ownerTankId: this.nextId()
        };
    }

    public nextObject(): GameObject {
        return {
            x: this.nextFloat32(),
            y: this.nextFloat32(),
            width: this.nextFloat32(),
            height: this.nextFloat32(),
            rot: this.nextFloat32()
        };
    }

    public isFinished(): boolean {
        return this.index == this.buffer.byteLength - 1;
    }
}