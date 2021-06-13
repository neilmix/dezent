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
