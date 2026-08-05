// Copyright (c) Alexander Polenov
import Vertex from "./vertex.js";
import { Linedef } from "./linedef.js";
import { Sector } from "./sector.js";
import Sidedef from "./sidedef.js";
import { Thing } from "./thing.js";


export default class Level {
    constructor(slot, name) {
        this.slot = slot;
        this.name = name;
        this.vertices = [];
        this.linedefs = [];
        this.sectors = [];
        this.things = [];

        // Lookup from packed coordinate to vertex. Hidden from enumeration so
        // it does not double every vertex in a util.inspect dump.
        Object.defineProperty(this, "_vertexIndex", { value: new Map(), enumerable: false });
    }

    buildSector(dots, linesParams, sidesParams, sectorParams, parentSectorIdx = null) {
        this._verifySectorInputParams(dots, linesParams, sidesParams, sectorParams);
        const vertices = dots.map(function (dot) {
            return this._getOrCreateVertex(...dot);
        }.bind(this));

        const sector = new Sector(this.sectors.length, sectorParams.ceil, sectorParams.floor, sectorParams.ceilHeight, sectorParams.floorHeight, sectorParams.light);
        sector.type = sectorParams.type ?? 0;
        sector.tag = sectorParams.tag ?? 0;
        sector.isInnerSector = parentSectorIdx !== null;
        this.sectors.push(sector);

        // Clockwise dots keep the interior on the right-hand side of every edge,
        // which is the side Doom calls the front.
        const clockwise = this._signedArea(dots) < 0;

        const linedefs = [];
        for (let i = 0; i < vertices.length; i++) {
            const next = (i + 1) % vertices.length;

            // An edge that runs along walls already on the map is cut into
            // stretches: the ones that lie on top of an existing wall reuse it
            // instead of laying a second line over the top.
            const spans = this._planEdge(vertices[i], vertices[next]);

            for (let s = 0; s < spans.length; s++) {
                const span = spans[s];
                let line;

                if (span.line) {
                    line = span.line;
                    this._shareLine(line, sector, sidesParams[i], span.from, span.to, clockwise, parentSectorIdx);
                } else {
                    line = new Linedef(this.linedefs.length, span.from, span.to);

                    // Make child inner sectors passable by default. It will be overridden if flag is provided in linesParams.
                    line.flags.impassable = parentSectorIdx === null;

                    this._resolveSidedefs(line, sidesParams[i], sector, parentSectorIdx, clockwise);
                    line.type = linesParams[i].type ?? 0;
                    line.tag = linesParams[i].tag ?? 0;
                    this.linedefs.push(line);
                }

                // Whatever the caller asked for wins over the defaults. A reused line keeps its own type and tag unless told otherwise.
                Object.assign(line.flags, linesParams[i].flags);
                if (linesParams[i].type !== undefined) {
                    line.type = linesParams[i].type;
                }
                if (linesParams[i].tag !== undefined) {
                    line.tag = linesParams[i].tag;
                }

                // The flags have settled by now, so the upper can be lined up
                // with the wall it carries on from.
                this._alignUpperTexture(line, sidesParams[i], sector);

                linedefs.push(line);
            }
        }

        return {vertices, linedefs, sector};
    }

    placeTrigger(from, to, sectorIdx, lineParams = {}) {
        if (!this.sectors[sectorIdx]) {
            throw new Error(`Sector with index ${sectorIdx} not found or not created yet.`);
        }

        // A trigger reaching through a wall would sit in two sectors at once.
        for (let i = 0; i < this.linedefs.length; i++) {
            const other = this.linedefs[i];
            if (this._segmentsCross(from, to, other.from.asArray(), other.to.asArray())) {
                throw new Error(`Trigger line (${from[0]},${from[1]})-(${to[0]},${to[1]}) crosses linedef ${other.idx}.`);
            }
        }

        const fromVertex = this._getOrCreateVertex(...from);
        const toVertex = this._getOrCreateVertex(...to);
        if (fromVertex === toVertex) {
            throw new Error(`Trigger line needs two different ends, got (${from[0]}, ${from[1]}) twice.`);
        }

        const line = new Linedef(this.linedefs.length, fromVertex, toVertex);
        line.flags.impassable = false;
        line.flags.doubleSided = true;
        Object.assign(line.flags, lineParams.flags);
        line.type = lineParams.type ?? 0;
        line.tag = lineParams.tag ?? 0;

        // Bare on both sides. A middle texture here would hang in mid-air.
        line.front = new Sidedef(sectorIdx);
        line.back = new Sidedef(sectorIdx);

        this.linedefs.push(line);
        return line;
    }

    placeThing(x, y, type, angle) {
        const thing = new Thing(this.things.length, x, y, type, angle);
        this.things.push(thing);
    }

    placeFloatingTexture(from, to, sectorIdx, lineParams = {}, texture) {
        if (typeof texture !== "string" || !texture) {
            throw new Error(`placeFloatingTexture needs a texture name, got ${JSON.stringify(texture)}. Arguments are (from, to, sectorIdx, lineParams, texture).`);
        }

        const floorPegged = {
            ...lineParams,
            flags: { lowerUnpegged: true, ...lineParams.flags },
        };

        const linedef = this.placeTrigger(from, to, sectorIdx, floorPegged);
        linedef.front.middle = texture;
        linedef.back.middle = texture;
        return linedef;
    }

    _getOrCreateVertex(x, y) {
        const key = this._vertexKey(x, y);
        const existing = this._vertexIndex.get(key);
        if (existing) {
            return existing;
        }

        const newVertex = new Vertex(this.vertices.length, x, y);
        this.vertices.push(newVertex);
        this._vertexIndex.set(key, newVertex);
        return newVertex;
    }

    _vertexKey(x, y) {
        if (!Number.isInteger(x) || !Number.isInteger(y)
            || x < -32768 || x > 32767 || y < -32768 || y > 32767) {
            throw new Error(`Vertex (${x}, ${y}) is not a whole number within the -32768..32767 range Doom stores coordinates in.`);
        }
        return (x << 16) | (y & 0xFFFF);
    }

    // Walks the edge a -> b and reports it as a run of spans. A span either
    // names an existing linedef that covers that stretch, or has line === null
    // where the edge runs through open space and a wall still has to be made.
    _planEdge(a, b) {
        const denom = this._param(a, b, b);
        const overlaps = [];

        // Splitting appends to this.linedefs, and those halves are collinear
        // too, so the candidates are collected before anything is cut.
        const existing = this.linedefs.slice();
        for (let i = 0; i < existing.length; i++) {
            const line = existing[i];
            if (this._cross(a.asArray(), b.asArray(), line.from.asArray()) !== 0
                || this._cross(a.asArray(), b.asArray(), line.to.asArray()) !== 0) {
                continue;
            }

            // Both lines lie on the same infinite line, so how far along a -> b
            // each end sits is enough to find the shared stretch.
            const tFrom = this._param(a, b, line.from);
            const tTo = this._param(a, b, line.to);
            const lo = Math.max(0, Math.min(tFrom, tTo));
            const hi = Math.min(denom, Math.max(tFrom, tTo));

            // Meeting at a single point is a corner, not a shared wall.
            if (hi <= lo) {
                continue;
            }
            overlaps.push({ lo, hi, line, tFrom, tTo });
        }

        overlaps.sort(function (x, y) { return x.lo - y.lo; });

        const spans = [];
        let cursor = 0;
        let cursorVertex = a;
        for (let i = 0; i < overlaps.length; i++) {
            const overlap = overlaps[i];
            if (overlap.lo < cursor) {
                throw new Error(`Existing linedefs overlap each other along the new edge (${a.x},${a.y})-(${b.x},${b.y}).`);
            }

            // The ends of a shared stretch are always ends of one of the two
            // lines, so no new coordinate ever has to be worked out.
            const vLo = this._vertexAtParam(a, b, overlap, overlap.lo, denom);
            const vHi = this._vertexAtParam(a, b, overlap, overlap.hi, denom);

            if (overlap.lo > cursor) {
                spans.push({ from: cursorVertex, to: vLo, line: null });
            }
            spans.push({ from: vLo, to: vHi, line: this._isolateOverlap(overlap.line, vLo, vHi) });

            cursor = overlap.hi;
            cursorVertex = vHi;
        }
        if (cursor < denom) {
            spans.push({ from: cursorVertex, to: b, line: null });
        }
        return spans;
    }

    // Cuts the line down until it spans exactly vLo -> vHi and returns that
    // piece. The offcuts stay on the map as linedefs of their own.
    _isolateOverlap(line, vLo, vHi) {
        let piece = line;

        let tail = this._splitLineAt(piece, vLo);
        if (tail && this._onSegment(tail.from.asArray(), tail.to.asArray(), vHi.asArray())) {
            piece = tail;
        }

        tail = this._splitLineAt(piece, vHi);
        if (tail && this._onSegment(tail.from.asArray(), tail.to.asArray(), vLo.asArray())) {
            piece = tail;
        }
        return piece;
    }

    // Cuts a line in two at a vertex lying on it, keeping the original as the
    // first half and returning the second. Null when the vertex is an end
    // already and there is nothing to cut.
    _splitLineAt(line, vertex) {
        if (line.from === vertex || line.to === vertex) {
            return null;
        }

        const tail = new Linedef(this.linedefs.length, vertex, line.to);
        Object.assign(tail.flags, line.flags);
        tail.type = line.type;
        tail.tag = line.tag;

        // The far half carries on where the near half stopped, so its textures
        // are pushed along by the length that was cut off.
        const shift = Math.round(Math.hypot(vertex.x - line.from.x, vertex.y - line.from.y));
        tail.front = line.front ? this._cloneSidedef(line.front, shift) : null;
        tail.back = line.back ? this._cloneSidedef(line.back, shift) : null;

        line.to = vertex;
        this.linedefs.push(tail);
        return tail;
    }

    _cloneSidedef(side, xoffShift) {
        const copy = new Sidedef(side.sectorIdx, side.upper, side.middle, side.lower, (side.xoff ?? 0) + xoffShift, side.yoff);
        return copy;
    }

    // Hands the new sector the far side of a wall that is already there, and
    // turns that wall into a two-sided opening between the two sectors.
    _shareLine(line, sector, sideParams, spanFrom, spanTo, clockwise, parentSectorIdx = null) {
        if (!line.front) {
            throw new Error(`Line ${line.idx} has no front sidedef to share. Sector: ${sector.idx}`);
        }

        // Resolve connecting two inner sectors under same parent sector.
        if (line.back && line.back.sectorIdx !== parentSectorIdx) {
            throw new Error(`Line ${line.idx} is already shared by two sectors. Sector: ${sector.idx}`);
        }

        // The neighbour sits on the front, so the new sector has to land on the
        // back. If the winding says otherwise the two sectors are on the same
        // side of the wall, which means they overlap.
        const sameDirection = (line.to.x - line.from.x) * (spanTo.x - spanFrom.x)
            + (line.to.y - line.from.y) * (spanTo.y - spanFrom.y) > 0;
        if (sameDirection === clockwise) {
            throw new Error(`Sector ${sector.idx} lands on the same side of line ${line.idx} as sector ${line.front.sectorIdx}. Check the winding of the dots.`);
        }

        const neighbour = this.sectors[line.front.sectorIdx];
        const floorStep = sector.floorHeight - neighbour.floorHeight;
        const ceilStep = sector.ceilHeight - neighbour.ceilHeight;
        const frontParams = sideParams.front;

        const wallTexture = line.front.middle;
        const upper = frontParams?.upper ?? line.front.upper ?? wallTexture;
        const lower = frontParams?.lower ?? line.front.lower ?? wallTexture;

        if (floorStep !== 0 && !lower) {
            throw new Error(`Missing lower texture for shared line ${line.idx}. Sector: ${sector.idx}`);
        }
        if (ceilStep !== 0 && !upper) {
            throw new Error(`Missing upper texture for shared line ${line.idx}. Sector: ${sector.idx}`);
        }

        // A middle texture on a two-sided line hangs in the opening, so the
        // neighbour's wall texture is dropped and only the step is kept.
        line.front.middle = undefined;
        line.front.upper = ceilStep < 0 ? upper : undefined;
        line.front.lower = floorStep > 0 ? lower : undefined;

        // Cutting a wall up shifts the offsets of the offcuts so the neighbour's
        // texture runs on unbroken across them. That shift was measured for that
        // texture, so once the caller replaces it the alignment starts over from
        // whatever they asked for.
        const frontOverridden = (ceilStep < 0 && frontParams?.upper !== undefined)
            || (floorStep > 0 && frontParams?.lower !== undefined);
        if (frontOverridden) {
            line.front.xoff = frontParams.xoff ?? 0;
            line.front.yoff = frontParams.yoff ?? 0;
        }

        line.back = new Sidedef(
            sector.idx,
            ceilStep > 0 ? upper : undefined,
            undefined,
            floorStep < 0 ? lower : undefined,
            frontParams?.xoff,
            frontParams?.yoff
        );

        line.flags.doubleSided = true;
        line.flags.impassable = false;
        return line;
    }

    // This function tries to automatically resolve 'yoff' when sectors of different heights connect,
    // If the result is not satisfactory, the user can adjust it manually on linedefs returned by 'buildSector'
    _alignUpperTexture(line, sideParams, sector) {
        // An unpegged upper already hangs from the ceiling that shows it, and a
        // one-sided wall has no upper at all.
        if (!line.back || line.flags.upperUnpegged) {
            return;
        }

        const frontSector = this.sectors[line.front.sectorIdx];
        const backSector = this.sectors[line.back.sectorIdx];
        const ceilStep = frontSector.ceilHeight - backSector.ceilHeight;
        if (ceilStep === 0) {
            return;
        }

        // Only the sector with the higher ceiling can see the upper.
        const side = ceilStep > 0 ? line.front : line.back;

        // Offsets the caller passed belong to the sector being built, so if
        // that is the side showing the upper their number stands.
        if (side.sectorIdx === sector.idx && sideParams?.front?.yoff !== undefined) {
            return;
        }

        side.yoff = Math.abs(ceilStep);
    }

    // How far along a -> b the point p sits, as an unscaled projection. Zero at
    // a and _param(a, b, b) at b, so the values stay exact integers.
    _param(a, b, p) {
        return (b.x - a.x) * (p.x - a.x) + (b.y - a.y) * (p.y - a.y);
    }

    _vertexAtParam(a, b, overlap, t, denom) {
        if (t === 0) {
            return a;
        }
        if (t === denom) {
            return b;
        }
        return t === overlap.tFrom ? overlap.line.from : overlap.line.to;
    }

    // Front and back are not labels to assign: Doom defines the front as the
    // right-hand side of the walk from the linedef's start vertex to its end,
    // so the winding of the dots decides it and this only fills them in.
    _resolveSidedefs(linedef, sideParams, sector, parentSectorIdx = null, clockwise = true) {
        const frontParams = sideParams.front;

        // Regular sector. A room that is not connected to anything.
        if (parentSectorIdx === null) {
            if (!frontParams) {
                throw new Error(`Sidedef is undefined or incomplete. Sector: ${sector.idx}. Line: ${linedef.idx}`);
            }
            const frontSide = new Sidedef(sector.idx, frontParams.upper, frontParams.middle, frontParams.lower, frontParams.xoff, frontParams.yoff);
            frontSide.sectorIdx = sector.idx;
            linedef.front = frontSide;
            return linedef;
        }

        if (!this.sectors[parentSectorIdx]) {
            throw new Error(`Sector with index ${parentSectorIdx} not found or not created yet.`);
        }

        // We are building sector inside other sector. Such a wall borders two
        // real sectors, so it needs both sidedefs: one looking into the child,
        // one looking back into the parent.
        const parentSector = this.sectors[parentSectorIdx];
        const floorStep = sector.floorHeight - parentSector.floorHeight;
        const ceilStep = sector.ceilHeight - parentSector.ceilHeight;

        if (floorStep !== 0 && !frontParams?.lower) {
            throw new Error(`Missing lower texture for line ${linedef.idx}. Sector: ${sector.idx}`);
        }
        if (ceilStep !== 0 && !frontParams?.upper) {
            throw new Error(`Missing upper texture for line ${linedef.idx}. Sector: ${sector.idx}`);
        }

        // A step is only visible from the side that looks up at it, so the
        // texture belongs to the sector with the lower floor or the higher
        // ceiling. The opposite side stays bare and renders as "-".
        // floorStep > 0 is a post and < 0 a pit; ceilStep < 0 hangs down from
        // the ceiling and > 0 opens a hole in it.
        const innerSide = new Sidedef(
            sector.idx,
            ceilStep > 0 ? frontParams.upper : undefined,
            frontParams?.middle,
            floorStep < 0 ? frontParams.lower : undefined,
            frontParams?.xoff,
            frontParams?.yoff
        );
        const outerSide = new Sidedef(
            parentSectorIdx,
            ceilStep < 0 ? frontParams.upper : undefined,
            frontParams?.middle,
            floorStep > 0 ? frontParams.lower : undefined,
            frontParams?.xoff,
            frontParams?.yoff
        );

        // Which side is the front follows from the winding alone: clockwise
        // dots leave the child interior on the right.
        linedef.front = clockwise ? innerSide : outerSide;
        linedef.back = clockwise ? outerSide : innerSide;
        linedef.flags.doubleSided = true;

        return linedef;
    }

    // Shoelace formula. A negative area means the dots run clockwise, which
    // puts the polygon interior on the right-hand side of every edge.
    _signedArea(dots) {
        let sum = 0;
        for (let i = 0; i < dots.length; i++) {
            const a = dots[i];
            const b = dots[(i + 1) % dots.length];
            sum += a[0] * b[1] - b[0] * a[1];
        }
        return sum / 2;
    }

    _verifySectorInputParams(dots, linesParams, sidesParams, sectorParams) {
        if (dots.length < 3) {
            throw new Error("Not enough vertices to build the sector. Must have at least 3.");
        } else if (dots.length !== linesParams.length) {
            throw new Error("Incorrect number of linesParams. Must match number of dots.");
        } else if (linesParams.length !== sidesParams.length) {
            throw new Error ("Incorrect number of sidesParams. Must match number of linesParams.");
        } else if (!sectorParams.ceil || !sectorParams.floor || sectorParams.ceilHeight === undefined || sectorParams.floorHeight === undefined || sectorParams.light === undefined) {
            throw new Error("sectorParams are incomplete.");
        } else if (this._selfIntersections(dots)) {
            throw new Error(`Sector lines will intersect. Sector ${this.sectors.length}`);
        } else if (this._foreignIntersections(dots)) {
            throw new Error(`Sector will intersect existing linedefs. Sector ${this.sectors.length}`);
        }
    }

    _selfIntersections(dots) {
        const n = dots.length;
        for (let i = 0; i < n; i++) {
            const a1 = dots[i];
            const a2 = dots[(i + 1) % n];

            if (a1[0] === a2[0] && a1[1] === a2[1]) {
                return true;
            }

            for (let j = i + 1; j < n; j++) {
                const b1 = dots[j];
                const b2 = dots[(j + 1) % n];
                const isNext = j === i + 1;
                const isWrap = i === 0 && j === n - 1;

                if (isNext || isWrap) {
                    // Two lines can only meet in one point unless they are
                    // collinear, so neighbours are fine as long as they do not
                    // double back along each other from their shared vertex.
                    const shared = isNext ? b1 : a1;
                    const endA = isNext ? a1 : a2;
                    const endB = isNext ? b2 : b1;
                    if (this._cross(shared, endA, endB) === 0 && this._dot(shared, endA, endB) > 0) {
                        return true;
                    }
                } else if (this._segmentsIntersect(a1, a2, b1, b2)) {
                    return true;
                }
            }
        }
        return false;
    }

    // Touching is allowed, striking across is not.
    _foreignIntersections(dots) {
        const n = dots.length;
        for (let i = 0; i < n; i++) {
            const a1 = dots[i];
            const a2 = dots[(i + 1) % n];

            for (let j = 0; j < this.linedefs.length; j++) {
                const line = this.linedefs[j];
                const b1 = [line.from.x, line.from.y];
                const b2 = [line.to.x, line.to.y];
                if (this._segmentsCross(a1, a2, b1, b2)) {
                    return true;
                }
            }
        }
        return false;
    }

    // Cross product of (b - a) x (c - a). Its sign tells which side of the
    // line ab the point c falls on, and zero means all three are collinear.
    _cross(a, b, c) {
        return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    }

    // Dot product of (b - a) and (c - a). Positive when b and c point the same
    // way from a.
    _dot(a, b, c) {
        return (b[0] - a[0]) * (c[0] - a[0]) + (b[1] - a[1]) * (c[1] - a[1]);
    }

    // True when the segments p1p2 and p3p4 strike across each other: each one
    // has an endpoint strictly to either side of the other, so they meet in a
    // single point that is inside both. Touching in any way puts a point on a
    // line, which zeroes one of the products and is deliberately not reported.
    _segmentsCross(p1, p2, p3, p4) {
        const d1 = this._cross(p3, p4, p1);
        const d2 = this._cross(p3, p4, p2);
        const d3 = this._cross(p1, p2, p3);
        const d4 = this._cross(p1, p2, p4);

        return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0))
            && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
    }

    // True when the segments p1p2 and p3p4 touch anywhere, endpoints included.
    _segmentsIntersect(p1, p2, p3, p4) {
        if (this._segmentsCross(p1, p2, p3, p4)) {
            return true;
        }

        const d1 = this._cross(p3, p4, p1);
        const d2 = this._cross(p3, p4, p2);
        const d3 = this._cross(p1, p2, p3);
        const d4 = this._cross(p1, p2, p4);

        // Short of a crossing they only touch if an endpoint sits on the other
        // segment, which covers T-shaped contacts and collinear overlaps.
        return (d1 === 0 && this._onSegment(p3, p4, p1))
            || (d2 === 0 && this._onSegment(p3, p4, p2))
            || (d3 === 0 && this._onSegment(p1, p2, p3))
            || (d4 === 0 && this._onSegment(p1, p2, p4));
    }

    // Point c is already known to be collinear with ab, so it lies on the
    // segment exactly when it is inside ab's bounding box.
    _onSegment(a, b, c) {
        return Math.min(a[0], b[0]) <= c[0] && c[0] <= Math.max(a[0], b[0])
            && Math.min(a[1], b[1]) <= c[1] && c[1] <= Math.max(a[1], b[1]);
    }
}