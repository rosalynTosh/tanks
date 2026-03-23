import { Chooser } from "./chooser";
import { DeathScreen } from "./deathScreen";
import { GameState } from "./gameState";
import { InitialState, NetClient } from "./netClientShim";
import { TankCustomization, TankPosition } from "./tank";

enum InGameState {
    CHOOSING_TANK,
    PLAYING,
    DIED
}

const display = document.getElementById("display")!;

const netClient = new NetClient("ws://localhost:8081");
const chooser = new Chooser();
const deathScreen = new DeathScreen();

//chooser.setBudget(270); // TODO

let inGameState: InGameState = InGameState.CHOOSING_TANK;
let game: GameState | undefined;
let customization: TankCustomization | undefined;
let resizeListener: (() => void) | undefined;

netClient.onClose(() => {
    chooser.setNetClientClosed();

    if (game !== undefined) {
        window.removeEventListener("resize", resizeListener!);
        resizeListener = undefined;
        
        game.close();
        game = undefined;
    }
});

netClient.onInitialGameState((initialState: InitialState) => {
    chooser.setNetClientOpen();

    game = new GameState(display as HTMLCanvasElement, netClient, initialState);
    window.addEventListener("resize", resizeListener = () => game!.resize(window.innerWidth, window.innerHeight));
    game.resize(window.innerWidth, window.innerHeight);
});

netClient.onChooserBudget((budget: number) => {
    chooser.setBudget(budget);
})

chooser.onDropInClicked((c: TankCustomization) => {
    customization = c;
    
    netClient.dropIn(c);

    // ui
});

netClient.onDropInSuccess((playerId: string, initialPosition: TankPosition, initialHitPoints: number) => {
    inGameState = InGameState.PLAYING;

    game!.buildPlayer(playerId, initialPosition, initialHitPoints, customization!);
    customization = undefined;

    chooser.finish();
});

netClient.onDeath((killedBy: string) => {
    inGameState = InGameState.DIED;

    deathScreen.show(killedBy == '00000000' ? null : game!.tanks.get(killedBy)!.customization.displayName); // TODO: ensure 'N' sent before 'D'
});

deathScreen.onClickThru(() => {
    inGameState = InGameState.CHOOSING_TANK;

    chooser.show();
});

interface DbgPoint {
    x: number,
    y: number,
    dbg: string
}

declare global {
    interface Window { dbgPoints: DbgPoint[]; }
}

window.dbgPoints = [];