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
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsingError = exports.assert = exports.parserError = exports.Parser = exports.lastParser = exports.parseGrammar = exports.findDezentGrammar = exports.BufferEmpty = exports.errorMessages = exports.ErrorCode = void 0;
const Grammar_1 = require("./Grammar");
const ParseBuffer_1 = require("./ParseBuffer");
const GrammarCompiler_1 = require("./GrammarCompiler");
const Output_1 = require("./Output");
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
exports.BufferEmpty = { toString: () => "BufferEmpty" };
let dezentGrammar;
function findDezentGrammar() {
    if (!dezentGrammar) {
        dezentGrammar = Grammar_1.createUncompiledDezentGrammar();
        GrammarCompiler_1.GrammarCompiler.compileGrammar(dezentGrammar);
    }
    return dezentGrammar;
}
exports.findDezentGrammar = findDezentGrammar;
function parseGrammar(text, options) {
    let buf = new ParseBuffer_1.ParseBuffer(text);
    let parser = new Parser(findDezentGrammar(), buf, options);
    try {
        let grammar = parser.parse();
        GrammarCompiler_1.GrammarCompiler.compileGrammar(grammar, text, options.callbacks);
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
class Parser {
    constructor(grammar, buffer, options) {
        this.omitFails = 0;
        this.debugLog = [];
        this.errorPos = 0;
        this.failedPatterns = [];
        this.frameStack = [];
        exports.lastParser = this;
        this.grammar = grammar;
        let root;
        for (let ruleset of grammar.ruleset) {
            if (ruleset.name == 'return') {
                root = ruleset;
            }
        }
        if (!root) {
            GrammarCompiler_1.grammarError(ErrorCode.ReturnNotFound, grammar.text);
        }
        this.root = root;
        this.buffer = buffer;
        this.rulesets = grammar.rulesetLookup;
        this.options = {};
        for (let pragma in grammar.pragmas) {
            GrammarCompiler_1.grammarError(ErrorCode.UnknownPragma, pragma);
            this.options[pragma] = grammar.pragmas[pragma];
        }
        for (let option in options) {
            this.options[option] = options[option];
        }
        this.valueBuilder = new Output_1.ValueBuilder(grammar, this.options.callbacks);
        this.callFrame(null, root);
    }
    run() {
        CURRENT: while (true) {
            let current = this.frameStack[this.frameStack.length - 1];
            if (current.complete) {
                if (this.frameStack.length == 1) {
                    // our parsing is complete
                    // in the case of streaming, if we get a parse error we want to bail
                    // before close, i.e. as soon as the parse error happens. So do this
                    // check prior to checking for BufferEmpty.
                    if (!current.matched) {
                        parsingError(ErrorCode.TextParsingError, this.buffer, this.errorPos, this.expectedTerminals());
                    }
                    if (!this.buffer.closed) {
                        if (current.consumed == this.buffer.length) {
                            // give our upstream caller a chance to close() the buffer
                            return exports.BufferEmpty;
                        }
                        else {
                            parsingError(ErrorCode.TextParsingError, this.buffer, this.errorPos, this.expectedTerminals());
                        }
                    }
                    if (current.pos != 0) {
                        parserError(ErrorCode.InputConsumedBeforeResult);
                    }
                    if (!current.output) {
                        parserError(ErrorCode.EmptyOutput);
                    }
                    if (current.output.length < this.buffer.length) {
                        parsingError(ErrorCode.TextParsingError, this.buffer, this.errorPos, this.expectedTerminals());
                    }
                    if (current.output.length > this.buffer.length) {
                        parsingError(ErrorCode.TextParsingError, this.buffer, this.errorPos, ["<EOF>"]);
                    }
                    if (this.options.dumpDebug) {
                        this.dumpDebug();
                    }
                    return current.output.value;
                }
                if (this.options.debugErrors) {
                    this.debugLog.push([
                        current.matched ? 'PASS ' : 'FAIL ',
                        this.buffer.substr(current.pos, 20),
                        current.ruleset ? current.ruleset.name : current.selector.type,
                        JSON.stringify(current.ruleset ? current.output : current.captures)
                    ]);
                }
                this.frameStack.pop();
                continue CURRENT;
            }
            let matched = false, consumed = 0;
            do {
                let callee;
                let consumedPos = current.pos + current.consumed;
                let descriptor = current.token.descriptor;
                if (descriptor.match) {
                    try {
                        [matched, consumed] = descriptor.match(this.buffer, consumedPos);
                    }
                    catch (e) {
                        if (this.buffer.closed && e == ParseBuffer_1.ParseBufferExhaustedError) {
                            [matched, consumed] = [false, 0];
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
                    let calleeNode = (descriptor.type == "ruleref" ? this.rulesets[descriptor.name] : descriptor);
                    this.callFrame(current, calleeNode);
                    if (!calleeNode.canFail) {
                        this.omitFails++;
                    }
                    continue CURRENT;
                }
                else {
                    callee = current.callee;
                    current.callee = null;
                    matched = callee.matched;
                    consumed = callee.consumed;
                    if ((callee.ruleset && !callee.ruleset.canFail) || (callee.selector && !callee.selector.canFail)) {
                        this.omitFails--;
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
                        // at this point our left recursion is failing to consume more input,
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
                if (this.options.debugErrors && !callee) {
                    this.debugLog.push([
                        matched ? 'PASS ' : 'FAIL ',
                        this.buffer.substr(consumedPos, 20),
                        descriptor["pattern"]
                    ]);
                }
                if (current.token.required && !matched
                    // + modifiers repeat and are required, so we only fail when we haven't consumed...
                    && consumedPos - current.tokenPos == 0) {
                    // our token failed, therefore the pattern fails
                    if (consumedPos >= this.errorPos && !this.omitFails && descriptor.pattern) {
                        if (consumedPos > this.errorPos) {
                            this.failedPatterns.length = 0;
                            this.errorPos = consumedPos;
                        }
                        let pattern = descriptor.pattern;
                        if (current.token.not)
                            pattern = 'not: ' + pattern;
                        this.failedPatterns.push(pattern);
                    }
                    current.consumed = 0;
                    if (++current.patternIndex >= current.selector.patterns.length) {
                        // no matching pattern - go to next rule if applicable, or fail if not
                        if (current.ruleset) {
                            this.nextRule(current);
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
                    let output = {
                        captureIndex: descriptor.index,
                        position: consumedPos,
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
            if (++current.tokenIndex < current.pattern.tokens.length) {
                current.token = current.pattern.tokens[current.tokenIndex];
                current.tokenPos = current.pos + current.consumed;
            }
            else {
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
                            value: this.buffer.substr(current.pos, current.consumed),
                        });
                    }
                    // always build the value so that output callbacks can be called
                    // even if the grammar returns null
                    let value = this.valueBuilder.buildValue(current);
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
                    let output = current.output;
                    if (!output) {
                        // create a capture text segment - based on our current node, not the callee
                        output = {
                            position: current.pos,
                            length: current.consumed,
                            value: this.buffer.substr(current.pos, current.consumed),
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
            continue CURRENT; // redundant; for clarity
        }
    }
    expectedTerminals() {
        let lookup = {};
        let out = [];
        for (let terminal of this.failedPatterns) {
            if (!lookup[terminal]) {
                out.push(terminal);
                lookup[terminal] = true;
            }
        }
        return out;
    }
    nextRule(frame) {
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
    }
    parse() {
        if (this.error) {
            throw this.error;
        }
        try {
            let result = this.run();
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
    }
    callFrame(current, callee) {
        let pos = current ? current.pos + current.consumed : 0;
        let recursed;
        if (current && callee.type == "ruleset") {
            for (let i = this.frameStack.length - 1; i >= 0; i--) {
                let check = this.frameStack[i];
                if (check.pos != current.pos) {
                    break;
                }
                if (check.ruleset && check.ruleset.name == callee.name) {
                    recursed = check;
                    break;
                }
            }
        }
        let frame;
        let secondFrame;
        if (recursed) {
            // left recursion detected - see notes near the top of this file
            frame = Object.assign({}, recursed);
            if (recursed.leftRecursing) {
                // this is the second or later recursion iteration.
                // set up the base frame's previous returning callee
                // as our callee now so it can properly recurse.
                frame.leftRecursing = false;
                frame.callee = frame.leftReturn;
                frame.leftReturn = null;
                current.callee = frame;
                this.frameStack.push(frame);
                this.frameStack.push(secondFrame = frame.callee);
            }
            else {
                // this is the first recursion iteration - get ourselves ready
                // to work through multiple recursion iterations by marking our
                // base frame as left recursing and advancing our new frame to
                // avoid infinite loop.
                this.nextRule(frame);
                recursed.leftRecursing = true;
                current.callee = frame;
                this.frameStack.push(frame);
            }
        }
        else if (!frame) {
            let selector = callee.type == "ruleset" ? callee.rules[0] : callee;
            let pattern = selector.patterns[0];
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
                callee: null,
                wantOutput: current && (current.selector.type == "capture" || current.wantOutput),
                output: null,
                captures: null,
                leftRecursing: false,
                leftReturn: null,
            };
            if (current)
                current.callee = frame;
            this.frameStack.push(frame);
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
    }
    dumpDebug() {
        if (this.options.debugErrors) {
            let lines = [];
            for (let msg of this.debugLog) {
                lines.push(msg.join('\t').replace(/\n/g, '\\n'));
            }
            console.log("Debug log:\n", lines.join("\n"));
        }
    }
}
exports.Parser = Parser;
function parserError(code) {
    let msg = exports.errorMessages[code];
    let e = new Error(`Internal parser error ${code}: ${msg}`);
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
    expected = expected.map((i) => i.replace(/\n/g, '\\n'));
    let list = [].join.call(expected, '\n\t');
    let reason = expected.length == 1 ? `expected: ${list}` : `expected one of the following: \n\t${list}`;
    let info = buf.findLineAndChar(pos);
    let backrefs = [null, info.line, info.char, reason, info.lineText, info.pointerText];
    let msg = exports.errorMessages[code].replace(/\$([0-9])/g, (match, index) => String(backrefs[index]));
    let e = new Error(msg);
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
