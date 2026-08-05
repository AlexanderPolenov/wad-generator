// Copyright (c) Alexander Polenov
import util from "node:util";
import Builder from "../mainObjects/builder.js";
import {LINE_TYPES, THING_TYPES} from "../mainObjects/constants.js";

// Ties the walkover trigger in room 1 to the pillar it lowers.
const PILLAR_TAG = 1;

function buildRoom1(level, x, y) {
    const sideParam = Object.freeze({
        front: {
            middle: "STARTAN2",
        }
    });
    const room = level.buildSector(
        [[x, y], [x, y+256], [x+256, y+256], [x+256, y]],
        [{}, {}, {}, {}],
        [sideParam, sideParam, sideParam, sideParam],
        {
            ceil: "CEIL3_1",
            floor: "RROCK09",
            ceilHeight: 128,
            floorHeight: 0,
            light: 160,
        }
    );

    level.placeThing(x+64, y+64, THING_TYPES.player1Start);

    const pillarSideParam = Object.freeze({
        front: {
            upper: "STARTAN2",
            lower: "STARTAN2",
        }
    });


    const pillar = level.buildSector(
        [[x+100, y+100], [x+100, y+120], [x+120, y+120], [x+120, y+100]],
        [{}, {}, {}, {}],
        [pillarSideParam, pillarSideParam, pillarSideParam, pillarSideParam],
        {
            ceil: "CEIL3_1",
            floor: "RROCK09",
            ceilHeight: 48,
            floorHeight: 24,
            light: 100,
            tag: PILLAR_TAG,
        },
        room.sector.idx,
    );

    level.placeTrigger(
        [x+80, y+16],
        [x+80, y+240],
        room.sector.idx,
        {
            type: LINE_TYPES.wrLiftAlsoMonsters,
            tag: PILLAR_TAG,
        }
    );

    level.placeFloatingTexture(
        [x+160, y+16],
        [x+160, y+240],
        room.sector.idx,
        {},
        "MIDSPACE",
    )
}

function buildRoom2(level, x, y) {
    const sideParam = Object.freeze({
        front: {
            middle: "STARTAN2",
            upper: "STARTAN2",
            lower: "STARTAN2",
        }
    });

    return level.buildSector(
        [[x, y], [x, y+196], [x+192, y+196], [x+192, y]],
        [{}, {}, {}, {}],
        [sideParam, sideParam, sideParam, sideParam],
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
    const level = builder.initLevel("MAP01", "TEST LEVEL");
    buildRoom1(level, 0, 0);
    buildRoom2(level, 264, 64);
    buildDoor(level, 256, 96);

    console.log(util.inspect(builder.levels, { depth: null, colors: true }));

    await builder.compile("output.wad");
}

main();