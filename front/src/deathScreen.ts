export class DeathScreen {
    private clickThruListeners: (() => void)[] = [];

    constructor() {}

    public show(killedByName: string | null) {
    }

    public onClickThru(fn: () => void) {
        this.clickThruListeners.push(fn);
    }
}