// Copyright (c) Alexander Polenov
export default class Vertex {
    constructor(idx, x, y) {
        this.idx = idx;
        this.x = x;
        this.y = y;
    }

    asArray() {
        return [this.x, this.y];
    }
}