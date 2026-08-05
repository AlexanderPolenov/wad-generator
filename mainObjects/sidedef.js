// Copyright (c) Alexander Polenov
export default class Sidedef {
    constructor(sectorIdx, upper = null, middle = null, lower = null, xoff = 0, yoff = 0) {
        this.sectorIdx = sectorIdx;
        this.upper = upper;
        this.middle = middle;
        this.lower = lower;
        this.xoff = xoff;
        this.yoff = yoff;
    }
}