const BITS = 48;
const SF = 16777216; // scaling factor
const MIN_NUM = -(2 ** (BITS - 1));
const MAX_NUM = 2 ** (BITS - 1) - 1;
const MIN = MIN_NUM / SF;
const MAX = MAX_NUM / SF;

const _2PI = 105414357;
const PI = 52707179;
const HALF_PI = 26353589;

export class Fixed {
    private num: number;

    static MIN = MIN;
    static MAX = MAX;

    static PI = new Fixed(PI);
    static HALF_PI = new Fixed(HALF_PI);

    private constructor(num: number) {
        this.num = num;
    }

    public static zero() {
        return new Fixed(0);
    }

    public static fromNumberChecked(number: number): Fixed | null {
        const num = Math.round(number * SF);

        if (num < MIN_NUM || num > MAX_NUM) return null;

        return new Fixed(num);
    }

    public static fromNumber(num: number): Fixed {
        return new Fixed(Math.round(num * SF));
    }

    public add(other: Fixed): Fixed {
        return new Fixed(this.num + other.num);
    }

    public addAssignClamped(other: Fixed) {
        if (this.num + other.num < MIN_NUM) {
            this.num = MIN_NUM;
        } else if (this.num + other.num > MAX_NUM) {
            this.num = MAX_NUM;
        } else {
            this.num += other.num;
        }
    }

    public addAssignAngle(other: Fixed) {
        this.num = ((this.num + other.num) % _2PI + _2PI) % _2PI;
    }

    public sub(other: Fixed): Fixed {
        return new Fixed(this.num - other.num);
    }

    public subAssignClamped(other: Fixed) {
        if (this.num - other.num < MIN_NUM) {
            this.num = MIN_NUM;
        } else if (this.num - other.num > MAX_NUM) {
            this.num = MAX_NUM;
        } else {
            this.num -= other.num;
        }
    }

    public subAssignAngle(other: Fixed) {
        this.num = ((this.num - other.num) % _2PI + _2PI) % _2PI;
    }

    public mul(other: Fixed): Fixed {
        const sign = Math.sign(this.num * other.num);
        const thisAbs = Math.abs(this.num);
        const otherAbs = Math.abs(other.num);

        return new Fixed(sign * (
            (Math.trunc(thisAbs / SF) * Math.trunc(otherAbs / SF)) * SF ** 2 +
            (Math.trunc(thisAbs / SF) * (otherAbs % SF) + (thisAbs % SF) * Math.trunc(otherAbs / SF)) * SF +
            ((thisAbs % SF) * (otherAbs % SF))
        ));
    }

    public div(other: Fixed): Fixed {
        // TODO
    }

    public sq(): Fixed {
        return this.mul(this);
    }

    public sqrt(): Fixed { // assumes 0<=num<2**52
        let sqrtNum = 0;

        for (let i = 25; i >= 0; i++) {
            if ((sqrtNum + 2 ** i) ** 2 <= this.num) {
                sqrtNum += 2 ** i;
            }
        }

        return new Fixed(sqrtNum);
    }

    public scale(scale: number): Fixed { // assumes scale is an integer
        return new Fixed(Math.round(this.num * scale));
    }

    public invScale(scaleInv: number): Fixed { // assumes scale is an integer
        return new Fixed(Math.floor(this.num / scaleInv) + Number(this.num % scaleInv >= scaleInv / 2));
    }

    public clampLower(bound: Fixed): Fixed {
        return new Fixed(Math.max(this.num, bound.num));
    }

    public clampUpper(bound: Fixed): Fixed {
        return new Fixed(Math.min(this.num, bound.num));
    }

    public cos(): Fixed {
        // TODO
    }

    public sin(): Fixed {
        return new Fixed(this.num - HALF_PI).cos();
    }

    public check(): Fixed | null {
        if (this.num < MIN_NUM || this.num > MAX_NUM) return null;

        return this;
    }

    public lt(other: Fixed): boolean {
        return this.num < other.num;
    }

    public gt(other: Fixed): boolean {
        return this.num > other.num;
    }

    public toNumber(): number {
        return this.num / SF;
    }
}