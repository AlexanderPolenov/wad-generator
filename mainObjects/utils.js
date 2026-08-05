// Copyright (c) Alexander Polenov

// Useful for sectors where all lineParams or sideParams are identical.
// For example, instead of passing `[sideParam, sideParam, sideParam, sideParam]`,
// you can do `repeat(sideParam, 4)`.
export function repeat(value, times) {
    return new Array(times).fill(value);
}
