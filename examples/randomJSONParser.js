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

DezentStream = require("../dist/Dezent").DezentStream;

let bytes = 0;
let start = epoch();
let lastOut = start;

let grammar = `
    return line* -> null;
    line = '[' date 'T' time 'Z] ' {object} '\\n' -> processLine($1);
    date = [0-9][0-9][0-9][0-9] '-' [0-9][0-9] '-' [0-9][0-9] -> null;
    time =  [0-9][0-9] ':' [0-9][0-9] ':' [0-9][0-9] '.' [0-9][0-9][0-9] -> null;
    atom = {object|array|string|number|boolean|null} -> $1;
    object = '{' ( {member} ( ',' {member} )* )? '}' -> { ...[$1?, ...$2?] };
    member = {string} ':' {atom} -> [$1, $2];
    array = '[' ( {atom} ( ',' {atom} )* )? ']' -> [$1?, $2?];
    string = '"' {stringText|escape}* '"' -> join($1);
    stringText = ( !["\\\\] . )+ -> $0;
    escape = '\\\\' { unicodeChar | escapeChar } -> $1;
    unicodeChar = 'u' [A-Fa-f0-9] [A-Fa-f0-9] [A-Fa-f0-9] [A-Fa-f0-9] -> unicodeChar($0);
    escapeChar = ["/\\\\bnfrt] -> escapeChar($0);
    number = 
        '-'? ( [1-9] [0-9]* | [0-9]+ ) // integer
        ( '.' [0-9]+ )?                // fraction
        ( [eE] [-+] [0-9]+ )?          // exponent
        -> number($0);
    boolean = 'true' -> true, 'false' -> false;
    null = 'null' -> null;
`;

let callbacks = {
    processLine: (obj) => {
        let newOut = epoch();
        if (newOut - lastOut >= 1000) {
            let ksec = Math.round((bytes/((epoch() - start)/1000))/1024);
            process.stdout.write(`${String.fromCharCode(13)}Cumulative parsing speed: ${ksec} kb/sec`)
            lastOut = newOut;
        }
    },
    join: (arr) => arr.join(''),
    unicodeChar: (hex) => String.fromCharCode(Number('0x' + hex)),
    escapeChar: (c) => ({ b:'\b', f:'\f', n:'\n', r:'\r', t:'\t' })[c] || c,
    number: Number,
};

let ds = new DezentStream(grammar, { callbacks: callbacks, enableProfiling: process.argv[2] == "--profile" });

process.stdout.write("calculating...");
process.stdin.setEncoding('utf8');
process.stdin.on('data', function(data){
    bytes += data.length;
    ds.write(data);
});
process.stdin.on('end', function() {
    console.log("");
    ds.close();
});

function epoch() {
    return new Date().getTime();
}
