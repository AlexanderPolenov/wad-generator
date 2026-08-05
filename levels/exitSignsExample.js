// Copyright (c) Alexander Polenov
import Builder from "../mainObjects/builder.js";
import {LINE_TYPES, THING_TYPES} from "../mainObjects/constants.js";
import {repeat} from "../mainObjects/utils.js";


function buildFloorExitSign(level, x, y, parentSectorIdx) {
    const signX = x + 470;
    const signY = y + 150;

    const exitFace = {
        front: {
            lower: "EXITSIGN"
        }
    }

    const exitSide = {
        front: {
            lower: "EXITSIGN",
            xoff: 32,
        }
    }

    level.buildSector(
        [[signX, signY], [signX, signY + 32], [signX + 8, signY + 32], [signX + 8, signY]],
        repeat({}, 4),
        [exitFace, exitSide, exitFace, exitSide],
        {
            ceil: "CEIL3_5",
            floor: "FLOOR0_3",
            ceilHeight: 128,
            floorHeight: 16,
            light: 150,
        },
        parentSectorIdx,
    );
}

function buildCeilExitSign(level, x, y, parentSectorIdx) {
    const signX = x + 470;
    const signY = y + 274;

    const exitFace = {
        front: {
            upper: "EXITSIGN"
        }
    }

    const exitSide = {
        front: {
            upper: "EXITSIGN",
            xoff: 32,
        }
    }

    level.buildSector(
        [[signX, signY], [signX, signY + 32], [signX + 8, signY + 32], [signX + 8, signY]],
        repeat({}, 4),
        [exitFace, exitSide, exitFace, exitSide],
        {
            ceil: "CEIL3_5",
            floor: "FLOOR4_8",
            ceilHeight: 112,
            floorHeight: 0,
            light: 150,
        },
        parentSectorIdx,
    );
}

function buildWallExitSign(level, x, y) {
    const signX = x + 512;
    const signY = y + 150;

    const exitFace = {
        front: {
            middle: "EXITSIGN"
        }
    }

    const exitSide = {
        front: {
            middle: "EXITSIGN",
            xoff: 32,
        }
    }

    level.buildSector(
        [[signX, signY], [signX, signY + 32], [signX + 8, signY + 32], [signX + 8, signY]],
        repeat({}, 4),
        [exitFace, exitSide, exitFace, exitSide],
        {
            ceil: "CEIL3_5",
            floor: "FLOOR0_3",
            ceilHeight: 48,
            floorHeight: 32,
            light: 150,
        },
    );
}

function buildRoom1(level, x, y) {
    const sideParam = Object.freeze({
        front: {
            middle: "GRAY1",
        }
    });
    const room = level.buildSector(
        [[x, y], [x, y+448], [x+512, y+448], [x+512, y]],
        [{}, {}, {}, {}],
        [sideParam, sideParam, sideParam, sideParam],
        {
            ceil: "CEIL3_5",
            floor: "FLOOR4_8",
            ceilHeight: 128,
            floorHeight: 0,
            light: 150,
        }
    );

    const exitAlcoveX = x + 512;
    const exitAlcoveY = y + 192;

    const exitLineDef = {
        type: LINE_TYPES.s1ExitNormal,
    };

    const exitSideDef = {
        front: {
            middle: "SW1GRAY1",
        },
    };

    const exitAlcove = level.buildSector(
        [[exitAlcoveX, exitAlcoveY], [exitAlcoveX, exitAlcoveY + 64], [exitAlcoveX + 8, exitAlcoveY + 64], [exitAlcoveX + 8, exitAlcoveY]],
        [{}, {}, exitLineDef, {}],
        [sideParam, sideParam, exitSideDef, sideParam],
        {
            ceil: "CEIL3_5",
            floor: "FLOOR4_8",
            ceilHeight: 128,
            floorHeight: 0,
            light: 150,
        }
    );

    buildFloorExitSign(level, x, y, room.sector.idx);
    buildCeilExitSign(level, x, y, room.sector.idx);
    buildWallExitSign(level, x, y);

    level.placeThing(x+64, y+64, THING_TYPES.player1Start);

}

async function main() {
    const config = {
        // Forward slashes work fine on Windows and dodge backslash escaping.
        doomEnginePath: "C:/Classic Doom/gzdoom/gzdoom.exe",
        doomEngineArgs: ["+map", "MAP01"],
    };
    const builder = new Builder(config);
    const level = builder.initLevel("MAP01", "TEST LEVEL");
    buildRoom1(level, 0, 0);

    await builder.compile("exitSignsExample.wad");
}

main();