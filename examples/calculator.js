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

const readline = require('readline');
const Dezent = require("../dist/Dezent").Dezent;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let dez = new Dezent(`
    return _ {addsub} _ -> $1;

    // whitespace rule
    _ = [ \\n]* -> null;

    addsub = 
        {addsub} _ {'+'|'-'} _ {multdiv} -> { op: $2, left: $1, right: $3 },
        {multdiv} -> $1;
    
    multdiv =
        {multdiv} _ {'*'|'/'} _ {exp} -> { op: $2, left: $1, right: $3},
        {exp} -> $1;
    
    exp = 
        {exp} _ '^' _ {group} -> { op: '^', left: $1, right: $2 },
        {group} -> $1;
    
    group =
        '(' _ {addsub} _ ')' -> $1,
        {number} -> $1;
    
    number = 
        '-'? ( [0-9]+ )? '.' [0-9]+  ( [eE] [-+] [0-9]+ )? -> { op: 'number', value: $0 },
        '-'? [0-9]+ ( [eE] [-+] [0-9]+ )? -> { op: 'number', value: $0 }; 
`);

let ops = {
    '+': (node) => ops[node.left.op](node.left) + ops[node.right.op](node.right),
    '-': (node) => ops[node.left.op](node.left) - ops[node.right.op](node.right),
    '*': (node) => ops[node.left.op](node.left) * ops[node.right.op](node.right),
    '/': (node) => ops[node.left.op](node.left) / ops[node.right.op](node.right),
    '^': (node) => Math.pow(ops[node.left.op](node.left), ops[node.right.op](node.right)),
    'number': (node) => Number(node.value),
};

(input = () => {
    rl.question('enter expression: ', (expr) => {
        let result = dez.parse(expr);
        if (result) {
            console.log("Parse output:");
            console.log(JSON.stringify(result, null, 2));
            console.log('Calculated result:', ops[result.op](result));
        } else {
            console.log(dez.error.message);
        }
        input();
    });
})();
