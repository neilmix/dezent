"use strict";
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
exports.__esModule = true;
exports.findLineAndChar = exports.parsingError = exports.assert = exports.parserError = exports.Parser = exports.MatchStatus = exports.parseGrammar = exports.parseText = exports.findDezentGrammar = exports.errorMessages = exports.ErrorCode = void 0;
var Grammar_1 = require("./Grammar");
var ParseCache_1 = require("./ParseCache");
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
    ErrorCode[ErrorCode["AssertionFailure"] = 2011] = "AssertionFailure";
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
    2010: "Multiple outputs were found for a non-repeating capture",
    2011: "Assertion failed"
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
    function Parser(root, text, rulesets, maxid, options, debugLog) {
        this.stack = [];
        this.omitFails = 0;
        this.root = root;
        this.text = text;
        this.rulesets = rulesets;
        this.options = options || {};
        this.debugLog = debugLog;
        this.parseCache = new ParseCache_1.ParseCache(maxid, !options.disableCacheLookup);
        this.enter(root);
    }
    Parser.prototype.parse = function () {
        var maxPos = 0;
        var failedPatterns = {};
        var _loop_1 = function () {
            var current = this_1.top();
            if (current.index > current.items.length) {
                parserError(ErrorCode.ArrayOverrun);
            }
            if (current.status == MatchStatus.Continue) {
                switch (current.node.type) {
                    default:
                        this_1.enter(current.items[current.index]);
                        break;
                    case "ruleref":
                        this_1.enter(this_1.rulesets[current.node.name]);
                        break;
                    case "string":
                    case "class":
                    case "any":
                        var text = this_1.text.substr(this_1.top().pos);
                        var _a = current.node.match(text), matched = _a[0], consumed = _a[1];
                        if (matched) {
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
                var exited_1 = this_1.stack.pop();
                if (!exited_1.cached) {
                    this_1.parseCache.store(exited_1);
                }
                var next = this_1.top();
                if (!next) {
                    return "break";
                }
                if (["ruleset", "rule", "pattern", "capture", "group"].includes(exited_1.node.type)) {
                    if (!exited_1.node["canFail"]) {
                        this_1.omitFails--;
                    }
                }
                if (exited_1.node["pattern"] || exited_1.node.type == "ruleref") {
                    this_1.debug(exited_1.status == MatchStatus.Pass ? 'PASS' : 'FAIL', this_1.text.substr(exited_1.pos, 20), exited_1.node["pattern"] || exited_1.node["name"]);
                }
                // special handling is required for left recursion
                if (next.leftContinuation) {
                    if (exited_1.status == MatchStatus.Pass && exited_1.consumed > next.consumed) {
                        assert(exited_1.node.type == "rule");
                        // try again using a copy of our continuation, but update our leftOffsets 
                        // to reflect further consumption
                        next.consumed = exited_1.consumed;
                        var continuation = next.leftContinuation.map(function (frame) { return Object.assign({}, frame); });
                        continuation.forEach(function (frame) { return frame.leftOffset += exited_1.consumed; });
                        this_1.stack = this_1.stack.concat(continuation);
                        // update the state of the ruleset at the top of our stack
                        var top_1 = this_1.stack[this_1.stack.length - 1];
                        assert(top_1.node.type == "ruleset");
                        top_1.consumed = exited_1.consumed;
                        top_1.index = exited_1.node.rulesetIndex;
                        top_1.nextFrame = exited_1;
                        // we got at least one successful continuation - mark our base ruleset as a success
                        next.status = MatchStatus.Pass;
                        next.nextFrame = exited_1;
                        return "continue";
                    }
                    else if (next.status == MatchStatus.Pass) {
                        return "continue";
                    }
                    // FALL THROUGH
                }
                if ((next.node.type == "token" && next.node.not && exited_1.status == MatchStatus.Fail) ||
                    ((next.node.type != "token" || !next.node.not) && exited_1.status == MatchStatus.Pass)) {
                    if (exited_1.pos + exited_1.consumed > maxPos) {
                        maxPos = exited_1.pos + exited_1.consumed;
                        failedPatterns = {};
                    }
                    // consume, but only if there's not a predicate
                    if (exited_1.node.type != "token" || !(exited_1.node.and || exited_1.node.not)) {
                        next.consumed += exited_1.consumed;
                    }
                    if (next.node.type == "pattern") {
                        if (++next.index >= next.items.length) {
                            next.status = MatchStatus.Pass;
                        } // otherwise stay at Continue
                    }
                    else {
                        next.status = MatchStatus.Pass;
                    }
                    if (next.node.type == "token") {
                        // when repeating, make sure we consumed to avoid infinite loops
                        if (next.node.repeat && exited_1.consumed > 0) {
                            // cache intermediate positions of tokens to avoid pathological
                            // bad grammar performance.
                            this_1.parseCache.store(next, exited_1.pos);
                            this_1.enter(next.node.descriptor);
                        }
                    }
                }
                else { // exited.matchStatus == MatchStatus.FAIL
                    if (exited_1.pos == maxPos && exited_1.node["pattern"]) {
                        if (!this_1.omitFails && exited_1.node["pattern"]) {
                            failedPatterns[exited_1.node["pattern"]] = true;
                        }
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
                    if (next.node.type == "ruleset" && next.node.name == 'return') {
                        parsingError(ErrorCode.TextParsingError, this_1.text, maxPos, expectedTerminals());
                    }
                }
            }
        };
        var this_1 = this;
        while (this.stack.length) {
            var state_1 = _loop_1();
            if (state_1 === "break")
                break;
        }
        var output = new OutputContext_1.OutputContext();
        this.parseCache.visitPassFrames(this.root, this.rulesets, function (frame) {
            if (["group", "capture"].includes(frame.node.type)) {
                output.enterGroup();
            }
            switch (frame.node.type) {
                case "ruleset":
                    output.enterFrame(frame.node);
                    break;
                case "rule":
                    output.setRule(frame.node);
                    break;
                case "capture":
                    output.startCapture(frame.node);
                    break;
                case "string":
                case "class":
                case "any":
                    output.addToken(frame.pos, frame.consumed);
                    break;
            }
        }, function (frame) {
            if (["group", "capture"].includes(frame.node.type)) {
                output.exitGroup();
            }
            switch (frame.node.type) {
                case "ruleset":
                    output.addTokenObject(output.exitFrame(frame.node));
                    break;
                case "rule":
                    output.yield(frame.node, frame.pos, frame.consumed);
                    break;
                case "capture":
                    output.endCapture(frame.node);
                    break;
            }
        });
        if (!output.result) {
            parserError(ErrorCode.EmptyOutput);
        }
        if (output.result.pos != 0) {
            parserError(ErrorCode.InputConsumedBeforeResult);
        }
        if (output.result.length != this.text.length) {
            parsingError(ErrorCode.TextParsingError, this.text, maxPos, expectedTerminals());
        }
        return output;
        function expectedTerminals() {
            return Object.keys(failedPatterns);
        }
    };
    Parser.prototype.enter = function (node) {
        var current = this.top();
        var pos = current ? current.pos + current.consumed : 0;
        var leftOffset = current ? current.leftOffset : 0;
        var items;
        if (["ruleset", "rule", "pattern", "capture", "group"].includes(node.type)) {
            if (!node["canFail"]) {
                this.omitFails++;
            }
        }
        switch (node.type) {
            case "ruleset":
                items = node.rules;
                break;
            case "rule":
                items = node.options;
                break;
            case "capture":
                items = node.options;
                break;
            case "group":
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
        var frame = this.parseCache.retrieve(pos, node, leftOffset);
        if (frame) {
            if (frame.status == MatchStatus.Continue) {
                assert(frame.node.type == "ruleset");
                // left recursion detected
                // build a continuation and set leftOffsets
                var i = this.stack.length - 1;
                while (this.stack[i].node.id != node.id) {
                    this.stack[i].leftOffset = leftOffset;
                    i--;
                    assert(i > 0);
                }
                this.stack[i].leftContinuation = this.stack.slice(i + 1).map(function (f) { return Object.assign({}, f); });
                // there may be intermediate rulesets in the continuation. Remember, rulesets are cached
                // immediately upon creation (see below). So, we need to update the cached member
                // of all our continuation frames just in case.
                this.stack[i].leftContinuation.forEach(function (f) { return f.cached = false; });
                this.stack.push({
                    // the first time through we fail so that parsing can attempt subsequent rules that may pass
                    status: MatchStatus.Fail,
                    node: node,
                    items: items,
                    index: 0,
                    pos: pos,
                    consumed: 0,
                    // prevent this frame from attempting to store on top of our base frame
                    cached: true,
                    leftOffset: leftOffset
                });
                this.stack[i].leftContinuation.push({
                    // subsequent continuation executions need to pass at the top to kick off
                    // downward descent through the stack
                    status: MatchStatus.Pass,
                    node: node,
                    items: items,
                    index: 0,
                    pos: pos,
                    consumed: 0,
                    cached: false,
                    leftOffset: leftOffset
                });
            }
            else {
                // a repeating token frame will place itself in the cache multiple times,
                // but its pos will reflect its first entry in the cache. So, we may
                // want to update the frame pos and consumed here.
                frame.consumed -= pos - frame.pos;
                assert(frame.consumed >= 0);
                frame.pos = pos;
                this.stack.push(frame);
            }
        }
        else {
            var newFrame = {
                status: MatchStatus.Continue,
                node: node,
                items: items,
                index: 0,
                pos: pos,
                consumed: 0,
                cached: false,
                leftOffset: leftOffset
            };
            this.stack.push(newFrame);
            if (newFrame.node.type == "ruleset") {
                // store rulesets early so we can detect left recursion
                this.parseCache.store(newFrame);
            }
        }
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
function assert(condition) {
    if (!condition) {
        debugger;
        parserError(ErrorCode.AssertionFailure);
    }
}
exports.assert = assert;
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
