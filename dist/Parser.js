"use strict";
// tagline:
// Powerful pattern matching and parsing that's readable, recursive, and structured.
exports.__esModule = true;
exports.findLineAndChar = exports.parsingError = exports.parserError = exports.Parser = exports.MatchStatus = exports.parseGrammar = exports.parseText = exports.findDezentGrammar = exports.errorMessages = exports.ErrorCode = void 0;
// todo:
// - documentation
// - command line script w/tests
// - package license
// - performance/scale testing
// - packrat parsing
// - release?
// - output callbacks
// - @id
// - string interpolation
// - backref within pattern
// - regex-like search-and-find
// speculative/research todo:
// - compile-time data-type checking
// - packrat cache eviction to free memory
// - error messaging
// - error recovery
// - chunked parsing
// - macros/functions, e.g. definition(pattern1, pattern2)
var Grammar_1 = require("./Grammar");
var ParseManager_1 = require("./ParseManager");
var OutputContext_1 = require("./OutputContext");
var ErrorCode;
(function (ErrorCode) {
    ErrorCode[ErrorCode["TextParsingError"] = 1] = "TextParsingError";
    ErrorCode[ErrorCode["GrammarParsingError"] = 2] = "GrammarParsingError";
    ErrorCode[ErrorCode["DuplicateDefine"] = 1001] = "DuplicateDefine";
    ErrorCode[ErrorCode["MultipleReturn"] = 1002] = "MultipleReturn";
    ErrorCode[ErrorCode["RuleNotFound"] = 1003] = "RuleNotFound";
    ErrorCode[ErrorCode["InvalidSpread"] = 1004] = "InvalidSpread";
    ErrorCode[ErrorCode["ReturnNotFound"] = 1005] = "ReturnNotFound";
    ErrorCode[ErrorCode["CaptureCountMismatch"] = 1006] = "CaptureCountMismatch";
    ErrorCode[ErrorCode["InvalidBackRef"] = 1007] = "InvalidBackRef";
    ErrorCode[ErrorCode["InvalidConstRef"] = 1008] = "InvalidConstRef";
    ErrorCode[ErrorCode["InvalidPivot"] = 1009] = "InvalidPivot";
    ErrorCode[ErrorCode["PivotArraySizeMismatch"] = 1010] = "PivotArraySizeMismatch";
    ErrorCode[ErrorCode["InvalidObjectTuple"] = 1011] = "InvalidObjectTuple";
    ErrorCode[ErrorCode["InvalidAccessRoot"] = 1012] = "InvalidAccessRoot";
    ErrorCode[ErrorCode["InvalidAccessIndex"] = 1013] = "InvalidAccessIndex";
    ErrorCode[ErrorCode["InvalidAccessProperty"] = 1014] = "InvalidAccessProperty";
    ErrorCode[ErrorCode["ArrayOverrun"] = 2001] = "ArrayOverrun";
    ErrorCode[ErrorCode["MismatchOutputFrames"] = 2002] = "MismatchOutputFrames";
    ErrorCode[ErrorCode["CaptureAlreadyInProgress"] = 2003] = "CaptureAlreadyInProgress";
    ErrorCode[ErrorCode["MismatchEndCapture"] = 2004] = "MismatchEndCapture";
    ErrorCode[ErrorCode["EmptyOutput"] = 2005] = "EmptyOutput";
    ErrorCode[ErrorCode["Unreachable"] = 2006] = "Unreachable";
    ErrorCode[ErrorCode["BackRefNotFound"] = 2007] = "BackRefNotFound";
    ErrorCode[ErrorCode["CaptureOutputNotFound"] = 2008] = "CaptureOutputNotFound";
    ErrorCode[ErrorCode["InputConsumedBeforeResult"] = 2009] = "InputConsumedBeforeResult";
    ErrorCode[ErrorCode["MultipleOutputsForCapture"] = 2010] = "MultipleOutputsForCapture";
})(ErrorCode = exports.ErrorCode || (exports.ErrorCode = {}));
exports.errorMessages = {
    1: "Parse failed: $3\nAt line $1 char $2:\n$4\n$5",
    2: "Error parsing grammar: $3\nAt line $1 char $2:\n$4\n$5",
    1001: "Multiple rules defined with the same name: $1",
    1002: "Grammars are only allowed to have one return statement",
    1003: "Grammar does not contain a rule named '$1'",
    1004: "Spread argument is neither an array nor object: $1",
    1005: "Grammar does not contain a return rule",
    1006: "All options within a rule must have the same number of captures",
    1007: "Invalid back reference: $$1",
    1008: "Invalid variable reference: $$1",
    1009: "Invalid pivot argment: $1",
    1010: "All subarrays in a pivot must be of the same length",
    1011: "When spreading an array into an object, array elements must be arrays of length 2 but instead received: $1",
    1012: "Attempted to access property of non-object value: $1",
    1013: "Attempted to access property using a key that was not a string or number: $1",
    1014: "Attempted to access a property that doesn't exist: $1",
    2001: "Array overrun",
    2002: "Mismatched output frames",
    2003: "Capture already in progress",
    2004: "Mismatched ending capture",
    2005: "Output frame did not contain an output token",
    2006: "Should not be possible to reach this code",
    2007: "Back reference does not exist",
    2008: "No output was found during capture",
    2009: "The result does not start at input index 0",
    2010: "Multiple outputs were found for a non-repeating capture"
};
var dezentGrammar;
function findDezentGrammar(options) {
    if (!dezentGrammar) {
        dezentGrammar = Grammar_1.createUncompiledDezentGrammar();
        new ParseManager_1.ParseManager(options).compileGrammar(dezentGrammar);
    }
    return dezentGrammar;
}
exports.findDezentGrammar = findDezentGrammar;
function parseText(grammar, text, options) {
    var mgr = new ParseManager_1.ParseManager(options);
    try {
        return mgr.parseText(grammar, text);
    }
    catch (e) {
        if (options && options.debugErrors)
            mgr.dumpDebug();
        throw e;
    }
}
exports.parseText = parseText;
function parseGrammar(grammar, options) {
    var mgr = new ParseManager_1.ParseManager(options);
    try {
        return mgr.parseAndCompileGrammar(grammar);
    }
    catch (e) {
        if (options && options.debugErrors)
            mgr.dumpDebug();
        throw e;
    }
}
exports.parseGrammar = parseGrammar;
var MatchStatus;
(function (MatchStatus) {
    MatchStatus[MatchStatus["Continue"] = 0] = "Continue";
    MatchStatus[MatchStatus["Pass"] = 1] = "Pass";
    MatchStatus[MatchStatus["Fail"] = 2] = "Fail";
})(MatchStatus = exports.MatchStatus || (exports.MatchStatus = {}));
var Parser = /** @class */ (function () {
    function Parser(root, text, ruleset, options, debugLog) {
        this.stack = [];
        this.output = new OutputContext_1.OutputContext();
        this.omitFails = 0;
        this.text = text;
        this.ruleset = ruleset;
        this.options = options || {};
        this.debugLog = debugLog;
        this.enter(root);
    }
    Parser.prototype.parse = function () {
        var maxPos = 0;
        var failedPatterns = {};
        while (this.stack.length) {
            var current = this.top();
            if (current.index > current.items.length) {
                parserError(ErrorCode.ArrayOverrun);
            }
            if (current.status == MatchStatus.Continue) {
                switch (current.node.type) {
                    default:
                        this.enter(current.items[current.index]);
                        break;
                    case "ruleref":
                        this.enter(this.ruleset[current.node.name]);
                        break;
                    case "string":
                    case "class":
                    case "any":
                        var text = this.text.substr(this.top().pos);
                        var _a = current.node.match(text), matched = _a[0], consumed = _a[1];
                        if (matched) {
                            this.output.addToken(current.pos, consumed);
                            current.consumed = consumed;
                            current.status = MatchStatus.Pass;
                        }
                        else {
                            current.status = MatchStatus.Fail;
                        }
                        break;
                }
            }
            else {
                var exited = this.stack.pop();
                var next = this.top();
                if (!next) {
                    // our parsing is complete!
                    break;
                }
                if (["ruleset", "rule", "pattern", "capture", "group"].includes(exited.node.type)) {
                    if (!exited.node["canFail"]) {
                        this.omitFails--;
                    }
                }
                if (exited.node["pattern"] || exited.node.type == "ruleref") {
                    this.debug(exited.status == MatchStatus.Pass ? 'PASS' : 'FAIL', this.text.substr(exited.pos, 20), exited.node["pattern"] || exited.node["name"]);
                }
                if (next.node.type == "token" && next.node.not) {
                    exited.status = exited.status == MatchStatus.Pass ? MatchStatus.Fail : MatchStatus.Pass;
                }
                if (exited.status == MatchStatus.Pass) {
                    if (exited.pos + exited.consumed > maxPos) {
                        maxPos = exited.pos + exited.consumed;
                        failedPatterns = {};
                    }
                    if (["capture", "group"].includes(exited.node.type)) {
                        this.output.exitGroup(true);
                    }
                    // consume, but only if there's not a predicate
                    if (exited.node.type != "token" || !(exited.node.and || exited.node.not)) {
                        next.consumed += exited.consumed;
                    }
                    if (next.node.type == "pattern") {
                        if (++next.index >= next.items.length) {
                            next.status = MatchStatus.Pass;
                        } // otherwise stay at Continue
                    }
                    else {
                        next.status = MatchStatus.Pass;
                    }
                    switch (next.node.type) {
                        case "ruleset":
                            this.output.exitFrame(next.node, true);
                            break;
                        case "rule":
                            this.output.yield(next.node, exited.pos, exited.consumed);
                            break;
                        case "token":
                            // when repeating, make sure we consumed to avoid infinite loops
                            if (next.node.repeat && exited.consumed > 0) {
                                this.enter(next.node.descriptor);
                            }
                            break;
                        case "capture":
                            this.output.endCapture(next.node, true);
                            break;
                    }
                }
                else { // exited.matchStatus == MatchStatus.FAIL
                    if (exited.pos == maxPos && exited.node["pattern"]) {
                        if (!this.omitFails && exited.node["pattern"]) {
                            failedPatterns[exited.node["pattern"]] = true;
                        }
                    }
                    if (["capture", "group"].includes(exited.node.type)) {
                        this.output.exitGroup(false);
                    }
                    if (["ruleset", "rule", "capture", "group"].includes(next.node.type)) {
                        if (++next.index >= next.items.length) {
                            next.status = MatchStatus.Fail;
                        }
                    }
                    else if (next.node.type == "token") {
                        if (!next.node.required) {
                            // nodes that are not required always pass
                            next.status = MatchStatus.Pass;
                        }
                        else if (next.status == MatchStatus.Continue) {
                            // this node's descriptor never passed - it failed
                            next.status = MatchStatus.Fail;
                        } // it is already marked as Pass
                    }
                    else {
                        next.status = MatchStatus.Fail;
                    }
                    switch (next.node.type) {
                        case "ruleset":
                            if (next.node.name == 'return') {
                                parsingError(ErrorCode.TextParsingError, this.text, maxPos, expectedTerminals());
                            }
                            if (next.status == MatchStatus.Fail) {
                                this.output.exitFrame(next.node, false);
                            }
                            break;
                        case "capture":
                            if (next.status == MatchStatus.Fail) {
                                this.output.endCapture(next.node, false);
                            }
                            break;
                    }
                }
            }
        }
        if (!this.output.result) {
            parserError(ErrorCode.EmptyOutput);
        }
        if (this.output.result.pos != 0) {
            parserError(ErrorCode.InputConsumedBeforeResult);
        }
        if (this.output.result.length != this.text.length) {
            parsingError(ErrorCode.TextParsingError, this.text, maxPos, expectedTerminals());
        }
        function expectedTerminals() {
            return Object.keys(failedPatterns);
        }
    };
    Parser.prototype.enter = function (node) {
        var current = this.top();
        var items;
        if (["ruleset", "rule", "pattern", "capture", "group"].includes(node.type)) {
            if (!node["canFail"]) {
                this.omitFails++;
            }
        }
        switch (node.type) {
            case "ruleset":
                items = node.rules;
                this.output.enterFrame(node);
                break;
            case "rule":
                this.output.reset(node);
                items = node.options;
                break;
            case "capture":
                this.output.enterGroup();
                this.output.startCapture(node);
                items = node.options;
                break;
            case "group":
                this.output.enterGroup();
                items = node.options;
                break;
            case "pattern":
                items = node.tokens;
                break;
            case "token":
                items = [node.descriptor];
                break;
            default:
                items = [];
                break;
        }
        this.stack.push({
            status: MatchStatus.Continue,
            node: node,
            items: items,
            index: 0,
            pos: current ? current.pos + current.consumed : 0,
            consumed: 0
        });
    };
    Parser.prototype.top = function () {
        return this.stack[this.stack.length - 1];
    };
    Parser.prototype.debug = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        if (this.options.debugErrors) {
            this.debugLog.push(args);
        }
    };
    return Parser;
}());
exports.Parser = Parser;
function parserError(code) {
    var msg = exports.errorMessages[code];
    var e = new Error("Internal parser error " + code + ": " + msg);
    e["code"] = code;
    throw e;
}
exports.parserError = parserError;
function parsingError(code, text, pos, expected) {
    expected = expected.map(function (i) { return i.replace(/\n/g, '\\n'); });
    var list = [].join.call(expected, '\n\t');
    var reason = expected.length == 1 ? "expected: " + list : "expected one of the following: \n\t" + list;
    var info = findLineAndChar(text, pos);
    var backrefs = [null, info.line, info.char, reason, info.lineText, info.pointerText];
    var msg = exports.errorMessages[code].replace(/\$([0-9])/g, function (match, index) { return String(backrefs[index]); });
    var e = new Error(msg);
    e["code"] = code;
    e["pos"] = pos;
    e["line"] = info.line;
    e["char"] = info.char;
    e["lineText"] = info.lineText;
    e["pointerText"] = info.pointerText;
    e["reason"] = reason;
    e["expected"] = expected;
    throw e;
}
exports.parsingError = parsingError;
function findLineAndChar(text, pos) {
    var lines = text.split('\n');
    var consumed = 0, linenum = 0, charnum = 0, lineText = '';
    for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
        var line = lines_1[_i];
        linenum++;
        if (consumed + line.length >= pos) {
            lineText = line;
            charnum = pos - consumed + 1;
            break;
        }
        consumed += line.length + 1;
    }
    var detabbed = lineText.replace(/\t/g, '    ');
    var leading = charnum - 1 + (detabbed.length - lineText.length);
    return {
        line: linenum,
        char: charnum,
        lineText: lineText,
        pointerText: ' '.repeat(leading) + '^'
    };
}
exports.findLineAndChar = findLineAndChar;
