const readline = require('readline');
const Dezent = require("../dist/Dezent").default;

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
