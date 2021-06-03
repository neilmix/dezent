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
    ParseNode, RuleNode, PatternNode, TokenNode, MatcherNode
} from "./Grammar";

import { ParseBuffer, ParseBufferExhaustedError } from "./ParseBuffer";
import { ParseCache, ParseCacheScope } from "./ParseCache";
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
    match: boolean,
    node: ParseNode,
    items: RuleNode[] | PatternNode[] | TokenNode[],
    paths: number,
    index: number,
    pos: number,
    consumed: number,
    wantOutput: boolean,
    cached: boolean,
    leftOffset: number,
    leftContinuation?: ParseFrame[],
    captures?: Output[],
    output?: Output,
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
    enableCache?: boolean,
}

export function parseGrammar(text:string, options?:ParserOptions) : Grammar {
    let buf = new ParseBuffer(text);
    try {
        let grammar = new Parser(findDezentGrammar(), buf, null, options).parse();
        GrammarCompiler.compileGrammar(grammar, text);
        return grammar;
    } catch(e) {
        if (e["code"] == ErrorCode.TextParsingError) {
            parsingError(ErrorCode.GrammarParsingError, buf, e["pos"], e["expected"]);
        } else {
            throw e;
        }
    }
}

export var lastParser:Parser = null; // for testing purposes

export class Parser {
    root : ReturnNode;
    stack : ParseFrame[] = [];
    buffer : ParseBuffer;
    rulesets: {[key:string]:RulesetNode};
    parseCache : ParseCache;
    valueBuilder : ValueBuilder;
    options : ParserOptions;
    omitFails : number = 0;
    debugLog : any[][] = [];
    run : Function;
    error : Error;

    constructor(grammar:Grammar, buffer:ParseBuffer, functions:Functions, options:ParserOptions) {
        lastParser = this;
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
            if (pragma != 'enableCache') {
                grammarError(ErrorCode.UnknownPragma, pragma);
            }
            this.options[pragma] = grammar.pragmas[pragma];
        }
        for (let option in options) {
            this.options[option] = options[option];
        }
        this.parseCache = new ParseCache(this.options.enableCache ? ParseCacheScope.All : ParseCacheScope.Rulesets, grammar.maxid);
        this.valueBuilder = new ValueBuilder(grammar, functions);
        this.enter(root);

        let maxPos = 0;
        let failedPatterns = {};
        let exited:ParseFrame;
        this.run = () => {    
            while (this.stack.length) {
                let current = this.top();
    
                if (current.paths == 1) {
                    this.parseCache.discardPos(current.pos);
                }
                
                if (current.index > current.items.length) {
                    parserError(ErrorCode.ArrayOverrun);
                }
    
                if (!current.complete) {
                    switch (current.node.type) {
                        case "token":
                            let desc = <MatcherNode>current.node.descriptor;
                            if (["string","class","any"].includes(desc.type)) {
                                let matched, consumed;
                                do {
                                    try {
                                        [matched, consumed] = desc.match(this.buffer, current.pos + current.consumed);
                                    } catch(e) {
                                        if (this.buffer.closed && e == ParseBufferExhaustedError) {
                                            [matched, consumed] = [false, 0];
                                        } else if (e == ParseBufferExhaustedError) {
                                            return BufferEmpty;
                                        } else {
                                            throw e;
                                        }
                                    }
                                    if (current.node.and || current.node.not) {
                                        current.match = (current.node.and && matched) || (current.node.not && !matched);
                                    } else if (matched) {
                                        current.match = true;
                                        this.parseCache.store(current, current.pos + current.consumed);
                                        current.consumed += consumed;
                                    } else {
                                        if (current.consumed > 0 || !current.node.required) {
                                            current.match = true;
                                        } else {
                                            current.match = false;
                                            if (current.pos + current.consumed == maxPos && !this.omitFails && desc.pattern != '') {
                                                failedPatterns[desc.pattern] = true;
                                            }
                                        }
                                    }        
                                } while (matched && current.node.repeat);
                                current.complete = true;
                                break; // break switch(current.node.type)
                            }
                            // FALL THROUGH
                        default:
                            this.enter(current.items[current.index]);
                            break;
                        case "ruleref":
                            this.enter(this.rulesets[current.node.name]);
                            break;
                    }
                } else {
                    exited = this.stack.pop();
                    this.parseCache.store(exited);
                    let next = this.top();
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
                                exited.match ? 'PASS' : 'FAIL', 
                                this.buffer.substr(exited.pos, 20), 
                                exited.node["pattern"] || exited.node["name"]
                            ]);
                        }
                    }
                    // special handling is required for left recursion
                    if (next.leftContinuation) {
                        if (exited.match && exited.consumed > next.consumed) {
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
                            next.match = true;
                            next.complete = true;
                            continue;
                        } else if (next.match) {
                            // we previously successfully recursed, we're passing!
                            // don't fall through or we'll get marked as a fail.
                            continue;
                        }
                        // FALL THROUGH
                    }
                    if ((next.node.type == "token" && next.node.not && !exited.match) || 
                        ((next.node.type != "token" || !next.node.not) && exited.match)) 
                    {
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
                                next.match = true;
                                next.complete = true;
                            } // otherwise stay at incomplete
                        } else {
                            next.match = true;
                            next.complete = true;
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
                            } else {
                                // create a capture text segment
                                next.captures = [{
                                    captureIndex: next.node.index,
                                    position: exited.pos,
                                    length: exited.consumed,
                                    value: this.buffer.substr(exited.pos, exited.consumed),
                                }];
                            }
                        } else if (exited.output) {
                                // make the output descend the stack
                                next.output = exited.output;
                        } else if (next.node.type != "ruleset" && exited.captures) {
                            // captures descend the stack until we reach a ruleset, at which point they
                            // get bundled into an output if within a capture (see below), otherwise discarded
                            if (next.captures) {
                                next.captures = next.captures.concat(exited.captures);
                            } else {
                                next.captures = exited.captures;
                            }
                        } else if (next.node.type == "ruleset") {
                            this.yieldOutput(exited, next, next);
                        }
                    } else { // exited.match == false
                        if (["ruleset", "rule", "capture", "group"].includes(next.node.type)) {
                            if (++next.index >= next.items.length) {
                                next.match = false;
                                next.complete = true;
                            } else if (next.paths > 0) {
                                next.paths--;
                                assert(next.paths >= 1);
                            }
                        } else if (next.node.type == "token") {
                            if (!next.node.required) {
                                // nodes that are not required always pass
                                next.match = true;
                                next.complete = true;
                                if (exited.node.type == "capture" && !next.node.repeat) {
                                    // a failed non-required non-repeating capture should yield null
                                    next.captures = [{
                                        captureIndex: exited.node.index,
                                        position: exited.pos,
                                        length: 0,
                                        value: null
                                    }];
                                }
                            } else if (!next.complete) {
                                // this node's descriptor never passed - it failed
                                next.match = false; // could be true if .not == true
                                next.complete = true;
                            } // it is already marked as match == false
                        } else {
                            next.match = false;
                            next.complete = true;
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
            if (exited.output.length < this.buffer.length) {
                parsingError(ErrorCode.TextParsingError, this.buffer, maxPos, expectedTerminals());
            }
    
            if (!this.buffer.closed) {
                return BufferEmpty;
            }

            if (exited.output.length > this.buffer.length) {
                parsingError(ErrorCode.TextParsingError, this.buffer, maxPos, ["<EOF>"]);
            }
    
            return exited.output.value;
    
            function expectedTerminals() {
                return Object.keys(failedPatterns);
            }
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
            if (this.options.debugErrors) {
                let lines = [];
                for (let msg of this.debugLog) {
                    lines.push(msg.join('\t').replace(/\n/g, '\\n'));
                }
                console.error("Debug log:\n", lines.join("\n"));
                console.error("Parser stack:\n", this.stack);
            }
            this.error = e;
            throw e;
        }    
    }

    yieldOutput(exited:ParseFrame, target:ParseFrame, base:ParseFrame) {
        assert(exited.node.type == "rule");
        // create a capture for $0 backref
        if (!exited.captures) exited.captures = [];
        exited.captures.push({
            captureIndex: 0,
            position: base.pos,
            length: base.consumed,
            value: this.buffer.substr(base.pos, base.consumed),
        });

        // always build the value so that output callbacks can be called
        // even if the grammar returns null
        let value = this.valueBuilder.buildValue(exited);

        if (base.wantOutput || (<RulesetNode>base.node).name == "return") {
            // our ruleset emerged from a capture - create an output (which will descend the stack)
            target.output = {
                position: base.pos,
                length: base.consumed,
                value: value
            }
        }
    }

    enter(node:ParseNode) {
        let current = this.top();
        let pos = current ? current.pos + current.consumed : 0;
        let leftOffset = current ? current.leftOffset : 0;
        let items;
        let paths;

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
        let cachedFrame = this.parseCache.retrieve(pos, node, leftOffset);
        if (cachedFrame) {
            if (!cachedFrame.complete) {
                assert(cachedFrame.node.type == "ruleset");
                // left recursion detected
                // build a continuation and set leftOffsets
                let i = this.stack.length - 1;
                while(this.stack[i].node.id != node.id) {
                    this.stack[i].leftOffset = leftOffset;
                    i--;
                    assert(i > 0);
                }
                this.stack[i].leftContinuation = this.stack.slice(i + 1).map((f) => Object.assign({}, f));
                // there may be intermediate rulesets in the continuation. Remember, rulesets are cached
                // immediately upon creation (see below). So, we need to update the cached member
                // of all our continuation frames just in case.
                this.stack[i].leftContinuation.forEach((f) => { f.cached = false, f.paths = -1 });

                let failFrame = <ParseFrame> {};
                failFrame.complete = true;
                failFrame.match = false;
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

                let contFrame = <ParseFrame> {};
                // subsequent continuation executions need to pass at the top to kick off
                // downward descent through the stack
                contFrame.complete = true;
                contFrame.match = true;
                contFrame.node = node;
                contFrame.items = items;
                contFrame.paths = -1;
                contFrame.index = 0;      // this will get updated at execution
                contFrame.pos = pos;
                contFrame.consumed = 0;   // this will get updated at execution
                contFrame.wantOutput = current.wantOutput;
                contFrame.cached = false;
                contFrame.leftOffset = leftOffset; // this will get updated at execution
                contFrame.captures = null;
                contFrame.output = null;
                this.stack[i].leftContinuation.push(contFrame);
            } else {
                // a repeating token frame will place itself in the cache multiple times,
                // but its pos will reflect its first entry in the cache. So, we may
                // want to update the frame pos and consumed here.
                cachedFrame.consumed -= pos - cachedFrame.pos;
                assert(cachedFrame.consumed >= 0);
                cachedFrame.pos = pos;
                this.stack.push(cachedFrame);
            }
        } else {
            let wantOutput = current && current.wantOutput;
            if (current && current.node.type == "capture") {
                wantOutput = true;
            } else if (current && current.node.type == "rule") {
                wantOutput = false;
            }
            let newFrame:ParseFrame = <ParseFrame>{};
            newFrame.match = false;
            newFrame.complete = cachedFrame === false;
            newFrame.node = node;
            newFrame.items = items;
            newFrame.paths = current ? current.paths + paths-1 : paths;
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
    }

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
