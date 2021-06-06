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

import { 
    Grammar, createUncompiledDezentGrammar, RulesetNode, ReturnNode,
    SelectorNode, RuleRefNode, MatcherNode, CaptureNode
} from "./Grammar";

import { ParseBuffer, ParseBufferExhaustedError } from "./ParseBuffer";
import { GrammarCompiler, grammarError } from "./GrammarCompiler";
import { Output, Functions, ValueBuilder } from "./Output";

export enum ErrorCode {
    TextParsingError          = 1,
    GrammarParsingError       = 2,

    DuplicateDefine           = 1001,
    MultipleReturn            = 1002,
    RuleNotFound              = 1003,
    InvalidSpread             = 1004,
    ReturnNotFound            = 1005,
    CaptureCountMismatch      = 1006,
    InvalidBackRef            = 1007,
    InvalidConstRef           = 1008,
    InvalidPivot              = 1009,
    PivotArraySizeMismatch    = 1010,
    InvalidObjectTuple        = 1011,
    InvalidAccessRoot         = 1012,
    InvalidAccessIndex        = 1013,
    InvalidAccessProperty     = 1014,
    FunctionNotFound          = 1015,
    UnknownPragma             = 2016,

    ArrayOverrun              = 2001,
    MismatchOutputFrames      = 2002,
    CaptureAlreadyInProgress  = 2003,
    MismatchEndCapture        = 2004,
    EmptyOutput               = 2005,
    Unreachable               = 2006,
    BackRefNotFound           = 2007,
    CaptureOutputNotFound     = 2008,
    InputConsumedBeforeResult = 2009,
    MultipleOutputsForCapture = 2010,
    AssertionFailure          = 2011,
}

export const errorMessages = {
    1:    "Parse failed: $3\nAt line $1 char $2:\n$4\n$5",
    2:    "Error parsing grammar: $3\nAt line $1 char $2:\n$4\n$5",
    
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
}

export type ParseFrame = {
    complete: boolean,
    matched: boolean,
    ruleset: RulesetNode | null,
    selector: SelectorNode,
    ruleIndex: number,
    patternIndex: number,
    tokenIndex: number,
    pos: number,
    tokenPos: number,
    consumed: number,
    callee: ParseFrame | null,
    wantOutput: boolean,
    output?: Output,
    captures?: Output[],
    cacheKey: number,
    leftContinuation?: ParseFrame[],
}

export const BufferEmpty = { toString: () => "BufferEmpty" };

let dezentGrammar:Grammar;

export function findDezentGrammar() : Grammar{
    if (!dezentGrammar) {
        dezentGrammar = createUncompiledDezentGrammar();
        GrammarCompiler.compileGrammar(dezentGrammar);
    }
    return dezentGrammar;
}

export interface ParserOptions {
    debugErrors?: boolean,
}

export function parseGrammar(text:string, options?:ParserOptions) : Grammar {
    let buf = new ParseBuffer(text);
    let parser = new Parser(findDezentGrammar(), buf, null, options);
    try {
        let grammar = parser.parse();
        GrammarCompiler.compileGrammar(grammar, text);
        return grammar;
    } catch(e) {
        parser.dumpDebug();
        if (e["code"] == ErrorCode.TextParsingError) {
            parsingError(ErrorCode.GrammarParsingError, buf, e["pos"], e["expected"]);
        } else {
            throw e;
        }
    }
}

export var lastParser:Parser = null; // for testing purposes

export class Parser {
    grammar : Grammar;
    root : ReturnNode;
    stack : ParseFrame[] = [];
    cache : ParseFrame[] = [];
    buffer : ParseBuffer;
    rulesets: {[key:string]:RulesetNode};
    valueBuilder : ValueBuilder;
    options : ParserOptions;
    omitFails : number = 0;
    debugLog : any[][] = [];
    run : Function;
    error : Error;

    constructor(grammar:Grammar, buffer:ParseBuffer, functions:Functions, options:ParserOptions) {
        lastParser = this;

        this.grammar = grammar;

        let root:ReturnNode;
    
        for (let ruleset of grammar.ruleset) {
            if (ruleset.name == 'return') {
                root = <ReturnNode>ruleset;
            }
        }
    
        if (!root) {
            grammarError(ErrorCode.ReturnNotFound, grammar.text);
        }

        this.root = root;
        this.buffer = buffer;

        this.rulesets = grammar.rulesetLookup;
        this.options = {};
        for (let pragma in grammar.pragmas) {
            grammarError(ErrorCode.UnknownPragma, pragma);
            this.options[pragma] = grammar.pragmas[pragma];
        }
        for (let option in options) {
            this.options[option] = options[option];
        }
        this.valueBuilder = new ValueBuilder(grammar, functions);
        this.callFrame(null, root);

        let maxPos = 0;
        let failedPatterns = {};
        this.run = () => {    
            STACK: while (this.stack.length) {
                let current = this.top();

                // omitFails?
                // left recursion?
                // caching?

                if (current.complete) {
                    if (this.stack.length > 1) {
                        let exited = this.stack.pop();
                        delete this.cache[exited.cacheKey];
                        if (this.options.debugErrors && exited.ruleset) {
                            this.debugLog.push([
                                exited.matched ? 'PASS' : 'FAIL', 
                                this.buffer.substr(exited.pos, 20), 
                                exited.ruleset.name
                            ]);
                        }
                        continue STACK;
                    }

                    let final = this.stack[0];
                    if (!this.buffer.closed) {
                        return BufferEmpty;
                    }
                    // our parsing is complete
                    if (!final.output) {
                        parserError(ErrorCode.EmptyOutput);
                    }
                    if (final.pos != 0) {
                        parserError(ErrorCode.InputConsumedBeforeResult);
                    }
                    if (final.output.length < this.buffer.length) {
                        parsingError(ErrorCode.TextParsingError, this.buffer, maxPos, expectedTerminals());
                    }        
                    if (final.output.length > this.buffer.length) {
                        parsingError(ErrorCode.TextParsingError, this.buffer, maxPos, ["<EOF>"]);
                    }
                    return final.output.value;
                }
                
                if (current.ruleset && current.ruleIndex >= current.ruleset.rules.length) {
                    // no matching rules - fail
                    current.complete = true;
                    continue STACK;    
                }

                let pattern = current.selector.patterns[current.patternIndex];
                if (!pattern) {
                    // no matching pattern - go to next rule if applicable, or fail if not
                    if (current.ruleset) {
                        this.nextRule(current);
                    } else {
                        current.complete = true;
                    }
                    continue STACK;
                }

                let token = pattern.tokens[current.tokenIndex];
                if (!token) {
                    // we got through all tokens successfully - pass!
                    current.matched = true;
                    current.complete = true;

                    if (current.ruleset) {
                        // create a capture for $0 backref
                        if (!current.captures) current.captures = [];
                        current.captures.push({
                            captureIndex: 0,
                            position: current.pos,
                            length: current.consumed,
                            value: this.buffer.substr(current.pos, current.consumed),
                        });

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
                            }
                        }
                    } else if (current.selector.type == "capture") {
                        let output = current.output;
                        if (!output) {
                            // create a capture text segment - based on our current node, not the callee
                            output = {
                                position: current.pos,
                                length: current.consumed,
                                value: this.buffer.substr(current.pos, current.consumed),
                            };                            
                        }
                        output.captureIndex = (<CaptureNode>current.selector).index;
                        if (current.captures) {
                            current.captures.push(output);
                        } else {
                            current.captures = [output];
                        }
                    }
                    continue STACK; 
                }

                let descriptor = token.descriptor;
                let matched = false, consumed = 0;
                do {
                    let callee;
                    if (["string","class","any"].includes(descriptor.type)) {
                        try {
                            [matched, consumed] = (<MatcherNode>descriptor).match(this.buffer, current.pos + current.consumed);
                        } catch(e) {
                            if (this.buffer.closed && e == ParseBufferExhaustedError) {
                                [matched, consumed] = [false, 0];
                            } else if (e == ParseBufferExhaustedError) {
                                return BufferEmpty;
                            } else {
                                throw e;
                            }
                        }
                    } else if (!current.callee) {
                        let calleeNode = <SelectorNode> (descriptor.type == "ruleref" ? this.rulesets[(<RuleRefNode>descriptor).name] : descriptor);
                        this.callFrame(current, calleeNode);
                        if (!calleeNode.canFail) {
                            this.omitFails++;
                        }
                        continue STACK;
                    } else {
                        callee = current.callee;
                        current.callee = null;
                        matched = callee.matched;
                        consumed = callee.consumed;
                        if ((callee.ruleset && !callee.ruleset.canFail) || (callee.selector && !callee.selector.canFail)) {
                            this.omitFails--;
                        }
                    }

                    if (token.and || token.not) {
                        matched = (token.and && matched) || (token.not && !matched);
                        consumed = 0;
                    } 
                    
                    if (this.options.debugErrors && !callee) {
                        this.debugLog.push([
                            matched ? 'PASS' : 'FAIL', 
                            this.buffer.substr(current.pos + current.consumed, 20), 
                            descriptor["pattern"]
                        ]);
                    }

                    if (token.required && !matched 
                           // + modifiers repeat and are required, so we only fail when we haven't consumed...
                        && current.pos + current.consumed - current.tokenPos == 0
                    ) {
                        // our token failed, therefore the pattern fails
                        if (current.pos + current.consumed == maxPos && !this.omitFails && descriptor["pattern"]) {
                            failedPatterns[descriptor["pattern"]] = true;
                        }
                        current.consumed = 0;
                        current.patternIndex++;
                        current.tokenIndex = 0;
                        continue STACK;
                    }

                    if (matched) {
                        current.consumed += consumed;
                        if (current.pos + current.consumed > maxPos) {
                            maxPos = current.pos + current.consumed;
                            failedPatterns = {};
                        }

                        if (current.selector.type == "capture") {
                            if (callee && callee.output && callee.ruleset && pattern.tokens.length == 1) {
                                // output has descended the stack to our capture - capture it
                                // but only if it's the only node in this capture
                                current.output = callee.output;
                            }
                        } else if (callee && callee.captures) {
                            // captures need to descend the stack
                            if (current.captures) {
                                current.captures = current.captures.concat(callee.captures);
                            } else {
                                current.captures = callee.captures;
                            }
                        }
                    } else if (descriptor.type == "capture" && !token.required && !token.repeat) {
                        // a failed non-required non-repeating capture should yield null
                        let output = {
                            captureIndex: (<CaptureNode>descriptor).index,
                            position: current.pos + current.consumed,
                            length: 0,
                            value: null
                        };
                        if (current.captures) {
                            current.captures.push(output);
                        } else {
                            current.captures = [output];
                        }
                    }
                    // don't continue STACK here because a) we may be a repeating token
                    // and b) we need to increment tokenIndex below.
                } while (matched && token.repeat && consumed > 0); // make sure we consumed to avoid infinite loops
                current.tokenIndex++;
                current.tokenPos = current.pos + current.consumed;
                continue STACK;    
            }
                /*
                    // special handling is required for left recursion
                    if (next.leftContinuation) {
                        if (exited.matched && exited.consumed > next.consumed) {
                            assert(exited.node.type == "rule");
                            // try again using a copy of our continuation, but update our leftOffsets 
                            // to reflect further consumption
                            next.consumed = exited.consumed;
                            let continuation = next.leftContinuation.map((frame) => Object.assign({}, frame));
                            continuation.forEach((frame) => frame.leftOffset += exited.consumed);
                            this.stack = this.stack.concat(continuation);
                            // update the state of the ruleset at the top of our stack
                            let top = this.stack[this.stack.length-1];
                            assert(top.node.type == "ruleset");
                            top.consumed = exited.consumed;
                            top.index = (<RuleNode>exited.node).rulesetIndex;
                            if (top.wantOutput) {
                                this.yieldOutput(exited, top, next);
                                // the final pass will fail, so we want to make sure our base frame
                                // contains results from the most recent successful run
                                next.output = top.output;
                            }
                            // we got at least one successful continuation - mark our base ruleset as a success
                            next.matched = true;
                            next.complete = true;
                            continue;
                        } else if (next.matched) {
                            // we previously successfully recursed, we're passing!
                            // don't fall through or we'll get marked as a fail.
                            continue;
                        }
                        // FALL THROUGH
                    }
                */
            
            function expectedTerminals() {
                return Object.keys(failedPatterns);
            }
        }    
    }

    nextRule(frame:ParseFrame) {
        frame.ruleIndex++;
        frame.selector = frame.ruleset.rules[frame.ruleIndex];
        if (!frame.selector) {
            frame.complete = true;
        } else {
            frame.patternIndex = 0;
            frame.tokenIndex = 0;
            if (frame.captures) frame.captures.length = 0;
        }
    }

    parse() : any {
        if (this.error) {
            throw this.error;
        }
        
        try {
            let result = this.run();
            if (result == BufferEmpty) {
                assert(!this.buffer.closed);
                return undefined;
            } else {
                return result;
            }
        } catch(e) {
            assert(e != ParseBufferExhaustedError);
            this.dumpDebug();
            this.error = e;
            throw e;
        }    
    }

    callFrame(caller:ParseFrame, callee:SelectorNode|RulesetNode) {
        let pos = caller ? caller.pos + caller.consumed : 0;
        let cacheKey = pos * this.grammar.maxid + callee.id;

        let frame = callee.type == "ruleset" ? this.cache[cacheKey] : null;
        if (frame && !frame.complete) {
            // left recursion detected
            let i = this.stack.length - 1;
            while(this.stack[i].ruleset != callee) {
                i--;
                assert(i > 0);
            }
            frame = Object.assign({}, frame);
            this.nextRule(frame);
        }

        if (!frame) {
            frame = <ParseFrame>{};
            frame.matched = false;
            frame.complete = false;
            frame.ruleset = callee.type == "ruleset" ? <RulesetNode>callee : null;
            frame.ruleIndex = 0;
            frame.selector = callee.type == "ruleset" ? (<RulesetNode>callee).rules[0] : <SelectorNode>callee;
            frame.patternIndex = 0;
            frame.tokenIndex = 0;
            frame.pos = pos;
            frame.tokenPos = pos;
            frame.consumed = 0;
            frame.callee = null;
            frame.wantOutput = caller && (caller.selector.type == "capture" || caller.wantOutput);
            frame.output = null;
            frame.captures = null;
            frame.cacheKey = cacheKey;
            if (callee.type == "ruleset") {
                this.cache[frame.cacheKey] = frame;
            }    
        }
        if (caller) caller.callee = frame;
        this.stack.push(frame);
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

    /*
    enter(node:ParseNode) : ParseFrame {
        let current = this.top();
        let pos = current ? current.pos + current.consumed : 0;
        let leftOffset = current ? current.leftOffset : 0;
        let items;

        // even though caching may be disabled, we still need to retrieve
        // from the cache because rulesets and left recursion still use
        // the cache (if only momentarily)
        let cachedFrame = this.parseCache.retrieve(pos, node, leftOffset);
        if (cachedFrame) {
            if (!cachedFrame.complete) {
            } else {
                // a repeating token frame will place itself in the cache multiple times,
                // but its pos will reflect its first entry in the cache. So, we may
                // want to update the frame pos and consumed here.
                cachedFrame.consumed -= pos - cachedFrame.pos;
                assert(cachedFrame.consumed >= 0);
                cachedFrame.pos = pos;
                this.stack.push(cachedFrame);
                return cachedFrame;
            }
        } else {
            let wantOutput = current && current.wantOutput;
            if (current && current.node.type == "capture") {
                wantOutput = true;
            } else if (current && current.node.type == "rule") {
                wantOutput = false;
            }
            let newFrame:ParseFrame = <ParseFrame>{};
            newFrame.matched = false;
            newFrame.complete = cachedFrame === false;
            newFrame.node = node;
            newFrame.items = items;
            newFrame.tokenIndex = 0;
            newFrame.index = 0;
            newFrame.pos = pos;
            newFrame.consumed = 0;
            newFrame.wantOutput = wantOutput;
            newFrame.cached = false;
            newFrame.leftOffset = leftOffset;
            newFrame.captures = null;
            newFrame.output = null;
            newFrame.callee = null;
            this.stack.push(newFrame);
            this.parseCache.store(newFrame);
            return newFrame;
        }
    }
*/

    top() : ParseFrame|null { 
        return this.stack[this.stack.length-1] 
    }
}

export function parserError(code:ErrorCode) {
    let msg = errorMessages[code];
    let e = new Error(`Internal parser error ${code}: ${msg}`);
    e["code"] = code;
    debugger;
    throw e;
}

export function assert(condition:boolean) {
    if (!condition) {
        debugger;
        parserError(ErrorCode.AssertionFailure);
    }
}

export function parsingError(code:ErrorCode, buf:ParseBuffer, pos:number, expected:string[]) {
    expected = expected.map((i) => i.replace(/\n/g, '\\n'));
    let list = [].join.call(expected, '\n\t');
    let reason = expected.length == 1 ? `expected: ${list}` : `expected one of the following: \n\t${list}`;        

    let info = buf.findLineAndChar(pos);
    let backrefs = [null, info.line, info.char, reason, info.lineText, info.pointerText];
    let msg = errorMessages[code].replace(/\$([0-9])/g, (match, index) => String(backrefs[index]));
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
