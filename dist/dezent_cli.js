#!/usr/bin/env node
"use strict";
exports.__esModule = true;
var fs_1 = require("fs");
var Dezent_1 = require("./Dezent");
var process_1 = require("process");
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
var output = new Dezent_1["default"](read(process.argv[2]).toString())
    .parse(read(process.argv[3]).toString());
console.log(JSON.stringify(output));
