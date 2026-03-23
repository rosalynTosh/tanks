import { TankCustomization, TurretType } from "./tank";

const turretTypeCosts: {[turretType: string]: number} = {
    "none": -37.5,
    "fixed": -25,
    "single": 0,
    "double": 10,
    "quad": 20,
    "multi": 40
};

function costToMovementSpeed(cost: number) {
    return 2 ** (cost / 50) * 2;
}

function costToTurningSpeedInRotations(cost: number) {
    return 3 ** (cost / 10 - 1) / 2;
}

function costToAcceleration(cost: number) {
    return 10 ** (cost / 10);
}

function costToScope(cost: number) {
    return 18 + cost / 4;
}

function costToArmor(cost: number) {
    return cost;
}

function costToCrushingDamage(cost: number) {
    return cost / 4;
}

function costToDamageAndCooldown(damageCost: number, cooldownCost: number): { damage: number, cooldown: number } {
    return {
       damage: damageCost ** 2 / 100 + 0.01,
       // cooldown: (((100 - cooldownCost) ** 2 / 100 + 0.01) / (20 + 5 * ((100 - cooldownCost) / 50) ** 2) + damageCost ** 1.5 / 500) * 0.95 / (25.01 / 25 + Math.SQRT1_2) + 0.05
       cooldown: (((100 - cooldownCost) ** 2 / 100 + 0.01) / (20 + 5 * ((100 - cooldownCost) / 50) ** 2) * (1.5 ** (damageCost / 50 - 1)) + damageCost ** 1.5 / 1000) / 1.25949152613 + 0.025
    };

    // return {
    //     damage: 2.048 * 1.03985 ** damageCost - 1.948,
    //     cooldown: 0.025
    // };
}

function costToAccuracy(cost: number) {
    const c = -0.0975609756097557;
    const b = -0.153402646756681;
    const a = 45 - c;

    return a * Math.exp(cost * b) + c;
}

export class Chooser {
    private rootCont: HTMLDivElement;

    private displayNameInput: HTMLInputElement;
    private invalid: HTMLParagraphElement;
    private connecting: HTMLParagraphElement;
    private startButton: HTMLButtonElement;

    private budgetPrintouts: HTMLCollectionOf<HTMLSpanElement>;
    private buildCostPrintouts: HTMLCollectionOf<HTMLSpanElement>;

    private movementSpeedPrintout: HTMLSpanElement;
    private movementSpeedCost: HTMLParagraphElement;
    private movementSpeed: HTMLInputElement;

    private turningSpeedPrintout: HTMLSpanElement;
    private turningSpeedCost: HTMLParagraphElement;
    private turningSpeed: HTMLInputElement;

    private accelerationPrintout: HTMLSpanElement;
    private accelerationCost: HTMLParagraphElement;
    private acceleration: HTMLInputElement;

    private scopePrintout: HTMLSpanElement;
    private scopeCost: HTMLParagraphElement;
    private scope: HTMLInputElement;

    private armorPrintout: HTMLSpanElement;
    private armorCost: HTMLParagraphElement;
    private armor: HTMLInputElement;

    private crushingDamagePrintout: HTMLSpanElement;
    private crushingDamageCost: HTMLParagraphElement;
    private crushingDamage: HTMLInputElement;

    private shieldCost: HTMLParagraphElement;
    private shield: HTMLInputElement;

    private damagePrintout: HTMLSpanElement;
    private damageCost: HTMLParagraphElement;
    private damage: HTMLInputElement;

    private cooldownPrintout: HTMLSpanElement;
    private cooldownCost: HTMLParagraphElement;
    private cooldown: HTMLInputElement;

    private accuracyPrintout: HTMLSpanElement;
    private accuracyCost: HTMLParagraphElement;
    private accuracy: HTMLInputElement;

    private piercingCost: HTMLParagraphElement;
    private piercing: HTMLInputElement;

    private fullAutoCost: HTMLParagraphElement;
    private fullAuto: HTMLInputElement;

    private turretTypeCost: HTMLParagraphElement;
    private turretTypes: NodeListOf<HTMLInputElement>;
    private turretTypeNone: HTMLInputElement;

    private budget?: number;

    private netClientOpen: boolean = false;

    private dropInClickedListeners: ((customization: TankCustomization) => void)[] = [];

    constructor() {
        this.rootCont = document.getElementById("chooserRootCont") as HTMLDivElement;

        this.displayNameInput = document.getElementById("displayName") as HTMLInputElement;
        this.invalid = document.getElementById("invalid") as HTMLParagraphElement;
        this.connecting = document.getElementById("connecting") as HTMLParagraphElement;
        this.startButton = document.getElementById("dropIn") as HTMLButtonElement;

        this.budgetPrintouts = document.getElementsByClassName("budget") as HTMLCollectionOf<HTMLSpanElement>;
        this.buildCostPrintouts = document.getElementsByClassName("buildCost") as HTMLCollectionOf<HTMLSpanElement>;

        this.movementSpeedPrintout = document.getElementById("movementSpeedPrintout") as HTMLSpanElement;
        this.movementSpeedCost = document.getElementById("movementSpeedCost") as HTMLParagraphElement;
        this.movementSpeed = document.getElementById("movementSpeed") as HTMLInputElement;
    
        this.turningSpeedPrintout = document.getElementById("turningSpeedPrintout") as HTMLSpanElement;
        this.turningSpeedCost = document.getElementById("turningSpeedCost") as HTMLParagraphElement;
        this.turningSpeed = document.getElementById("turningSpeed") as HTMLInputElement;
    
        this.accelerationPrintout = document.getElementById("accelerationPrintout") as HTMLSpanElement;
        this.accelerationCost = document.getElementById("accelerationCost") as HTMLParagraphElement;
        this.acceleration = document.getElementById("acceleration") as HTMLInputElement;
    
        this.scopePrintout = document.getElementById("scopePrintout") as HTMLSpanElement;
        this.scopeCost = document.getElementById("scopeCost") as HTMLParagraphElement;
        this.scope = document.getElementById("scope") as HTMLInputElement;
    
        this.armorPrintout = document.getElementById("armorPrintout") as HTMLSpanElement;
        this.armorCost = document.getElementById("armorCost") as HTMLParagraphElement;
        this.armor = document.getElementById("armor") as HTMLInputElement;
    
        this.crushingDamagePrintout = document.getElementById("crushingDamagePrintout") as HTMLSpanElement;
        this.crushingDamageCost = document.getElementById("crushingDamageCost") as HTMLParagraphElement;
        this.crushingDamage = document.getElementById("crushingDamage") as HTMLInputElement;
    
        this.shieldCost = document.getElementById("shieldCost") as HTMLParagraphElement;
        this.shield = document.getElementById("shield") as HTMLInputElement;
    
        this.damagePrintout = document.getElementById("damagePrintout") as HTMLSpanElement;
        this.damageCost = document.getElementById("damageCost") as HTMLParagraphElement;
        this.damage = document.getElementById("damage") as HTMLInputElement;
    
        this.cooldownPrintout = document.getElementById("cooldownPrintout") as HTMLSpanElement;
        this.cooldownCost = document.getElementById("cooldownCost") as HTMLParagraphElement;
        this.cooldown = document.getElementById("cooldown") as HTMLInputElement;
    
        this.accuracyPrintout = document.getElementById("accuracyPrintout") as HTMLSpanElement;
        this.accuracyCost = document.getElementById("accuracyCost") as HTMLParagraphElement;
        this.accuracy = document.getElementById("accuracy") as HTMLInputElement;
    
        this.piercingCost = document.getElementById("piercingCost") as HTMLParagraphElement;
        this.piercing = document.getElementById("piercing") as HTMLInputElement;
    
        this.fullAutoCost = document.getElementById("fullAutoCost") as HTMLParagraphElement;
        this.fullAuto = document.getElementById("fullAuto") as HTMLInputElement;

        this.turretTypeCost = document.getElementById("turretTypeCost") as HTMLParagraphElement;
        this.turretTypes = document.getElementsByName("turretType") as NodeListOf<HTMLInputElement>;
        this.turretTypeNone = document.getElementById("turretTypeNone") as HTMLInputElement;

        this.displayNameInput.addEventListener("input", () => {
            this.updateInvalid();
        });

        this.startButton.addEventListener("click", () => {
            for (const listener of this.dropInClickedListeners) {
                listener({
                    displayName: this.displayNameInput.value || "Player",

                    movementSpeedCost: Number(this.movementSpeed.value),
                    movementSpeed: costToMovementSpeed(Number(this.movementSpeed.value)),
                    turningSpeedCost: Number(this.turningSpeed.value),
                    turningSpeed: costToTurningSpeedInRotations(Number(this.turningSpeed.value)) * Math.PI * 2,
                    accelerationCost: Number(this.acceleration.value),
                    acceleration: costToAcceleration(Number(this.acceleration.value)),
                    scopeCost: Number(this.scope.value),
                    scope: costToScope(Number(this.scope.value)),

                    armorCost: Number(this.armor.value),
                    armor: costToArmor(Number(this.armor.value)),
                    crushingDamageCost: Number(this.crushingDamage.value),
                    crushingDamage: costToCrushingDamage(Number(this.crushingDamage.value)),
                    shield: this.shield.checked,

                    turretType: ([...this.turretTypes].find(t => t.checked)?.value ?? "single") as TurretType,
                    damageCost: Number(this.damage.value),
                    damage: costToDamageAndCooldown(Number(this.damage.value), Number(this.cooldown.value)).damage,
                    cooldownCost: Number(this.cooldown.value),
                    cooldown: costToDamageAndCooldown(Number(this.damage.value), Number(this.cooldown.value)).cooldown,
                    accuracyCost: Number(this.accuracy.value),
                    accuracy: costToAccuracy(Number(this.accuracy.value)),
                    piercing: this.piercing.checked,
                    fullAuto: this.fullAuto.checked
                });
            }
        });

        let movementSpeedListener;

        this.movementSpeed.addEventListener("input", movementSpeedListener = () => {
            const movementSpeedCost = Number(this.movementSpeed.value);

            this.movementSpeedCost.textContent = "$" + movementSpeedCost.toFixed(2);

            const movementSpeed = costToMovementSpeed(movementSpeedCost);

            this.movementSpeedPrintout.textContent = String(Math.round(movementSpeed * 100) / 100);

            this.updateBuildCost();
        });

        movementSpeedListener();

        let turningSpeedListener;

        this.turningSpeed.addEventListener("input", turningSpeedListener = () => {
            const turningSpeedCost = Number(this.turningSpeed.value);

            this.turningSpeedCost.textContent = "$" + turningSpeedCost.toFixed(2);

            const turningSpeed = costToTurningSpeedInRotations(turningSpeedCost);

            this.turningSpeedPrintout.textContent = String(Math.round(turningSpeed * 100) / 100);

            this.updateBuildCost();
        });

        turningSpeedListener();

        let accelerationListener;

        this.acceleration.addEventListener("input", accelerationListener = () => {
            const accelerationCost = Number(this.acceleration.value);

            this.accelerationCost.textContent = "$" + accelerationCost.toFixed(2);

            const acceleration = costToAcceleration(accelerationCost);

            this.accelerationPrintout.textContent = String(Math.round(acceleration * 100) / 100);

            this.updateBuildCost();
        });

        accelerationListener();

        let scopeListener;

        this.scope.addEventListener("input", scopeListener = () => {
            const scopeCost = Number(this.scope.value);

            this.scopeCost.textContent = "$" + scopeCost.toFixed(2);

            const scope = costToScope(scopeCost);

            this.scopePrintout.textContent = String(Math.round(scope * 100) / 100);

            this.updateBuildCost();
        });

        scopeListener();

        let armorListener;

        this.armor.addEventListener("input", armorListener = () => {
            const armorCost = Number(this.armor.value);

            this.armorCost.textContent = "$" + armorCost.toFixed(2);

            const armor = costToArmor(armorCost);

            this.armorPrintout.textContent = String(Math.round(armor * 100) / 100);

            this.updateBuildCost();
        });

        armorListener();

        let crushingDamageListener;

        this.crushingDamage.addEventListener("input", crushingDamageListener = () => {
            const crushingDamageCost = Number(this.crushingDamage.value);

            this.crushingDamageCost.textContent = "$" + crushingDamageCost.toFixed(2);

            const crushingDamage = costToCrushingDamage(crushingDamageCost);

            this.crushingDamagePrintout.textContent = String(Math.round(crushingDamage * 100) / 100);

            this.updateBuildCost();
        });

        crushingDamageListener();

        let shieldListener;

        this.shield.addEventListener("input", shieldListener = () => {
            this.shieldCost.textContent = this.shield.checked ? "$25.00" : "$0.00";

            this.updateBuildCost();
        });

        shieldListener();

        let turretListener = () => {
            const damageCost = Number(this.damage.value);
            const cooldownCost = Number(this.cooldown.value);

            this.damageCost.textContent = this.turretTypeNone.checked ? "$0.00" : "$" + damageCost.toFixed(2);
            this.cooldownCost.textContent = this.turretTypeNone.checked ? "$0.00" : "$" + cooldownCost.toFixed(2);

            const { damage, cooldown } = costToDamageAndCooldown(damageCost, cooldownCost);

            this.damagePrintout.textContent = String(Math.round(damage * 100) / 100);
            this.cooldownPrintout.textContent = String(Math.round((cooldown * (this.fullAuto.checked ? 0.9 : 1)) * 100) / 100);

            this.updateBuildCost();
        };

        this.damage.addEventListener("input", turretListener);
        this.cooldown.addEventListener("input", turretListener);
        
        turretListener();

        let accuracyListener;

        this.accuracy.addEventListener("input", accuracyListener = () => {
            const accuracyCost = Number(this.accuracy.value);

            this.accuracyCost.textContent = this.turretTypeNone.checked ? "$0.00" : "$" + accuracyCost.toFixed(2);

            const accuracy = costToAccuracy(accuracyCost);

            this.accuracyPrintout.textContent = String(Math.round(accuracy * 100) / 100);

            this.updateBuildCost();
        });

        accuracyListener();

        let piercingListener;

        this.piercing.addEventListener("input", piercingListener = () => {
            this.piercingCost.textContent = !this.turretTypeNone.checked && this.piercing.checked ? "$15.00" : "$0.00";

            this.updateBuildCost();
        });

        piercingListener();

        let fullAutoListener;

        this.fullAuto.addEventListener("input", fullAutoListener = () => {
            this.fullAutoCost.textContent = !this.turretTypeNone.checked && this.fullAuto.checked ? "$20.00" : "$0.00";

            turretListener();
            this.updateBuildCost();
        });

        fullAutoListener();

        for (const type of this.turretTypes) {
            const cost = turretTypeCosts[type.value]!;

            let typeListener;

            type.addEventListener("change", typeListener = () => {
                turretListener();
                accuracyListener();
                piercingListener();
                fullAutoListener();

                if ((type as HTMLInputElement).checked) {
                    this.turretTypeCost.textContent = "$" + cost.toFixed(2);
                }

                this.updateBuildCost();
            });

            typeListener();

            document.getElementById(type.id + "Cost")!.textContent = (cost < 0 ? "-$" : "$") + Math.abs(cost);
        }

        for (const budgetPrintout of this.budgetPrintouts) {
            budgetPrintout.textContent = this.budget === undefined ? "--" : "$" + this.budget.toFixed(2);
        }
    }

    private computeBuildCost() {
        return (
            Number(this.movementSpeed.value) +
            Number(this.turningSpeed.value) +
            Number(this.acceleration.value) +
            Number(this.scope.value) +

            Number(this.armor.value) +
            Number(this.crushingDamage.value) +
            Number(this.shield.checked) * 25 +

            turretTypeCosts[[...this.turretTypes].find(t => t.checked)?.value ?? "single"] +
            (Number(this.damage.value) +
            Number(this.cooldown.value) +
            Number(this.accuracy.value) +
            Number(this.piercing.checked) * 15 +
            Number(this.fullAuto.checked) * 20) * (this.turretTypeNone.checked ? 0 : 1)
        );
    }

    private updateBuildCost() {
        const buildCost = this.computeBuildCost();

        for (const buildCostPrintout of this.buildCostPrintouts) {
            buildCostPrintout.textContent = "$" + buildCost.toFixed(2);
        }

        this.updateInvalid();
    }

    private updateInvalid() {
        const invalid = [];

        if ([...this.displayNameInput.value].length > 24 || new TextEncoder().encode(this.displayNameInput.value).length >= 128) {
            invalid.push("Display name too long");
        }

        const tooShort = this.displayNameInput.value != "" && new TextEncoder().encode(this.displayNameInput.value).length < 2;
        
        const buildCost = this.computeBuildCost();

        if (this.budget !== undefined && buildCost > this.budget!) {
            invalid.push("Overbudget by $" + (buildCost - this.budget).toFixed(2));
        }

        this.invalid.textContent = invalid.join("\n");

        this.startButton.disabled = !this.netClientOpen || invalid.length > 0 || tooShort;
    }

    public setNetClientOpen() {
        this.netClientOpen = true;
        this.connecting.style.display = "none";

        this.updateInvalid();
    }

    public setNetClientClosed() {
        this.netClientOpen = false;
        this.connecting.style.display = "";

        this.updateInvalid();
    }

    public setBudget(budget: number) {
        this.budget = budget;

        for (const budgetPrintout of this.budgetPrintouts) {
            budgetPrintout.textContent = "$" + budget.toFixed(2);
        }

        this.updateBuildCost();
    }

    public onDropInClicked(fn: (customization: TankCustomization) => void) {
        this.dropInClickedListeners.push(fn);
    }

    public show() {
        this.rootCont.style.display = "";
    }

    public finish() {
        this.rootCont.style.display = "none";
    }
}