import { CanvasManager } from "./canvasManager";

interface Binding {
    id: string;
    keys: string[];
    mouseBtns: number[];
}

const LEFT_MOUSE_BTN = 0;
const RIGHT_MOUSE_BTN = 2;

const bindings: Binding[] = [
    {
        id: "forward",
        keys: ["KeyW", "ArrowUp"],
        mouseBtns: []
    },
    {
        id: "backward",
        keys: ["KeyS", "ArrowDown"],
        mouseBtns: []
    },
    {
        id: "turn_left",
        keys: ["KeyA", "ArrowLeft"],
        mouseBtns: []
    },
    {
        id: "turn_right",
        keys: ["KeyD", "ArrowRight"],
        mouseBtns: []
    },
    {
        id: "shoot",
        keys: ["Space"],
        mouseBtns: [LEFT_MOUSE_BTN]
    },
    {
        id: "zoom",
        keys: ["ShiftLeft", "ShiftRight"],
        mouseBtns: [RIGHT_MOUSE_BTN]
    },
    {
        id: "turn_compass",
        keys: ["KeyC"],
        mouseBtns: []
    }
];

export class Controls {
    private canvasMgr: CanvasManager;

    private keysDown: Set<string> = new Set();
    private mouseBtnsDown: Set<number> = new Set();

    private mouseOffset?: [number, number];

    private bindNowDownListeners: Map<string, (() => void)[]>;
    private bindUpListeners: Map<string, (() => void)[]>;
    private mouseMoveListeners: ((pointingDir: number | null) => void)[] = [];
    private clearListeners: (() => void)[] = [];

    private keydownListener: (event: KeyboardEvent) => void;
    private keyupListener: (event: KeyboardEvent) => void;
    private mousedownListener: (event: MouseEvent) => void;
    private mouseupListener: (event: MouseEvent) => void;
    private mousemoveListener: (event: MouseEvent) => void;
    private contextmenuListener: (event: MouseEvent) => void;
    private blurListener: () => void;

    constructor(canvasMgr: CanvasManager) {
        this.canvasMgr = canvasMgr;

        this.bindNowDownListeners = new Map(bindings.map(b => [b.id, []]));
        this.bindUpListeners = new Map(bindings.map(b => [b.id, []]));

        window.addEventListener("keydown", this.keydownListener = (event: KeyboardEvent) => {
            let bindsNowDown = [];

            bindings: for (const binding of bindings) {
                if (binding.keys.includes(event.code)) {
                    for (const key of binding.keys) {
                        if (this.keysDown.has(key)) {
                            continue bindings;
                        }
                    }
                    for (const mouseBtn of binding.mouseBtns) {
                        if (this.mouseBtnsDown.has(mouseBtn)) {
                            continue bindings;
                        }
                    }

                    bindsNowDown.push(binding.id);
                }
            }

            this.keysDown.add(event.code);

            for (const binding_id of bindsNowDown) {
                for (const listener of this.bindNowDownListeners.get(binding_id)!) {
                    listener();
                }
            }
        });

        window.addEventListener("keyup", this.keyupListener = (event: KeyboardEvent) => {
            this.keysDown.delete(event.code);

            bindings: for (const binding of bindings) {
                if (binding.keys.includes(event.code)) {
                    for (const key of binding.keys) {
                        if (this.keysDown.has(key)) {
                            continue bindings;
                        }
                    }
                    for (const mouseBtn of binding.mouseBtns) {
                        if (this.mouseBtnsDown.has(mouseBtn)) {
                            continue bindings;
                        }
                    }

                    for (const listener of this.bindUpListeners.get(binding.id)!) {
                        listener();
                    }
                }
            }
        });

        canvasMgr.canvas.addEventListener("mousedown", this.mousedownListener = (event: MouseEvent) => {
            let bindsNowDown = [];

            bindings: for (const binding of bindings) {
                if (binding.mouseBtns.includes(event.button)) {
                    for (const key of binding.keys) {
                        if (this.keysDown.has(key)) {
                            continue bindings;
                        }
                    }
                    for (const mouseBtn of binding.mouseBtns) {
                        if (this.mouseBtnsDown.has(mouseBtn)) {
                            continue bindings;
                        }
                    }

                    bindsNowDown.push(binding.id);
                }
            }

            this.mouseBtnsDown.add(event.button);

            for (const binding_id of bindsNowDown) {
                for (const listener of this.bindNowDownListeners.get(binding_id)!) {
                    listener();
                }
            }
        });

        canvasMgr.canvas.addEventListener("mouseup", this.mouseupListener = (event: MouseEvent) => {
            this.mouseBtnsDown.delete(event.button);

            bindings: for (const binding of bindings) {
                if (binding.mouseBtns.includes(event.button)) {
                    for (const key of binding.keys) {
                        if (this.keysDown.has(key)) {
                            continue bindings;
                        }
                    }
                    for (const mouse_btn of binding.mouseBtns) {
                        if (this.mouseBtnsDown.has(mouse_btn)) {
                            continue bindings;
                        }
                    }

                    for (const listener of this.bindUpListeners.get(binding.id)!) {
                        listener();
                    }
                }
            }
        });

        canvasMgr.canvas.addEventListener("mousemove", this.mousemoveListener = (event: MouseEvent) => {
            this.mouseOffset = [event.offsetX, event.offsetY];

            for (const listener of this.mouseMoveListeners) {
                listener(this.pointingDir());
            }
        });

        canvasMgr.canvas.addEventListener("contextmenu", this.contextmenuListener = (event: MouseEvent) => {
            for (const binding of bindings) {
                if (binding.mouseBtns.includes(RIGHT_MOUSE_BTN)) {
                    event.preventDefault();

                    break;
                }
            }
        });

        window.addEventListener("blur", this.blurListener = () => {
            this.keysDown.clear();
            this.mouseBtnsDown.clear();

            for (const listener of this.mouseMoveListeners) {
                listener(this.pointingDir());
            }
            for (const listener of this.clearListeners) {
                listener();
            }
        });
    }

    public pointingDir(): number | null {
        return this.mouseOffset === undefined ? null : Math.atan2(this.mouseOffset[1] - this.canvasMgr.height / 2, this.mouseOffset[0] - this.canvasMgr.width / 2);
    }

    public isBindDown(binding_id: string) {
        const binding = bindings.find(b => b.id == binding_id)!;

        return binding!.keys.some(k => this.keysDown.has(k)) || binding!.mouseBtns.some(b => this.mouseBtnsDown.has(b));
    }

    public onBindNowDown(binding_id: string, fn: () => void) {
        this.bindNowDownListeners.get(binding_id)!.push(fn);
    }

    public onBindUp(binding_id: string, fn: () => void) {
        this.bindUpListeners.get(binding_id)!.push(fn);
    }

    public onMouseMove(fn: (pointingDir: number | null) => void) {
        this.mouseMoveListeners.push(fn);
    }

    public onClear(fn: () => void) {
        this.clearListeners.push(fn);
    }

    public close() {
        window.removeEventListener("keydown", this.keydownListener);
        window.removeEventListener("keyup", this.keyupListener);
        this.canvasMgr.canvas.removeEventListener("mousedown", this.mousedownListener);
        this.canvasMgr.canvas.removeEventListener("mouseup", this.mouseupListener);
        this.canvasMgr.canvas.removeEventListener("mousemove", this.mousemoveListener);
        this.canvasMgr.canvas.removeEventListener("contextmenu", this.contextmenuListener);
        window.removeEventListener("blur", this.blurListener);
    }
}