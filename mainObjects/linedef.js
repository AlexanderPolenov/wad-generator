// Copyright (c) Alexander Polenov
export class Linedef {
    constructor(idx, from, to) {
        this.idx = idx;
        this.from = from;
        this.to = to;
        this.front = null;
        this.back = null;
        this.flags = {
            impassable: true,
            monsterBlocking: false,
            doubleSided: false,
            upperUnpegged: false,
            lowerUnpegged: false,
            secret: false,
            soundBlocking: false,
            alwaysHideOnAutomap: false,
            alwaysShowOnAutomap: false,
            passThru: false, // Boom-only.
        };
        this.type = 0;
        this.tag = 0;
    }

    composeFlagsDec() {
        return (
            this.flags.impassable * 1
            + this.flags.monsterBlocking * 2
            + this.flags.doubleSided * 4
            + this.flags.upperUnpegged * 8
            + this.flags.lowerUnpegged * 16
            + this.flags.secret * 32
            + this.flags.soundBlocking * 64
            + this.flags.alwaysHideOnAutomap * 128
            + this.flags.alwaysShowOnAutomap * 256
            + this.flags.passThru * 512
        );
    }

    composeFlagsBin() {
        return this.composeFlagsDec().toString(2).padStart(10, '0');
    }

    composeFlagsHex() {
        return `0x${this.composeFlagsDec().toString(16).toUpperCase().padStart(3, '0')}`;
    }

    // Swaps which physical side each sector is on. The line keeps its direction,
    // so this is a repair for sidedefs attached to the wrong sides.
    flipSides() {
        if (!this.back) {
            throw new Error(`Cannot flip sides of a one-sided line ${this.idx}: it would be left without a front.`);
        }
        [this.front, this.back] = [this.back, this.front];
    }

    // Reverses the direction of the line. The sidedefs move with it, so the map
    // looks identical, only the facing changed (critical for triggers).
    flip() {
        [this.from, this.to] = [this.to, this.from];
        [this.front, this.back] = [this.back, this.front];
    }
}