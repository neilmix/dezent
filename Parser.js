"use strict";
// todo:
// - parse error line number and position (best match)
// - package license
// - node position for post-parse error messages (e.g. NonArraySplat)
// - object <-> splats
// - packrat parsing
exports.__esModule = true;
exports.parseTextWithGrammar = exports.parseGrammar = exports.parseText = exports.ErrorCode = void 0;
// speculative todo:
// - error recovery
var Grammar_1 = require("./Grammar");
var ErrorCode;
(function (ErrorCode) {
    ErrorCode[ErrorCode["DuplicateDefine"] = 1001] = "DuplicateDefine";
    ErrorCode[ErrorCode["MultipleReturn"] = 1002] = "MultipleReturn";
    ErrorCode[ErrorCode["RuleNotFound"] = 1003] = "RuleNotFound";
    ErrorCode[ErrorCode["BackRefNotFound"] = 1004] = "BackRefNotFound";
    ErrorCode[ErrorCode["NonArraySplat"] = 1005] = "NonArraySplat";
    ErrorCode[ErrorCode["SplatArraySizeMismatch"] = 1006] = "SplatArraySizeMismatch";
    ErrorCode[ErrorCode["ArrayOverrun"] = 2001] = "ArrayOverrun";
    ErrorCode[ErrorCode["MismatchOutputFrames"] = 2002] = "MismatchOutputFrames";
    ErrorCode[ErrorCode["CaptureAlreadyInProgress"] = 2003] = "CaptureAlreadyInProgress";
    ErrorCode[ErrorCode["MismatchEndCapture"] = 2004] = "MismatchEndCapture";
    ErrorCode[ErrorCode["EmptyOutput"] = 2005] = "EmptyOutput";
})(ErrorCode = exports.ErrorCode || (exports.ErrorCode = {}));
var errorMessages = {
    1001: "Multiple rules defined with the same name: $1",
    1002: "Grammars are only allowed to have one return statement",
    1003: "Grammar does not contain a rule named '$1'",
    1004: "Back reference does not exist: $$1",
    1005: "Back reference used in splat is not an array: $$1",
    1006: "All arrays in a splat must be of the same length",
    2001: "Array overrun",
    2002: "Mismatched output frames",
    2003: "Capture already in progress",
    2004: "Mismatched ending capture",
    2005: "Output frame did not contain an output token"
};
function parseText(grammarText, parseText) {
    return parseTextWithGrammar(parseGrammar(grammarText), parseText);
}
exports.parseText = parseText;
function parseGrammar(text) {
    return parseTextWithGrammar(Grammar_1.dezentGrammar, text);
}
exports.parseGrammar = parseGrammar;
function parseTextWithGrammar(grammar, text) {
    var _this = this;
    // pre-process the grammar
    var defines = {};
    var ret;
    for (var _i = 0, grammar_1 = grammar; _i < grammar_1.length; _i++) {
        var statement = grammar_1[_i];
        switch (statement.type) {
            case "define":
                if (defines[statement.name]) {
                    grammarError(ErrorCode.DuplicateDefine, statement.name);
                }
                defines[statement.name] = statement;
                break;
            case "return":
                if (ret)
                    grammarError(ErrorCode.MultipleReturn);
                ret = statement;
                break;
        }
    }
    // now parse
    var parser = new Parser(ret, text, defines);
    parser.parse();
    var builders = {
        backref: function (node, backrefs) {
            if (!backrefs[node.index]) {
                grammarError(ErrorCode.BackRefNotFound, node.index);
            }
            else {
                return buildOutput(backrefs[node.index]);
            }
        },
        splat: function (node, backrefs) {
            var resolved = [];
            for (var _i = 0, _a = node.backrefs; _i < _a.length; _i++) {
                var ref = _a[_i];
                var res = _this.backref(node, backrefs);
                if (!Array.isArray(res)) {
                    grammarError(ErrorCode.NonArraySplat, ref.index);
                }
                resolved.push(res);
            }
            for (var i = 1; i < resolved.length; i++) {
                if (resolved[i - 1].length != resolved[i].length) {
                    grammarError(ErrorCode.SplatArraySizeMismatch);
                }
            }
            var ret = [];
            for (var i = 0; i < resolved[0].length; i++) {
                for (var j = 0; j < resolved.length; j++) {
                    ret.push(resolved[j][i]);
                }
            }
            return ret;
        },
        object: function (node, backrefs) {
            var ret = {};
            for (var _i = 0, _a = node.members; _i < _a.length; _i++) {
                var member = _a[_i];
                ret[_this[member.name.type](member.name, backrefs)] = _this[member.value.type](member.value, backrefs);
            }
            return ret;
        },
        array: function (node, backrefs) {
            var ret = [];
            for (var _i = 0, _a = node.elements; _i < _a.length; _i++) {
                var elem = _a[_i];
                if (elem.type == "splat") {
                    ret = ret.concat(_this.splat(elem, backrefs));
                }
                else {
                    ret.push(_this[elem.type], backrefs);
                }
            }
            return ret;
        },
        string: function (node) {
            return buildString(node);
        },
        number: function (node) {
            return Number(node.value);
        },
        boolean: function (node) {
            return node.value;
        },
        "null": function () {
            return null;
        }
    };
    // build our output value
    return buildOutput(parser.output.result);
    function buildOutput(token) {
        if (token.backrefs && token.value) {
            var backrefs = token.backrefs.map(function (v) { return buildOutput(v); });
            return builders[token.value.type](token.value, backrefs);
        }
        else {
            return text.substr(token.pos, token.length);
        }
    }
}
exports.parseTextWithGrammar = parseTextWithGrammar;
var OutputContext = /** @class */ (function () {
    function OutputContext() {
        this.stack = [];
        this.top = null;
        this.captureIdSequence = 0;
    }
    OutputContext.prototype.enter = function (node) {
        this.top = {
            node: node,
            captureMap: [],
            captureNode: null,
            captures: []
        };
        this.stack.push(this.top);
    };
    OutputContext.prototype.exit = function (node, success) {
        var frame = this.stack.pop();
        if (frame.node != node) {
            parserError(ErrorCode.MismatchOutputFrames);
        }
        this.top = this.stack[this.stack.length - 1];
        if (!frame.output) {
            parserError(ErrorCode.EmptyOutput);
        }
        this.addTokenObject(frame.output);
    };
    OutputContext.prototype.startCapture = function (node) {
        if (this.top.captureNode) {
            parserError(ErrorCode.CaptureAlreadyInProgress);
        }
        this.top.captureNode = node;
        if (!node.id) {
            node.id = ++this.captureIdSequence;
        }
        if (!this.top.captureMap[node.id]) {
            this.top.captureMap[node.id] = this.top.captures.length;
            this.top.captures.push([]);
        }
    };
    OutputContext.prototype.endCapture = function (node) {
        if (this.top.captureNode != node) {
            parserError(ErrorCode.MismatchEndCapture);
        }
        this.top.captureNode = null;
    };
    OutputContext.prototype.addToken = function (pos, consumed) {
        this.addTokenObject({
            pos: pos,
            length: consumed
        });
    };
    OutputContext.prototype.addTokenObject = function (token) {
        if (this.top) {
            this.top.captures[this.top.captureMap[this.top.captureNode.id]].push(token);
        }
        else {
            this.result = token;
        }
    };
    OutputContext.prototype.yield = function (node, startPos, consumed) {
        var backrefs = [];
        for (var _i = 0, _a = this.top.captures; _i < _a.length; _i++) {
            var capture = _a[_i];
            if (capture.length > 1) {
                backrefs.push({
                    pos: capture[0].pos,
                    length: capture.reduce(function (t, c) { return t + c.length; }, 0)
                });
            }
            else {
                backrefs.push(capture[0]);
            }
        }
        this.top.output = {
            pos: startPos,
            length: consumed,
            backrefs: backrefs,
            value: node.output
        };
    };
    OutputContext.prototype.reset = function () {
        this.top.captureMap = [];
        this.top.captures = [];
    };
    return OutputContext;
}());
var Parser = /** @class */ (function () {
    function Parser(root, text, defines) {
        this.stack = [];
        this.output = new OutputContext();
        this.text = text;
        this.defines = defines;
        this.enter(root);
    }
    Parser.prototype.parse = function () {
        var _loop_1 = function () {
            // find the next part
            var part = void 0;
            PART: while (true) {
                var current = this_1.top();
                if (current.index >= current.items.length) {
                    parserError(ErrorCode.ArrayOverrun);
                }
                else {
                    switch (current.node.type) {
                        case "return":
                        case "define":
                        case "rule":
                        case "capture":
                        case "group":
                            this_1.enter(current.items[current.index]);
                            break;
                        case "option":
                            part = current.items[current.index];
                            break PART;
                    }
                }
            }
            // execute the part
            switch (part.type) {
                case "capture":
                case "group":
                    this_1.enter(part);
                    break;
                case "ruleref":
                    if (this_1.defines[part.name]) {
                        this_1.enter(this_1.defines[part.name]);
                    }
                    else {
                        grammarError(ErrorCode.RuleNotFound, part.name);
                    }
                    break;
                case "string":
                case "regex":
                    if (!part.match) {
                        if (part.type == "string") {
                            var matchString_1 = buildString(part);
                            part.match = function (s) { return s.startsWith(matchString_1) ? matchString_1.length : -1; };
                        }
                        else {
                            var regex_1 = new RegExp("^" + part.pattern);
                            part.match = function (s) {
                                var result = regex_1.exec(s);
                                return result ? result[0].length : -1;
                            };
                        }
                    }
                    var consumed = part.match(this_1.text.substr(this_1.top().pos));
                    if (consumed >= 0) {
                        var current = this_1.top();
                        this_1.output.addToken(current.pos, consumed);
                        current.pos += consumed;
                        if (current.index >= current.items.length - 1) {
                            // everything passed, or else we would have popped
                            this_1.exit(true);
                        }
                    }
                    else {
                        this_1.exit(false);
                    }
                    break;
            }
        };
        var this_1 = this;
        while (true) {
            _loop_1();
        }
        // check that consumed == text.length...
    };
    Parser.prototype.enter = function (node) {
        var current = this.top();
        var items;
        switch (node.type) {
            case "return":
                items = [node.rule];
                this.output.enter(node);
                break;
            case "define":
                items = node.rules;
                this.output.enter(node);
                break;
            case "capture":
                this.output.startCapture(node);
            // FALL THROUGH
            case "group":
            case "rule":
                items = node.options;
                break;
            case "option":
                items = node.tokens;
                break;
        }
        this.stack.push({
            node: node,
            items: items,
            index: 0,
            startPos: current ? current.pos : 0,
            pos: current ? current.pos : 0,
            matchCount: 0
        });
    };
    Parser.prototype.exit = function (success) {
        while (this.stack.length) {
            var exited = this.stack.pop();
            switch (exited.node.type) {
                case "return":
                case "define":
                    this.output.exit(exited.node, success);
                    break;
                case "rule":
                    if (success) {
                        this.output.yield(exited.node, exited.startPos, exited.pos - exited.startPos);
                    }
                    else {
                        this.output.reset();
                    }
                    break;
                case "capture":
                    this.output.endCapture(exited.node);
                // FALL THROUGH
                case "group":
                    var required = exited.node.repeat in [null, '+'];
                    if (!required)
                        success = true;
                    if (exited.node.repeat == '*')
                        success = true;
                    if (exited.node.repeat == '+' && exited.matchCount > 0)
                        success = true;
                    break;
                case "option":
                    // do nothing - we'll mitigate the parent below
                    break;
            }
            var current = this.top();
            if (success) {
                if (current.node.type in ["group", "capture"] && current.node.repeat in ["*", "+"]) {
                    current.index = 0;
                    current.matchCount++;
                    return;
                }
                current.index++;
                if (current.index < current.items.length) {
                    return;
                }
            }
        }
    };
    Parser.prototype.top = function () {
        return this.stack[this.stack.length - 1];
    };
    return Parser;
}());
function buildString(node) {
    return node.tokens.map(function (node) {
        if (node.type == "text") {
            return node.value;
        }
        else if (node.value[0] == 'u') {
            return String.fromCharCode(Number("0x" + node.value.substr(1)));
        }
        else if ("bfnrt".indexOf(node.value[1]) >= 0) {
            return ({ b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' })[node.value[1]];
        }
        else {
            return node.value.substr(1);
        }
    }).join("");
}
function grammarError(code, arg1) {
    var msg = errorMessages[code].replace("$1", arg1);
    throw new Error("Grammar error: " + msg);
}
function parserError(code) {
    var msg = errorMessages[code];
    throw new Error("Internal parser error: " + msg);
}
