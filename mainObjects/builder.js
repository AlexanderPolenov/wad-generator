// Copyright (c) Alexander Polenov
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import Level from "./level.js";

const EMPTY = Buffer.alloc(0);

export default class Builder {
    constructor(config = {}) {
        this.levels = {};
        this.doomEnginePath = config.doomEnginePath || null;
        // Anything extra the engine needs, e.g. ["+map", "MAP01"] to drop
        // straight into the level instead of stopping at the title screen.
        this.doomEngineArgs = config.doomEngineArgs || [];
    }

    initLevel(slot, name) {
        if (!this.levels[slot]) {
            const newLevel = new Level(slot, name);
            this.levels[slot] = newLevel;
            return newLevel;
        }
        throw new Error(`Level ${slot} already exists`);
    }

    async compile(fileName) {
        const lumps = [];
        const slots = Object.keys(this.levels);
        for (let i = 0; i < slots.length; i++) {
            lumps.push(...this._compileLevel(this.levels[slots[i]]));
        }
        writeFileSync(fileName, this._buildWad(lumps));
        await this._offerToRun(fileName);
    }

    async _offerToRun(fileName) {
        if (!this.doomEnginePath) {
            return false;
        }

        const wadPath = resolve(fileName);
        if (!process.stdin.isTTY) {
            console.log(`Wrote ${wadPath}. Skipping the run prompt: no interactive terminal.`);
            return false;
        }

        const rl = createInterface({ input: process.stdin, output: process.stdout });
        let answer;
        try {
            answer = await rl.question(`Wrote ${wadPath}\nRun it in ${this.doomEnginePath}? [y/N] `);
        } finally {
            rl.close();
        }

        if (!/^y(es)?$/i.test(answer.trim())) {
            return false;
        }

        try {
            const code = await this._runEngine(wadPath);
            if (code !== 0) {
                console.log(`Engine exited with code ${code}.`);
            }
        } catch (error) {
            console.error(error.message);
            return false;
        }
        return true;
    }

    _runEngine(wadPath) {
        const args = ["-file", wadPath].concat(this.doomEngineArgs);
        console.log(`> ${this.doomEnginePath} ${args.join(" ")}`);

        return new Promise(function (resolve, reject) {
            const child = spawn(this.doomEnginePath, args, { stdio: "inherit" });
            child.on("error", function (error) {
                reject(new Error(`Could not start the Doom engine at ${this.doomEnginePath}: ${error.message}`));
            }.bind(this));
            child.on("close", function (code) {
                resolve(code);
            });
        }.bind(this));
    }

    // Turn one Level into its ordered list of { name, data } lumps.
    _compileLevel(level) {
        // Sidedefs live on the linedefs (front/back). Flatten them into a single
        // indexed array so linedefs can reference them by position.
        const sidedefs = [];
        const sideIndex = new Map();
        for (let i = 0; i < level.linedefs.length; i++) {
            const sides = [level.linedefs[i].front, level.linedefs[i].back];
            for (let j = 0; j < sides.length; j++) {
                const side = sides[j];
                if (side && !sideIndex.has(side)) {
                    sideIndex.set(side, sidedefs.length);
                    sidedefs.push(side);
                }
            }
        }

        return [
            { name: level.slot, data: EMPTY }, // map marker
            { name: "THINGS", data: this._buildThings(level.things) },
            { name: "LINEDEFS", data: this._buildLinedefs(level.linedefs, sideIndex) },
            { name: "SIDEDEFS", data: this._buildSidedefs(sidedefs) },
            { name: "VERTEXES", data: this._buildVertexes(level.vertices) },
            { name: "SEGS", data: EMPTY },
            { name: "SSECTORS", data: EMPTY },
            { name: "NODES", data: EMPTY },
            { name: "SECTORS", data: this._buildSectors(level.sectors) },
            { name: "REJECT", data: EMPTY },
            { name: "BLOCKMAP", data: EMPTY },
        ];
    }

    // THINGS: 10 bytes each — x, y, angle, type, flags (all int16).
    _buildThings(things) {
        const buf = Buffer.alloc(things.length * 10);
        for (let i = 0; i < things.length; i++) {
            const t = things[i];
            const o = i * 10;
            buf.writeInt16LE(t.x, o);
            buf.writeInt16LE(t.y, o + 2);
            buf.writeInt16LE(t.angle ?? 0, o + 4);
            buf.writeInt16LE(t.type, o + 6);
            buf.writeUInt16LE(t.composeFlagsDec(), o + 8);
        }
        return buf;
    }

    // LINEDEFS: 14 bytes each — start, end, flags, special, tag, front, back.
    // A missing sidedef is encoded as -1 (0xFFFF).
    _buildLinedefs(linedefs, sideIndex) {
        const buf = Buffer.alloc(linedefs.length * 14);
        for (let i = 0; i < linedefs.length; i++) {
            const l = linedefs[i];
            const o = i * 14;
            buf.writeInt16LE(l.from.idx, o);
            buf.writeInt16LE(l.to.idx, o + 2);
            buf.writeUInt16LE(l.composeFlagsDec(), o + 4);
            buf.writeInt16LE(l.type ?? 0, o + 6);
            buf.writeInt16LE(l.tag ?? 0, o + 8);
            buf.writeInt16LE(l.front ? sideIndex.get(l.front) : -1, o + 10);
            buf.writeInt16LE(l.back ? sideIndex.get(l.back) : -1, o + 12);
        }
        return buf;
    }

    // SIDEDEFS: 30 bytes each — x/y offset, upper/lower/middle texture, sector.
    _buildSidedefs(sidedefs) {
        const buf = Buffer.alloc(sidedefs.length * 30);
        for (let i = 0; i < sidedefs.length; i++) {
            const s = sidedefs[i];
            const o = i * 30;
            buf.writeInt16LE(s.xoff ?? 0, o);
            buf.writeInt16LE(s.yoff ?? 0, o + 2);
            this._writeTexture(buf, s.upper, o + 4);
            this._writeTexture(buf, s.lower, o + 12);
            this._writeTexture(buf, s.middle, o + 20);
            buf.writeInt16LE(s.sectorIdx, o + 28);
        }
        return buf;
    }

    // VERTEXES: 4 bytes each — x, y (int16).
    _buildVertexes(vertices) {
        const buf = Buffer.alloc(vertices.length * 4);
        for (let i = 0; i < vertices.length; i++) {
            const v = vertices[i];
            const o = i * 4;
            buf.writeInt16LE(v.x, o);
            buf.writeInt16LE(v.y, o + 2);
        }
        return buf;
    }

    // SECTORS: 26 bytes each — floor/ceil height, floor/ceil texture, light,
    // special, tag.
    _buildSectors(sectors) {
        const buf = Buffer.alloc(sectors.length * 26);
        for (let i = 0; i < sectors.length; i++) {
            const s = sectors[i];
            const o = i * 26;
            buf.writeInt16LE(s.floorHeight, o);
            buf.writeInt16LE(s.ceilHeight, o + 2);
            this._writeTexture(buf, s.floor, o + 4);
            this._writeTexture(buf, s.ceil, o + 12);
            buf.writeInt16LE(s.light, o + 20);
            buf.writeInt16LE(s.type ?? 0, o + 22);
            buf.writeInt16LE(s.tag ?? 0, o + 24);
        }
        return buf;
    }

    // Assemble lumps into a PWAD: 12-byte header, lump data, then the directory.
    _buildWad(lumps) {
        const HEADER = 12;
        const DIR_ENTRY = 16;
        let dataSize = 0;
        for (let i = 0; i < lumps.length; i++) {
            dataSize += lumps[i].data.length;
        }
        const dirOffset = HEADER + dataSize;
        const buf = Buffer.alloc(dirOffset + lumps.length * DIR_ENTRY);

        buf.write("PWAD", 0, 4, "ascii");
        buf.writeInt32LE(lumps.length, 4);
        buf.writeInt32LE(dirOffset, 8);

        let dataPtr = HEADER;
        let dirPtr = dirOffset;
        for (let i = 0; i < lumps.length; i++) {
            const lump = lumps[i];
            lump.data.copy(buf, dataPtr);
            buf.writeInt32LE(dataPtr, dirPtr);
            buf.writeInt32LE(lump.data.length, dirPtr + 4);
            this._writeName(buf, lump.name, dirPtr + 8);
            dataPtr += lump.data.length;
            dirPtr += DIR_ENTRY;
        }
        return buf;
    }

    // Write an 8-byte, uppercase, null-padded name (lump or directory name).
    _writeName(buf, name, offset) {
        const text = String(name).toUpperCase().slice(0, 8);
        buf.write(text, offset, 8, "ascii");
    }

    // Like _writeName, but an empty/missing texture becomes "-" (Doom's "no texture").
    _writeTexture(buf, name, offset) {
        this._writeName(buf, name ? name : "-", offset);
    }
}
