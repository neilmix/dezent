#!/usr/bin/env node

import { readFileSync } from 'fs';
import Dezent from './Dezent';
import { exit } from 'process';

function usage() {
    console.error("usage: dezent [grammar path] [text path]");
    exit(1);
}

function read(path) {
    if (path == '-') {
        return readFileSync(0);
    } else {
        return readFileSync(path);
    }
}

if (typeof process.argv[2] != 'string' || typeof process.argv[3] != 'string') {
    usage();
}

if (process.argv[2] == '-' && process.argv[3] == '-') {
    usage();
}

let output = 
    new Dezent(read(process.argv[2]).toString())
        .parse(read(process.argv[3]).toString());
process.stdout.write(JSON.stringify(output));
