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

/*
 * Why does this file exist?
 *
 * Dezent was built using the jest testing framework. Jest, as part of its
 * execution, re-compiles our compiled javascript code into another form,
 * which changes the line numbering and therefore breaks interactive debugging
 * (breakpoints change lines during execution).
 * 
 * This file stubs out the jest testing framework so that the code can be
 * simply executed (without the second compilation) using the correct line
 * mapping, and therefore interactively debugged line-by-line.
 */

global["test"] = async function(name, f, timeout) {
    try {
        await f();
    } catch(e) {
        console.error("EXCEPTION:", name);
        console.error(e.stack);
    }
}

global["expect"] = function(actual) {
    return {
        toBe: (expected) => { if (actual !== expected) debugger },
        toEqual: (expected) => { if (JSON.stringify(actual) != JSON.stringify(expected)) debugger },
        toThrow: () => { 
            let caught = false;
            try { actual() } catch (e) { caught = true; }
            if (!caught) debugger;
        },
    }
}

import "./Parser.test"
