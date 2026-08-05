// Copyright (c) Alexander Polenov
export class Sector {
    constructor(idx, ceil, floor, ceilHeight, floorHeight, light) {
        this.idx = idx;
        this.ceil = ceil;
        this.floor = floor;
        this.ceilHeight = ceilHeight;
        this.floorHeight = floorHeight;
        this.light = light;
        this.type = 0;
        this.tag = 0;
        this.isInnerSector = false;
    }

    get height() {
        return this.ceilHeight - this.floorHeight;
    }
}