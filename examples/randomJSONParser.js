DezentStream = require("../dist/Dezent").DezentStream;

let bytes = 0;
let start = epoch();
let lastOut = start;

let grammar = `
    return line* -> null;
    line = {object} '\\n' -> processLine($1);
    atom = {object|array|string|number|boolean|null} -> $1;
    object = '{' ( {member} ',' )* {member}? '}' -> { ...[...$1, $2?] };
    member = {string} ':' {atom} -> [$1, $2];
    array = '[' ( {atom} ',' )* {atom} ']' -> [...$1, $2? ];
    string = '"' {escape|stringText}* '"' -> join($1);
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
            process.stdout.write(`${String.fromCharCode(13)}${ksec} kb/sec`)
            lastOut = newOut;
        }
    },
    obj: (a) => {
        a.forEach((i) => {
            if (i.length != 2) {
                console.log("--1", a);
                throw new Error();
            }
        });
    },
    join: (arr) => arr.join(''),
    unicodeChar: (hex) => String.fromCharCode(Number('0x' + hex)),
    escapeChar: (c) => ({ b:'\b', f:'\f', n:'\n', r:'\r', t:'\t' })[c] || c,
    number: Number,
};

let ds = new DezentStream(grammar, callbacks);

process.stdout.write("...");
process.stdin.setEncoding('utf8');
process.stdin.on('data', function(data){
    bytes += data.length;
    ds.write(data);
});

function epoch() {
    return new Date().getTime();
}
