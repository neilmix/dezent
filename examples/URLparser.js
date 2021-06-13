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
    return ({scheme} ':')? '//' ({userinfo} '@')? {host} (':' {port})? {path} {query}? {fragment}? 
        -> {
            URL: $0,
            scheme: $1,
            userinfo: $2,
            host: $3,
            port: $4,
            path: $5,
            query: $6,
            fragment: $7
        };
    
    scheme = [a-z][a-z0-9+-.]* 
        -> $0;

    userinfo = { (escape|unreserved|subdelims)+ } ':' { (!'@' .)* } 
        -> { username: $1, password: $2 };

    host = [a-zA-Z0-9.-]+ | IPv6Address 
        -> $0;
    IPv6Address = '[' hex* ':' hex* ':' hex* ':' hex* ':' hex* ':' hex* ':' hex* ':' hex* ']' 
        -> $0;

    port = [0-9]+ 
        -> $0;

    path = ( '/' pchar* )* 
        -> $0;

    query = '?' ( {nameval} ('&' {nameval})* )? 
        -> { pairs: [$1, ...$2], table: { ...[$1, ...$2] } };
    nameval = {(escape|unreserved)+} '=' {(escape|unreserved)*} 
        -> [$1, $2];

    fragment = '#' (pchar | '/' | '?')* 
        -> $0;

    pchar = escape | unreserved | subdelims | [:@] 
        -> $0;
    unreserved = [a-zA-Z0-9\\-._~] 
        -> $0;
    subdelims = [!$&'()*+,;=] 
        -> $0;
    escape = '%' hex hex 
        -> $0;
    hex = [a-fA-F0-9] 
        -> $0;
`);

(input = () => {
    rl.question('enter URL: ', (expr) => {
        let result = dez.parse(expr);
        if (result) {
            console.log("Parse output:");
            console.log(JSON.stringify(result, null, 2));
        } else {
            console.log(dez.error.message);
        }
        input();
    });
})();
