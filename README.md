Wad Generator is a Node.js-based library for the construction of maps for classic Doom and Doom II. Wad Generator exposes just a few methods, but the whole power of JavaScript can be used to generate level geometry.

# Quick Start

1. Install NodeJS if you don't have it yet: https://nodejs.org/

2. Create the folder for your new WAD project, then open your terminal in that folder.
3. Initialize a new Node.js project:
```
npm init
```
then follow prompts. At the end the `package.json` file will appear in your folder.

4. Install Wad Generator into your project:
```
npm install wad-generator
```
5. Create a new JavaScript file in your folder, for example, `myLevel.js`. Paste the following content there (for a quick test):
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
You will need to change the path to your Doom engine in the code above.

6. Run the code by typing in the terminal:
```
node myLevel.js
```
The `output.wad` will appear in the folder. Also, if you included the path to the doom engine, you will be asked to immediately run the .wad to playtest it.

# Main features
Wad Generator automatically resolves shared linedefs between the sectors.
If you want to connect two sectors just add the new sector right next to the previous one, so they share the line.
That line will be automatically made passable and double-sided, so, two sectors will be connected, and you can travel through them (if height difference permits).
You can always override this behavior by passing explicit linedef flags to `buildSector` function. Please see [docs/tutorial.md](docs/tutorial.md) for the full reference.

If you want to build a sector inside another sector, please provide the parent sector's index as the last parameter in `buildSector`. Please see [docs/tutorial.md](docs/tutorial.md) for the full reference.

The [levels](levels) folder contains some minimalistic technical examples of how you can connect sectors.

Wad Generator does integrity checks on every `buildSector` call and throws an error if an obvious mistake is made, like attempt to create overlapping sector. It should help you debug your scripts.

