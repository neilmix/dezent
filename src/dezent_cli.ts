#!/usr/bin/env node
/*
 *  Dezent - Powerful pattern matching and parsing that's readable, recursive, and structured.
 *  Copyright (C) 2020  Neil Mix  <neilmix@gmail.com>
 *  Commercial licensing and support are available, please contact neilmix@gmail.com.
 * 
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Affero General Public License for more details.
 *
 *  You should have received a copy of the GNU Affero General Public License
 *  along with this program.  If not, see <https://www.gnu.org/licenses/>. 
 */

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
