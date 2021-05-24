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
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsingError = exports.assert = exports.parserError = exports.Parser = exports.lastParser = exports.MatchStatus = exports.parseGrammar = exports.parseText = exports.findDezentGrammar = exports.errorMessages = exports.ErrorCode = void 0;
var Grammar_1 = require("./Grammar");
var ParseBuffer_1 = require("./ParseBuffer");
var ParseCache_1 = require("./ParseCache");
var GrammarCompiler_1 = require("./GrammarCompiler");
var Output_1 = require("./Output");
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
    ErrorCode[ErrorCode["FunctionNotFound"] = 1015] = "FunctionNotFound";
    ErrorCode[ErrorCode["UnknownPragma"] = 2016] = "UnknownPragma";
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
    1015: "Function not found: $1",
    1016: "Unknown pragma: $1",
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
    2011: "Assertion failed",
};
var dezentGrammar;
function findDezentGrammar() {
    if (!dezentGrammar) {
        dezentGrammar = Grammar_1.createUncompiledDezentGrammar();
        GrammarCompiler_1.GrammarCompiler.compileGrammar(dezentGrammar);
    }
    return dezentGrammar;
}
exports.findDezentGrammar = findDezentGrammar;
function parseText(grammar, text, functions, options) {
    if (typeof grammar == "string") {
        grammar = parseGrammar(grammar, options, functions);
    }
    return parseTextWithGrammar(grammar, text, options, functions);
}
exports.parseText = parseText;
function parseGrammar(text, options, functions) {
    var buf = new ParseBuffer_1.ParseBuffer(text);
    try {
        var grammar = parseTextWithGrammar(findDezentGrammar(), buf, options, functions);
        GrammarCompiler_1.GrammarCompiler.compileGrammar(grammar, text, functions);
        return grammar;
    }
    catch (e) {
        if (e["code"] == ErrorCode.TextParsingError) {
            parsingError(ErrorCode.GrammarParsingError, buf, e["pos"], e["expected"]);
        }
        else {
            throw e;
        }
    }
}
exports.parseGrammar = parseGrammar;
function parseTextWithGrammar(grammar, text, options, functions) {
    var e_1, _a;
    var parser = new Parser(grammar, text, functions, options);
    try {
        return parser.parse();
    }
    catch (e) {
        if (options && options.debugErrors) {
            var lines = [];
            try {
                for (var _b = __values(parser.debugLog), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var msg = _c.value;
                    lines.push(msg.join('\t').replace(/\n/g, '\\n'));
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_1) throw e_1.error; }
            }
            console.error("Debug log:\n", lines.join("\n"));
            if (parser) {
                console.error("Parser stack:\n", parser.stack);
            }
        }
        throw e;
    }
}
var MatchStatus;
(function (MatchStatus) {
    MatchStatus[MatchStatus["Continue"] = 0] = "Continue";
    MatchStatus[MatchStatus["Pass"] = 1] = "Pass";
    MatchStatus[MatchStatus["Fail"] = 2] = "Fail";
})(MatchStatus = exports.MatchStatus || (exports.MatchStatus = {}));
exports.lastParser = null; // for testing purposes
var Parser = /** @class */ (function () {
    function Parser(grammar, text, functions, options) {
        var e_2, _a;
        this.stack = [];
        this.omitFails = 0;
        this.debugLog = [];
        exports.lastParser = this;
        var root;
        try {
            for (var _b = __values(grammar.ruleset), _c = _b.next(); !_c.done; _c = _b.next()) {
                var ruleset = _c.value;
                if (ruleset.name == 'return') {
                    root = ruleset;
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_2) throw e_2.error; }
        }
        if (!root) {
            GrammarCompiler_1.grammarError(ErrorCode.ReturnNotFound, grammar.text);
        }
        this.root = root;
        if (typeof text == "string") {
            this.buffer = new ParseBuffer_1.ParseBuffer(text);
        }
        else {
            this.buffer = text;
        }
        this.rulesets = grammar.rulesetLookup;
        this.options = {};
        for (var pragma in grammar.pragmas) {
            if (pragma != 'enableCache') {
                GrammarCompiler_1.grammarError(ErrorCode.UnknownPragma, pragma);
            }
            this.options[pragma] = grammar.pragmas[pragma];
        }
        for (var option in options) {
            this.options[option] = options[option];
        }
        this.parseCache = new ParseCache_1.ParseCache(this.options.enableCache ? ParseCache_1.ParseCacheScope.All : ParseCache_1.ParseCacheScope.Rulesets, grammar.maxid);
        this.valueBuilder = new Output_1.ValueBuilder(grammar, functions);
        this.enter(root);
    }
    Parser.prototype.parse = function () {
        var _a;
        var maxPos = 0;
        var failedPatterns = {};
        var exited;
        while (this.stack.length) {
            var current = this.top();
            if (current.paths == 1) {
                this.parseCache.discardPos(current.pos);
            }
            if (current.index > current.items.length) {
                parserError(ErrorCode.ArrayOverrun);
            }
            if (current.status == MatchStatus.Continue) {
                switch (current.node.type) {
                    case "token":
                        var desc = current.node.descriptor;
                        if (["string", "class", "any"].includes(desc.type)) {
                            var pos = current.pos;
                            var matched = void 0, consumed = void 0;
                            do {
                                _a = __read(desc.match(this.buffer, pos), 2), matched = _a[0], consumed = _a[1];
                                if (current.node.and || current.node.not) {
                                    if ((current.node.and && matched) || (current.node.not && !matched)) {
                                        current.status = MatchStatus.Pass;
                                    }
                                    else {
                                        current.status = MatchStatus.Fail;
                                    }
                                }
                                else if (matched) {
                                    current.consumed += consumed;
                                    current.status = MatchStatus.Pass;
                                    this.parseCache.store(current, pos);
                                    pos += consumed;
                                }
                                else {
                                    if (current.consumed > 0 || !current.node.required) {
                                        current.status = MatchStatus.Pass;
                                    }
                                    else {
                                        current.status = MatchStatus.Fail;
                                        if (pos == maxPos && !this.omitFails && desc.pattern != '') {
                                            failedPatterns[desc.pattern] = true;
                                        }
                                    }
                                }
                            } while (matched && current.node.repeat);
                            break;
                        }
                    // FALL THROUGH
                    default:
                        this.enter(current.items[current.index]);
                        break;
                    case "ruleref":
                        this.enter(this.rulesets[current.node.name]);
                        break;
                }
            }
            else {
                exited = this.stack.pop();
                this.parseCache.store(exited);
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
                    if (this.options.debugErrors) {
                        this.debugLog.push([
                            exited.status == MatchStatus.Pass ? 'PASS' : 'FAIL',
                            this.buffer.substr(exited.pos, 20),
                            exited.node["pattern"] || exited.node["name"]
                        ]);
                    }
                }
                // special handling is required for left recursion
                if (next.leftContinuation) {
                    if (exited.status == MatchStatus.Pass && exited.consumed > next.consumed) {
                        assert(exited.node.type == "rule");
                        // try again using a copy of our continuation, but update our leftOffsets 
                        // to reflect further consumption
                        next.consumed = exited.consumed;
                        var continuation = next.leftContinuation.map(function (frame) { return Object.assign({}, frame); });
                        continuation.forEach(function (frame) { return frame.leftOffset += exited.consumed; });
                        this.stack = this.stack.concat(continuation);
                        // update the state of the ruleset at the top of our stack
                        var top_1 = this.stack[this.stack.length - 1];
                        assert(top_1.node.type == "ruleset");
                        top_1.consumed = exited.consumed;
                        top_1.index = exited.node.rulesetIndex;
                        if (top_1.wantOutput) {
                            this.yieldOutput(exited, top_1, next);
                            // the final pass will fail, so we want to make sure our base frame
                            // contains results from the most recent successful run
                            next.output = top_1.output;
                        }
                        // we got at least one successful continuation - mark our base ruleset as a success
                        next.status = MatchStatus.Pass;
                        continue;
                    }
                    else if (next.status == MatchStatus.Pass) {
                        // we previously successfully recursed, we're passing!
                        // don't fall through or we'll get marked as a fail.
                        continue;
                    }
                    // FALL THROUGH
                }
                if ((next.node.type == "token" && next.node.not && exited.status == MatchStatus.Fail) ||
                    ((next.node.type != "token" || !next.node.not) && exited.status == MatchStatus.Pass)) {
                    if (exited.pos + exited.consumed > maxPos) {
                        maxPos = exited.pos + exited.consumed;
                        failedPatterns = {};
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
                    if (next.node.type == "token") {
                        // when repeating, make sure we consumed to avoid infinite loops
                        if (next.node.repeat && exited.consumed > 0) {
                            // cache intermediate positions of tokens to avoid pathological
                            // bad grammar performance.
                            this.parseCache.store(next, exited.pos);
                            this.enter(next.node.descriptor);
                        }
                    }
                    // handle output
                    if (next.node.type == "capture") {
                        if (exited.output && exited.items.length == 1) {
                            // output has descended the stack to our capture - capture it
                            // but only if it's the only node in this capture
                            exited.output.captureIndex = next.node.index;
                            next.captures = [exited.output];
                        }
                        else {
                            // create a capture text segment
                            next.captures = [{
                                    captureIndex: next.node.index,
                                    position: exited.pos,
                                    length: exited.consumed,
                                    value: this.buffer.substr(exited.pos, exited.consumed),
                                }];
                        }
                    }
                    else if (exited.output) {
                        // make the output descend the stack
                        next.output = exited.output;
                    }
                    else if (next.node.type != "ruleset" && exited.captures) {
                        // captures descend the stack until we reach a ruleset, at which point they
                        // get bundled into an output if within a capture (see below), otherwise discarded
                        if (next.captures) {
                            next.captures = next.captures.concat(exited.captures);
                        }
                        else {
                            next.captures = exited.captures;
                        }
                    }
                    else if (next.node.type == "ruleset") {
                        this.yieldOutput(exited, next, next);
                    }
                }
                else { // exited.matchStatus == MatchStatus.FAIL
                    if (["ruleset", "rule", "capture", "group"].includes(next.node.type)) {
                        if (++next.index >= next.items.length) {
                            next.status = MatchStatus.Fail;
                        }
                        else if (next.paths > 0) {
                            next.paths--;
                            assert(next.paths >= 1);
                        }
                    }
                    else if (next.node.type == "token") {
                        if (!next.node.required) {
                            // nodes that are not required always pass
                            next.status = MatchStatus.Pass;
                            if (exited.node.type == "capture" && !next.node.repeat) {
                                // a failed non-required non-repeating capture should yield null
                                next.captures = [{
                                        captureIndex: exited.node.index,
                                        position: exited.pos,
                                        length: 0,
                                        value: null
                                    }];
                            }
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
                        parsingError(ErrorCode.TextParsingError, this.buffer, maxPos, expectedTerminals());
                    }
                }
                if (!this.options.enableCache) {
                    this.parseCache.frameComplete(exited);
                }
            }
        }
        if (!exited.output) {
            parserError(ErrorCode.EmptyOutput);
        }
        if (exited.pos != 0) {
            parserError(ErrorCode.InputConsumedBeforeResult);
        }
        if (exited.output.length != this.buffer.length) {
            parsingError(ErrorCode.TextParsingError, this.buffer, maxPos, expectedTerminals());
        }
        return exited.output.value;
        function expectedTerminals() {
            return Object.keys(failedPatterns);
        }
    };
    Parser.prototype.yieldOutput = function (exited, target, base) {
        assert(exited.node.type == "rule");
        // create a capture for $0 backref
        if (!exited.captures)
            exited.captures = [];
        exited.captures.push({
            captureIndex: 0,
            position: base.pos,
            length: base.consumed,
            value: this.buffer.substr(base.pos, base.consumed),
        });
        // always build the value so that output callbacks can be called
        // even if the grammar returns void
        var value = this.valueBuilder.buildValue(exited);
        if (base.wantOutput || base.node.name == "return") {
            // our ruleset emerged from a capture - create an output (which will descend the stack)
            target.output = {
                position: base.pos,
                length: base.consumed,
                value: value
            };
        }
    };
    Parser.prototype.enter = function (node) {
        var current = this.top();
        var pos = current ? current.pos + current.consumed : 0;
        var leftOffset = current ? current.leftOffset : 0;
        var items;
        var paths;
        if (["ruleset", "rule", "pattern", "capture", "group"].includes(node.type)) {
            if (!node["canFail"]) {
                this.omitFails++;
            }
        }
        switch (node.type) {
            case "ruleset":
                items = node.rules;
                paths = items.length;
                break;
            case "rule":
            case "capture":
            case "group":
                items = node.options;
                paths = items.length;
                break;
            case "pattern":
                items = node.tokens;
                paths = 1;
                break;
            case "token":
                items = [node.descriptor];
                paths = 1;
                break;
            default:
                items = [];
                paths = 1;
                break;
        }
        // even though caching may be disabled, we still need to retrieve
        // from the cache because rulesets and left recursion still use
        // the cache (if only momentarily)
        var cachedFrame = this.parseCache.retrieve(pos, node, leftOffset);
        if (cachedFrame) {
            if (cachedFrame.status == MatchStatus.Continue) {
                assert(cachedFrame.node.type == "ruleset");
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
                this.stack[i].leftContinuation.forEach(function (f) { f.cached = false, f.paths = -1; });
                var failFrame = {};
                failFrame.status = MatchStatus.Fail;
                failFrame.node = node;
                failFrame.items = items;
                failFrame.paths = current.paths + paths;
                failFrame.index = 0;
                failFrame.pos = pos;
                failFrame.consumed = 0;
                failFrame.wantOutput = current.wantOutput;
                // prevent this frame from attempting to store on top of our base frame
                failFrame.cached = true;
                failFrame.leftOffset = leftOffset;
                failFrame.captures = null;
                failFrame.output = null;
                this.stack.push(failFrame);
                var contFrame = {};
                // subsequent continuation executions need to pass at the top to kick off
                // downward descent through the stack
                contFrame.status = MatchStatus.Pass;
                contFrame.node = node;
                contFrame.items = items;
                contFrame.paths = -1;
                contFrame.index = 0; // this will get updated at execution
                contFrame.pos = pos;
                contFrame.consumed = 0; // this will get updated at execution
                contFrame.wantOutput = current.wantOutput;
                contFrame.cached = false;
                contFrame.leftOffset = leftOffset; // this will get updated at execution
                contFrame.captures = null;
                contFrame.output = null;
                this.stack[i].leftContinuation.push(contFrame);
            }
            else {
                // a repeating token frame will place itself in the cache multiple times,
                // but its pos will reflect its first entry in the cache. So, we may
                // want to update the frame pos and consumed here.
                cachedFrame.consumed -= pos - cachedFrame.pos;
                assert(cachedFrame.consumed >= 0);
                cachedFrame.pos = pos;
                this.stack.push(cachedFrame);
            }
        }
        else {
            var wantOutput = current && current.wantOutput;
            if (current && current.node.type == "capture") {
                wantOutput = true;
            }
            else if (current && current.node.type == "rule") {
                wantOutput = false;
            }
            var newFrame = {};
            newFrame.status = cachedFrame === false ? MatchStatus.Fail : MatchStatus.Continue;
            newFrame.node = node;
            newFrame.items = items;
            newFrame.paths = current ? current.paths + paths - 1 : paths;
            newFrame.index = 0;
            newFrame.pos = pos;
            newFrame.consumed = 0;
            newFrame.wantOutput = wantOutput;
            newFrame.cached = false;
            newFrame.leftOffset = leftOffset;
            newFrame.captures = null;
            newFrame.output = null;
            this.stack.push(newFrame);
            this.parseCache.store(newFrame);
        }
    };
    Parser.prototype.top = function () {
        return this.stack[this.stack.length - 1];
    };
    return Parser;
}());
exports.Parser = Parser;
function parserError(code) {
    var msg = exports.errorMessages[code];
    var e = new Error("Internal parser error " + code + ": " + msg);
    e["code"] = code;
    debugger;
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
function parsingError(code, buf, pos, expected) {
    expected = expected.map(function (i) { return i.replace(/\n/g, '\\n'); });
    var list = [].join.call(expected, '\n\t');
    var reason = expected.length == 1 ? "expected: " + list : "expected one of the following: \n\t" + list;
    var info = buf.findLineAndChar(pos);
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
