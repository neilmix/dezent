"use strict";
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
exports.parsingError = exports.assert = exports.parserError = exports.Parser = exports.lastParser = exports.parseGrammar = exports.findDezentGrammar = exports.BufferEmpty = exports.errorMessages = exports.ErrorCode = void 0;
var Grammar_1 = require("./Grammar");
var ParseBuffer_1 = require("./ParseBuffer");
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
    ErrorCode[ErrorCode["FunctionNotFound"] = 1009] = "FunctionNotFound";
    ErrorCode[ErrorCode["CallbackError"] = 1010] = "CallbackError";
    ErrorCode[ErrorCode["InvalidObjectTuple"] = 1011] = "InvalidObjectTuple";
    ErrorCode[ErrorCode["InvalidAccessRoot"] = 1012] = "InvalidAccessRoot";
    ErrorCode[ErrorCode["InvalidAccessIndex"] = 1013] = "InvalidAccessIndex";
    ErrorCode[ErrorCode["InvalidAccessProperty"] = 1014] = "InvalidAccessProperty";
    ErrorCode[ErrorCode["UnknownPragma"] = 1015] = "UnknownPragma";
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
    ErrorCode[ErrorCode["InputFreed"] = 2012] = "InputFreed";
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
    1009: "Function not found: $1",
    1010: "Error executing callback: $1",
    1011: "When spreading an array into an object, array elements must be arrays of length 2 but instead received: $1",
    1012: "Attempted to access property of non-object value: $1",
    1013: "Attempted to access property using a key that was not a string or number: $1",
    1014: "Attempted to access a property that doesn't exist: $1",
    1015: "Unknown pragma: $1",
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
    2012: "Input text was referenced (perhaps via $0?) but has already released to free memory. Try increasing minBufferSizeInMB.",
};
exports.BufferEmpty = { toString: function () { return "BufferEmpty"; } };
var dezentGrammar;
function findDezentGrammar() {
    if (!dezentGrammar) {
        dezentGrammar = Grammar_1.createUncompiledDezentGrammar();
        GrammarCompiler_1.GrammarCompiler.compileGrammar(dezentGrammar);
    }
    return dezentGrammar;
}
exports.findDezentGrammar = findDezentGrammar;
function parseGrammar(text, options) {
    var buf = new ParseBuffer_1.ParseBuffer(text);
    var parser = new Parser(findDezentGrammar(), buf, options);
    try {
        var grammar = parser.parse();
        GrammarCompiler_1.GrammarCompiler.compileGrammar(grammar, text);
        return grammar;
    }
    catch (e) {
        parser.dumpDebug();
        if (e["code"] == ErrorCode.TextParsingError) {
            parsingError(ErrorCode.GrammarParsingError, buf, e["pos"], e["expected"]);
        }
        else {
            throw e;
        }
    }
}
exports.parseGrammar = parseGrammar;
exports.lastParser = null; // for testing purposes
var Parser = /** @class */ (function () {
    function Parser(grammar, buffer, options) {
        var e_1, _a;
        var _this = this;
        this.current = null;
        this.cache = [];
        this.omitFails = 0;
        this.debugLog = [];
        this.maxPos = 0;
        this.failedPatterns = [];
        exports.lastParser = this;
        this.grammar = grammar;
        var root;
        try {
            for (var _b = __values(grammar.ruleset), _c = _b.next(); !_c.done; _c = _b.next()) {
                var ruleset = _c.value;
                if (ruleset.name == 'return') {
                    root = ruleset;
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        if (!root) {
            GrammarCompiler_1.grammarError(ErrorCode.ReturnNotFound, grammar.text);
        }
        this.root = root;
        this.buffer = buffer;
        this.rulesets = grammar.rulesetLookup;
        this.options = {};
        for (var pragma in grammar.pragmas) {
            GrammarCompiler_1.grammarError(ErrorCode.UnknownPragma, pragma);
            this.options[pragma] = grammar.pragmas[pragma];
        }
        for (var option in options) {
            this.options[option] = options[option];
        }
        this.valueBuilder = new Output_1.ValueBuilder(grammar, this.options.callbacks);
        this.callFrame(root);
        this.run = function () {
            var _a, _b;
            var current;
            CURRENT: while (current = _this.current) {
                if (current.complete) {
                    if (current.caller) {
                        // a left-recursing frame could be cached at the same location as the current frame,
                        // so we need to double-check that current is the one that is cached
                        if (_this.cache[current.cacheKey] == current) {
                            delete _this.cache[current.cacheKey];
                        }
                        if (_this.options.debugErrors) {
                            _this.debugLog.push([
                                current.matched ? 'PASS ' : 'FAIL ',
                                _this.buffer.substr(current.pos, 20),
                                current.ruleset ? current.ruleset.name : current.selector.type,
                                JSON.stringify(current.ruleset ? current.output : current.captures)
                            ]);
                        }
                        _this.current = current.caller;
                        current.caller = null;
                        continue CURRENT;
                    }
                    // our parsing is complete
                    // in the case of streaming, if we get a parse error we want to bail
                    // before close, i.e. as soon as the parse error happens. So do this
                    // check prior to checking for BufferEmpty.
                    if (!current.matched) {
                        parsingError(ErrorCode.TextParsingError, _this.buffer, _this.maxPos, _this.expectedTerminals());
                    }
                    if (!_this.buffer.closed) {
                        if (current.consumed == buffer.length) {
                            // give our upstream caller a chance to close() the buffer
                            return exports.BufferEmpty;
                        }
                        else {
                            parsingError(ErrorCode.TextParsingError, _this.buffer, _this.maxPos, _this.expectedTerminals());
                        }
                    }
                    if (current.pos != 0) {
                        parserError(ErrorCode.InputConsumedBeforeResult);
                    }
                    if (!current.output) {
                        parserError(ErrorCode.EmptyOutput);
                    }
                    if (current.output.length < _this.buffer.length) {
                        parsingError(ErrorCode.TextParsingError, _this.buffer, _this.maxPos, _this.expectedTerminals());
                    }
                    if (current.output.length > _this.buffer.length) {
                        parsingError(ErrorCode.TextParsingError, _this.buffer, _this.maxPos, ["<EOF>"]);
                    }
                    if (_this.options.dumpDebug) {
                        _this.dumpDebug();
                    }
                    return current.output.value;
                }
                var descriptor = current.token.descriptor;
                var matched = false, consumed = 0;
                do {
                    var callee = void 0;
                    if (descriptor["match"]) {
                        try {
                            _a = __read(descriptor.match(_this.buffer, current.pos + current.consumed), 2), matched = _a[0], consumed = _a[1];
                        }
                        catch (e) {
                            if (_this.buffer.closed && e == ParseBuffer_1.ParseBufferExhaustedError) {
                                _b = __read([false, 0], 2), matched = _b[0], consumed = _b[1];
                            }
                            else if (e == ParseBuffer_1.ParseBufferExhaustedError) {
                                return exports.BufferEmpty;
                            }
                            else {
                                throw e;
                            }
                        }
                    }
                    else if (!current.callee) {
                        var calleeNode = (descriptor.type == "ruleref" ? _this.rulesets[descriptor.name] : descriptor);
                        _this.callFrame(calleeNode);
                        if (!calleeNode.canFail) {
                            _this.omitFails++;
                        }
                        continue CURRENT;
                    }
                    else {
                        callee = current.callee;
                        current.callee = null;
                        matched = callee.matched;
                        consumed = callee.consumed;
                        if ((callee.ruleset && !callee.ruleset.canFail) || (callee.selector && !callee.selector.canFail)) {
                            _this.omitFails--;
                        }
                    }
                    // see notes on left recursion toward the beginning of this file
                    if (current.leftRecursing) {
                        // it's possible to get a match without consuming more input than previous
                        // recursion attempts, so make sure there's increased consumption, too.
                        if (matched && (current.leftReturn == null || consumed > current.leftReturn.consumed)) {
                            // stow away our returning callee for later use in the next recursion iteration
                            current.leftReturn = callee;
                        }
                        else {
                            // at this point our left recursion is failing to consumer more input,
                            // time to wrap things up
                            current.complete = true;
                            if (current.leftReturn) {
                                // we found the largest match for this recursing rule on a previous iteration.
                                // use that as the return value for this frame.
                                current.matched = true;
                                current.consumed = current.leftReturn.consumed;
                                current.output = current.leftReturn.output;
                            }
                        }
                        continue CURRENT;
                    }
                    if (current.token.and || current.token.not) {
                        matched = (current.token.and && matched) || (current.token.not && !matched);
                        consumed = 0;
                    }
                    if (_this.options.debugErrors && !callee) {
                        _this.debugLog.push([
                            matched ? 'PASS ' : 'FAIL ',
                            _this.buffer.substr(current.pos + current.consumed, 20),
                            descriptor["pattern"]
                        ]);
                    }
                    if (current.token.required && !matched
                        // + modifiers repeat and are required, so we only fail when we haven't consumed...
                        && current.pos + current.consumed - current.tokenPos == 0) {
                        // our token failed, therefore the pattern fails
                        if (current.pos + current.consumed == _this.maxPos && !_this.omitFails && descriptor["pattern"]) {
                            var pattern = descriptor["pattern"];
                            if (current.token.not)
                                pattern = 'not: ' + pattern;
                            _this.failedPatterns.push(pattern);
                        }
                        current.consumed = 0;
                        if (++current.patternIndex >= current.selector.patterns.length) {
                            // no matching pattern - go to next rule if applicable, or fail if not
                            if (current.ruleset) {
                                _this.nextRule(current);
                            }
                            else {
                                current.complete = true;
                            }
                        }
                        else {
                            current.pattern = current.selector.patterns[current.patternIndex];
                            current.tokenIndex = 0;
                            current.token = current.pattern.tokens[0];
                        }
                        continue CURRENT;
                    }
                    if (matched) {
                        current.consumed += consumed;
                        if (current.pos + current.consumed > _this.maxPos) {
                            _this.maxPos = current.pos + current.consumed;
                            _this.failedPatterns.length = 0;
                        }
                        if (current.selector.type == "capture") {
                            if (callee && callee.output && callee.ruleset && current.pattern.tokens.length == 1) {
                                // output has descended the stack to our capture - capture it
                                // but only if it's the only node in this capture
                                current.output = callee.output;
                            }
                        }
                        else if (callee && callee.captures) {
                            // captures need to descend the stack
                            if (current.captures) {
                                current.captures = current.captures.concat(callee.captures);
                            }
                            else {
                                current.captures = callee.captures;
                            }
                        }
                    }
                    else if (descriptor.type == "capture" && !current.token.required && !current.token.repeat) {
                        // a failed non-required non-repeating capture should yield null
                        var output = {
                            captureIndex: descriptor.index,
                            position: current.pos + current.consumed,
                            length: 0,
                            value: null
                        };
                        if (current.captures) {
                            current.captures.push(output);
                        }
                        else {
                            current.captures = [output];
                        }
                    }
                    // don't continue STACK here because a) we may be a repeating token
                    // and b) we need to increment tokenIndex below.
                } while (matched && current.token.repeat && consumed > 0); // make sure we consumed to avoid infinite loops
                if (++current.tokenIndex >= current.pattern.tokens.length) {
                    // we got through all tokens successfully - pass!
                    current.matched = true;
                    current.complete = true;
                    if (current.ruleset) {
                        if (current.selector.hasBackref0) {
                            // create a capture for $0 backref
                            if (!current.captures)
                                current.captures = [];
                            current.captures.push({
                                captureIndex: 0,
                                position: current.pos,
                                length: current.consumed,
                                value: _this.buffer.substr(current.pos, current.consumed),
                            });
                        }
                        // always build the value so that output callbacks can be called
                        // even if the grammar returns null
                        var value = _this.valueBuilder.buildValue(current);
                        // prevent captures from continuing to descend
                        current.captures = null;
                        if (current.wantOutput || (current.ruleset && current.ruleset.name == "return")) {
                            // our ruleset was called up the stack by a capture - create an output (which will descend the stack)
                            current.output = {
                                position: current.pos,
                                length: current.consumed,
                                value: value
                            };
                        }
                    }
                    else if (current.selector.type == "capture") {
                        var output = current.output;
                        if (!output) {
                            // create a capture text segment - based on our current node, not the callee
                            output = {
                                position: current.pos,
                                length: current.consumed,
                                value: _this.buffer.substr(current.pos, current.consumed),
                            };
                        }
                        output.captureIndex = current.selector.index;
                        if (current.captures) {
                            current.captures.push(output);
                        }
                        else {
                            current.captures = [output];
                        }
                    }
                }
                else {
                    current.token = current.pattern.tokens[current.tokenIndex];
                    current.tokenPos = current.pos + current.consumed;
                }
                continue CURRENT; // redundant; for clarity
            }
        };
    }
    Parser.prototype.expectedTerminals = function () {
        var e_2, _a;
        var lookup = {};
        var out = [];
        try {
            for (var _b = __values(this.failedPatterns), _c = _b.next(); !_c.done; _c = _b.next()) {
                var terminal = _c.value;
                if (!lookup[terminal]) {
                    out.push(terminal);
                    lookup[terminal] = true;
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
        return out;
    };
    Parser.prototype.nextRule = function (frame) {
        frame.ruleIndex++;
        frame.selector = frame.ruleset.rules[frame.ruleIndex];
        frame.callee = null;
        if (!frame.selector) {
            frame.complete = true;
        }
        else {
            frame.patternIndex = 0;
            frame.pattern = frame.selector.patterns[0];
            frame.tokenIndex = 0;
            frame.token = frame.pattern.tokens[0];
            if (frame.captures)
                frame.captures.length = 0;
        }
    };
    Parser.prototype.parse = function () {
        if (this.error) {
            throw this.error;
        }
        try {
            var result = this.run();
            if (result == exports.BufferEmpty) {
                assert(!this.buffer.closed);
                return undefined;
            }
            else {
                return result;
            }
        }
        catch (e) {
            assert(e != ParseBuffer_1.ParseBufferExhaustedError);
            this.dumpDebug();
            this.error = e;
            throw e;
        }
    };
    Parser.prototype.callFrame = function (callee) {
        var pos = this.current ? this.current.pos + this.current.consumed : 0;
        var cacheKey = pos * this.grammar.maxid + callee.id;
        var frame;
        var cached = callee.type == "ruleset" ? this.cache[cacheKey] : null;
        var secondFrame;
        if (cached) {
            // left recursion detected - see notes near the top of this file
            frame = Object.assign({}, cached);
            if (cached.leftRecursing) {
                // this is the second or later recursion iteration.
                // set up the base frame's previous returning callee
                // as our callee now so it can properly recurse.
                frame.leftRecursing = false;
                frame.callee = frame.leftReturn;
                frame.leftReturn = null;
                this.current.callee = frame;
                frame.caller = this.current;
                frame.callee.caller = frame;
                this.current = secondFrame = frame.callee;
            }
            else {
                // this is the first recursion iteration - get ourselves ready
                // to work through multiple recursion iterations by marking our
                // base frame as left recursing and advancing our new frame to
                // avoid infinite loop.
                this.nextRule(frame);
                cached.leftRecursing = true;
                this.current.callee = frame;
                frame.caller = this.current;
                this.current = frame;
            }
        }
        else if (!frame) {
            var selector = callee.type == "ruleset" ? callee.rules[0] : callee;
            var pattern = selector.patterns[0];
            frame = {
                matched: false,
                complete: false,
                ruleset: callee.type == "ruleset" ? callee : null,
                ruleIndex: 0,
                selector: selector,
                patternIndex: 0,
                pattern: pattern,
                tokenIndex: 0,
                token: pattern.tokens[0],
                pos: pos,
                tokenPos: pos,
                consumed: 0,
                caller: this.current,
                callee: null,
                wantOutput: this.current && (this.current.selector.type == "capture" || this.current.wantOutput),
                output: null,
                captures: null,
                cacheKey: cacheKey,
                leftRecursing: false,
                leftReturn: null,
            };
            if (callee.type == "ruleset") {
                this.cache[frame.cacheKey] = frame;
            }
            if (this.current)
                this.current.callee = frame;
            this.current = frame;
        }
        if (this.options.debugErrors) {
            this.debugLog.push([
                'enter',
                this.buffer.substr(frame.pos, 20),
                frame.ruleset ? frame.ruleset.name : frame.selector.type
            ]);
            if (secondFrame) {
                this.debugLog.push([
                    'enter',
                    this.buffer.substr(secondFrame.pos, 20),
                    secondFrame.ruleset ? secondFrame.ruleset.name : secondFrame.selector.type
                ]);
            }
        }
    };
    Parser.prototype.dumpDebug = function () {
        var e_3, _a;
        if (this.options.debugErrors) {
            var lines = [];
            try {
                for (var _b = __values(this.debugLog), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var msg = _c.value;
                    lines.push(msg.join('\t').replace(/\n/g, '\\n'));
                }
            }
            catch (e_3_1) { e_3 = { error: e_3_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_3) throw e_3.error; }
            }
            console.log("Debug log:\n", lines.join("\n"));
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
