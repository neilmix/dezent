#!/usr/bin/env node
"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const Dezent_1 = require("./Dezent");
const process_1 = require("process");
function usage() {
    console.error("usage: dezent [grammar path] [text path]");
    process_1.exit(1);
}
function read(path) {
    if (path == '-') {
        return fs_1.readFileSync(0);
    }
    else {
        return fs_1.readFileSync(path);
    }
}
if (typeof process.argv[2] != 'string' || typeof process.argv[3] != 'string') {
    usage();
}
if (process.argv[2] == '-' && process.argv[3] == '-') {
    usage();
}
let d = new Dezent_1.Dezent(read(process.argv[2]).toString());
let output = d.parse(read(process.argv[3]).toString());
if (!output) {
    throw d.error;
}
process.stdout.write(JSON.stringify(output));
