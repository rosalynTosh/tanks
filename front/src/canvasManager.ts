export class CanvasManager {
    public canvas: HTMLCanvasElement;

    public width: number;
    public height: number;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;

        this.width = canvas.width;
        this.height = canvas.height;
    }

    public resize(width: number, height: number) {
        this.width = this.canvas.width = width;
        this.height = this.canvas.height = height;
    }
}