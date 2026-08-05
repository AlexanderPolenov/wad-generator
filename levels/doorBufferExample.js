// Copyright (c) Alexander Polenov
import Builder from "../mainObjects/builder.js";
import {LINE_TYPES, THING_TYPES} from "../mainObjects/constants.js";
import {repeat} from "../mainObjects/utils.js";

function buildRoom1(level, x, y) {
    const sidedefParams = {
        front: {
            middle: "STARTAN2",
        }
    };

    level.buildSector(
        [[x, y], [x, y+384], [x+448, y+384], [x+448, y]],
        repeat({}, 4),
        repeat(sidedefParams, 4),
        {
            ceil: "CEIL3_1",
            floor: "RROCK09",
            ceilHeight: 260,
            floorHeight: 0,
            light: 160,
        }
    );

    // Door buffer
    const bufferX = x + 448;
    const bufferY = y + 128;

    level.buildSector(
        [[bufferX, bufferY], [bufferX, bufferY + 128], [bufferX + 8, bufferY + 128], [bufferX + 8, bufferY]],
        repeat({}, 4),
        repeat(sidedefParams, 4),
        {
            ceil: "CEIL3_1",
            floor: "RROCK09",
            ceilHeight: 128,
            floorHeight: 0,
            light: 160,
        }
    );

    level.placeThing(x+64, y+64, THING_TYPES.player1Start);
}

function buildRoom2(level, x, y) {
    const sidedefParams = {
        front: {
            middle: "STARTAN2",
        }
    };

    level.buildSector(
        [[x, y], [x, y+384], [x+448, y+384], [x+448, y]],
        repeat({}, 4),
        repeat(sidedefParams, 4),
        {
            ceil: "CEIL3_1",
            floor: "RROCK09",
            ceilHeight: 260,
            floorHeight: 0,
            light: 160,
        }
    );

    // Door buffer
    const bufferX = x - 8;
    const bufferY = y + 128;

    level.buildSector(
        [[bufferX, bufferY], [bufferX, bufferY + 128], [bufferX + 8, bufferY + 128], [bufferX + 8, bufferY]],
        repeat({}, 4),
        repeat(sidedefParams, 4),
        {
            ceil: "CEIL3_1",
            floor: "RROCK09",
            ceilHeight: 128,
            floorHeight: 0,
            light: 160,
        }
    );
}

function buildDoor(level, x, y) {
    const doorTrackLineParams = Object.freeze({
        flags: {
            upperUnpegged: true,
            lowerUnpegged: true,
        },
    });
    const doorTrakSideParam = Object.freeze({
        front: {
            middle: "DOORTRAK",
        }
    });

    const doorSideLineParams = Object.freeze({
        type: LINE_TYPES.drDoor,
    });
    const doorSideParams = Object.freeze({
        front: {
            upper: "BIGDOOR2",
            xoff: 0,
            yoff: 0,
        }
    })
    return level.buildSector(
        [[x, y], [x, y+128], [x+8, y+128],[x+8, y]],
        [doorSideLineParams, doorTrackLineParams, doorSideLineParams, doorTrackLineParams],
        [doorSideParams, doorTrakSideParam, doorSideParams, doorTrakSideParam],
        {
            ceil: "CEIL3_1",
            floor: "RROCK09",
            ceilHeight: 0,
            floorHeight: 0,
            light: 160,
        }
    );
}


async function main() {
    const config = {
        // Forward slashes work fine on Windows and dodge backslash escaping.
        doomEnginePath: "C:/Classic Doom/gzdoom/gzdoom.exe",
        doomEngineArgs: ["+map", "MAP01"],
    };
    const builder = new Builder(config);
    const level = builder.initLevel("MAP01", "DOOR BUFFERS");
    buildRoom1(level, 0, 0);
    buildRoom2(level,472, 0);
    buildDoor(level, 456, 128);

    await builder.compile("doorBufferExample.wad");
}

main();