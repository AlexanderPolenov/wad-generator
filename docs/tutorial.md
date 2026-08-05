# Quick Guide

## Typical structure

```
// Import stuff
import { Builder, LINE_TYPES, SECTOR_TYPES, THING_TYPES } from "wad-generator";
import { repeat } from "wad-generator/utils";

async function main() {

    // Define config.
    const config = {
        // Forward slashes work fine on Windows and dodge backslash escaping.
        doomEnginePath: "C:/Classic Doom/gzdoom/gzdoom.exe",
        doomEngineArgs: ["+map", "MAP01"],
    };
    
    // Init builder.    
    const builder = new Builder(config);
    
    // Init level.
    const level = builder.initLevel("MAP01", "TEST LEVEL");
    
    // Build your level.
    buildRoom1(level, 0, 0);
    /* more stuff is being built here... */

    // Compile.
    await builder.compile("output.wad");
}

// Define building blocks for your level, compose them as practical.
function buildRoom1(level, x, y) {
    const sideParam = Object.freeze({
        front: {
            middle: "STARTAN2",
        }
    });
    const room = level.buildSector(
        [[x, y], [x, y+256], [x+256, y+256], [x+256, y]],
        [{}, {}, {}, {}],                                   // or `repeat({}, 4),`
        [sideParam, sideParam, sideParam, sideParam],       // or `repeat(sideParam, 4),`
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

// Let's go!
main();
```
Please check the levels/testLevel.js (it's unminified) for complete example.

## Config

For now config supports only optional doom engine path. If provided, you will be asked to run the .wad after compilation.

```
const config = {
    // Forward slashes work fine on Windows and dodge backslash escaping.
    doomEnginePath: "C:/Classic Doom/gzdoom/gzdoom.exe",
    doomEngineArgs: ["+map", "MAP01"],
};
```

## Builder
`Builder` essentially provides just 2 public functions.

### initLevel
`initLevel(slot, name)`, where `slot` - map slot, for example, "MAP01" or "E1M1"; `name` - proposed name for the level (unimplemented and ignored for now).

`initLevel` returns the `Level` object that is essential for starting building your level.

### compile
`compile(filename)`, where `filename` - path to where to save the output .wad file.

`compile` should be called after all levels have been built.


## Level
`Level` object exposes just 4 methods necessary for building your level.

### buildSector
`buildSector` essentially builds the sector from provided array of dots. It returns the package `{vertices, linedefs, sector}` that contains all generated vertices, linedefs and sector for possible post-processing, if required (uncommon, but here you have it).

The method signature.
```
buildSector(
        dots: [x: number, y: number][],
        linesParams: LineParams[],
        sidesParams: SideParams[],
        sectorParams: SectorParams,
        parentSectorIdx?: number | null,
    ) : {
    vertices: Vertex[];
    linedefs: Linedef[];
    sector: Sector;
};
```

`dots` - Array of [x, y] pairs, at least 3. The polygon is closed for you: the last dot connects back to the first, so dots.length is also the number of edges.
I highly recommend to build sector clockwise starting from the left bottom corner (or from point closest to it in axis-aligned bounding box).
Coordinates must be whole numbers in the int16 range (-32768..32767).

`linesParams` - An array of objects, same length as dots. Entry `i` describes the edge from `dots[i]` to `dots[i + 1]`. Use {} for a plain wall. All fields optional:

- `type` - Line special, from `LINE_TYPES`, default `0`.
- `tag` - Sector tag the special acts on, default `0`.
- `flags` - An object where you can assign flags to the linedef as:
```
interface LinedefFlags {
    impassable: boolean;
    monsterBlocking: boolean;
    doubleSided: boolean;
    upperUnpegged: boolean;
    lowerUnpegged: boolean;
    secret: boolean;
    soundBlocking: boolean;
    alwaysHideOnAutomap: boolean;
    alwaysShowOnAutomap: boolean;
    passThru: boolean;          // Boom only.
}
```
Keep in mind, that `buildSector` resolves `impassable` and `doubleSided` flags automatically.
Linedefs that neighboring the void will be automatically made impassable.
If new sector shares the line with existing sector, the shared portion of the line will be automatically converted to "passable" and doubleSided.
Thus, you only need to provide `impassable` and `doubleSided` flags if you want to override that behavior, for example you are trying to create invisible wall.
Most of your `buildSector` calls will provide `lineParams` as an array of empty objects, especially, when you just start to create the general layout of the level, because the most of the sectors don't do anything.

`sideParams` - An array of objects, same length as dots. Entry `i` describes the sidedefs to be assigned to each line:

- `front` (required) - describes sidedef for the front of the linedef.
- `back` (optional) - describes sidedef for the front of the linedef.

`front` and `back` sub-objects share the following structure:

`{ upper, middle, lower, xoff, yoff }`, where `upper`, `middle` and `lower` are corresponding texture names; `xoff` and `yoff` are horizontal and vertical texture offsets accordingly.

`sectorParams` - An object with sector params. Params are:

| Field | Required | Meaning |
|---|---|---|
| `floor` | yes | Floor flat name |
| `ceil` | yes | Ceiling flat name |
| `floorHeight` | yes | Floor height |
| `ceilHeight` | yes | Ceiling height |
| `light` | yes | Light level, 0–255 |
| `type` | no | Sector special from `SECTOR_TYPES`, default `0` |
| `tag` | no | Tag targeted by line specials, default `0` |

`parentSectorIdx` - The sector index of the parent sector. If you are going to build the sector inside another sector, you must provide the index of the outer sector.
You can assign the output of every `buildSector` call to some variable to access the indexes of previously created sectors.

### placeTrigger
This function is meant to create a lone standing linedefs that don't bound any sector. Those lines are often used as invisible walkover triggers (also known as free-standing triggers).
Returns the Linedef object created.

The method signature:
```
placeTrigger(from, to, sectorIdx, lineParams = {})
```

`from` - Starting point of linedef as array [x, y].

`to` - End point of linedef as array [x, y].

`sectorIdx` - parent (outer) sector index.

`lineParams` - a single entry of line params. See the `buildSector` description for the shape of that object. Since you are doing the trigger (most likely), in most cases you want to provide `type` and `tag` here.

### placeFloatingTexture

Very similar to `placeTrigger`, but also assigns a middle secture for both frone and back sidedef. Can be used to create passable or impassable decorative elements like vines fences or even rain.

The method signature:

```
placeFloatingTexture(from, to, sectorIdx, lineParams = {}, texture)
```

See the placeTrigger section for arguments description.

### placeThing
Places thing (i.e. item, weapon, powerup, monster, decoration, player start) at provided coordinates. Returns the Thing instance.

The method signature:
```
placeThing(x, y, type, angle)
```
`x` and `y` are coordinates to place.

`type` - Thing type. Please utilize THING_TYPES constant.

`angle` - Thing rotation angle. Provided as degrees from 0 to 359, where 0 is facing east. Rotation goes counter-clockwise.

### Putting things together
This is bare minimum example of what we just discussed regarding level methods.

This example includes:

1. Rectangle empty room.
2. Player start.
3. Broken sticking from the top and bottom of that room. Pillar has a gap in it.
4. Walk-over trigger that lowers the bottom part of the pillar.


```
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
}
```

## Misc
`utils.js` have some useful helpers to make your scripts shorter when applicable. There are no prefabs and geometry shape generators though, create your own when practical.

`Vertex`, `Linedef`, `Sector` and `Thing` instances contain some helper methods and debugging methods.
However, you must never instantiate those classes manually, because in that case they will not be registered in the level. Use only level methods for building.

Please always utilize enums `LINE_TYPES`, `SECTOR_TYPES`, `THING_TYPES` from `constants.js` for linedef types, sector types and thing types accordingly. This is essential for readability and debugging.
