// Copyright (c) Alexander Polenov
export class Thing {
    constructor(idx, x, y, type, angle = 0) {
        this.idx = idx;
        this.x = x;
        this.y = y;
        this.type = type;
        this.angle = angle;
        this.flags = {
            skillEasy: true,        // skills 1 & 2
            skillNormal: true,      // skill 3
            skillHard: true,        // skills 4 & 5
            ambush: false,          // deaf until it sees the player
            multiplayerOnly: false, // not in single-player
            notInDeathmatch: false, // Boom-only.
            notInCoop: false,       // Boom-only.
            friendly: false,        // MBF-only.
        };
    }

    composeFlagsDec() {
        return (
            this.flags.skillEasy * 1
            + this.flags.skillNormal * 2
            + this.flags.skillHard * 4
            + this.flags.ambush * 8
            + this.flags.multiplayerOnly * 16
            + this.flags.notInDeathmatch * 32
            + this.flags.notInCoop * 64
            + this.flags.friendly * 128
        );
    }

    composeFlagsBin() {
        return this.composeFlagsDec().toString(2).padStart(8, '0');
    }

    composeFlagsHex() {
        return `0x${this.composeFlagsDec().toString(16).toUpperCase().padStart(2, '0')}`;
    }
}
