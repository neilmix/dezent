/*
 * Dezent - Powerful pattern matching and parsing that's readable, recursive, and structured.
 *
 * Copyright (c) 2021 Neil Mix <neilmix@gmail.com>
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE. 
 */

const { exit } = require("process");

let duration = 0;
if (!isNaN(Number(process.argv[2]))) {
    duration = Number(process.argv[2]) * 1000;
}

let start = Date.now();

function write() {
    while (!duration || Date.now() - start <= duration) {
        if (!process.stdout.write(`[${new Date().toISOString()}] ${JSON.stringify(obj())}\n`)) {
            return;
        }
    }
    exit();
}
process.stdout.on("drain", write);
write();

function item() {
    let n = randInt(28);
    if (n == 0) {
        return obj();
    } else if (n == 1) {
        return arr();
    } else if (n < 12) {
        return str();
    } else if (n < 22) {
        return num();
    } else if (n < 27) {
        return bool;
    } else {
        return null;
    }
}

function obj() {
    let o = {};
    repeatRand(10, () => {
        o[str()] = item();
    });
    return o;
}

function arr() {
    let a = [];
    repeatRand(10, () => {
        a.push(item());
    });
    return a;
}

function str() {
    let s = "";
    repeatRand(10, () => {
        s += String.fromCharCode(32 + randInt(127-32));
    });
    return s;
}

function num() {
    return Math.random() * 1000;
}

function bool() {
    return randInt(2) ? true : false;
}

function randInt(n) {
    return Math.floor(Math.random() * n);
}

function repeatRand(n, f) {
    for (var i = 0; i < n; i++) {
        f();
    }
}
