
function write() {
    while (process.stdout.write(JSON.stringify(obj()) + '\n'));
}
process.stdout.on("drain", write);
write();

function item() {
    let n = randInt(28);
    if (n == 0) {
        return obj();
    } else if (n == 1) {
        return arr();
    } else if (n < 12) {
        return str();
    } else if (n < 22) {
        return num();
    } else if (n < 27) {
        return bool;
    } else {
        return null;
    }
}

function obj() {
    let o = {};
    repeatRand(10, () => {
        o[str()] = item();
    });
    return o;
}

function arr() {
    let a = [];
    repeatRand(10, () => {
        a.push(item());
    });
    return a;
}

function str() {
    let s = "";
    repeatRand(10, () => {
        s += String.fromCharCode(32 + randInt(127-32));
    });
    return s;
}

function num() {
    return Math.random() * 1000;
}

function bool() {
    return randInt(2) ? true : false;
}

function randInt(n) {
    return Math.floor(Math.random() * n);
}

function repeatRand(n, f) {
    for (var i = 0; i < n; i++) {
        f();
    }
}
