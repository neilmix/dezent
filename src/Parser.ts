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

import { ParseCache } from "./ParseCache";
import { ParseManager } from "./ParseManager";
import { Output } from "./Output";

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
    status: MatchStatus,
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

let dezentGrammar:Grammar;

export function findDezentGrammar(options?:ParserOptions) : Grammar{
    if (!dezentGrammar) {
        dezentGrammar = createUncompiledDezentGrammar();
        new ParseManager(options).compileGrammar(dezentGrammar);
    }
    return dezentGrammar;
}

export interface ParserOptions {
    debugErrors?: boolean,
    disableCacheLookup?: boolean,
}

export function parseText(grammar:string|Grammar, text:string, options?:ParserOptions) : any {
    let mgr = new ParseManager(options);
    try {
        return mgr.parseText(grammar, text);
    } catch(e) {
        if (options && options.debugErrors) mgr.dumpDebug();
        throw e;
    }
}

export function parseGrammar(grammar:string, options?:ParserOptions) : Grammar {
    let mgr = new ParseManager(options);
    try {
        return mgr.parseAndCompileGrammar(grammar);
    } catch(e) {
        if (options && options.debugErrors) mgr.dumpDebug();
        throw e;
    }    
}

export enum MatchStatus {
    Continue,
    Pass,
    Fail
}

export class Parser {
    root : ReturnNode;
    stack : ParseFrame[] = [];
    text : string;
    rulesets: {[key:string]:RulesetNode};
    parseCache : ParseCache 
    options : ParserOptions;
    omitFails : number = 0;
    debugLog : any[][];
    
    constructor(root:ReturnNode, text:string, rulesets:{[key:string]:RulesetNode}, maxid: number, options:ParserOptions, debugLog:string[][]) {
        this.root = root;
        this.text = text;
        this.rulesets = rulesets;
        this.options = options || {};
        this.debugLog = debugLog;
        this.parseCache = new ParseCache(maxid, !options.disableCacheLookup);
        this.enter(root);
    }

    parse() : Output {
        let maxPos = 0;
        let failedPatterns = {};
        let exited:ParseFrame;

        while (this.stack.length) {
            let current = this.top();

            if (current.index > current.items.length) {
                parserError(ErrorCode.ArrayOverrun);
            }

            if (current.status == MatchStatus.Continue) {
                switch (current.node.type) {
                    case "token":
                        let desc = <MatcherNode>current.node.descriptor;
                        if (["string","class","any"].includes(desc.type)) {
                            let pos = current.pos;
                            let matched, consumed;
                            do {
                                let text = this.text.substr(pos);
                                [matched, consumed] = desc.match(text);
                                if (current.node.and || current.node.not) {
                                    if ((current.node.and && matched) || (current.node.not && !matched)) {
                                        current.status = MatchStatus.Pass
                                    } else {
                                        current.status = MatchStatus.Fail;
                                    }
                                } else if (matched) {
                                    current.consumed += consumed;
                                    current.status = MatchStatus.Pass;
                                    // cache intermediate positions of tokens to avoid pathological
                                    // bad grammar performance.
                                    this.parseCache.store(current, pos);
                                    pos += consumed;
                                } else {
                                    if (current.consumed > 0 || !current.node.required) {
                                        current.status = MatchStatus.Pass;
                                    } else {
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
            } else {
                exited = this.stack.pop();
                if (!exited.cached) {
                    this.parseCache.store(exited);
                }
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
                    this.debug(exited.status == MatchStatus.Pass ? 'PASS' : 'FAIL', this.text.substr(exited.pos, 20), exited.node["pattern"] || exited.node["name"]);
                }
                // special handling is required for left recursion
                if (next.leftContinuation) {
                    if (exited.status == MatchStatus.Pass && exited.consumed > next.consumed) {
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
                        next.status = MatchStatus.Pass;
                        continue;
                    } else if (next.status == MatchStatus.Pass) {
                        // we previously successfully recursed, we're passing!
                        // don't fall through or we'll get marked as a fail.
                        continue;
                    }
                    // FALL THROUGH
                }
                if ((next.node.type == "token" && next.node.not && exited.status == MatchStatus.Fail) || 
                    ((next.node.type != "token" || !next.node.not) && exited.status == MatchStatus.Pass)) 
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
                            next.status = MatchStatus.Pass;
                        } // otherwise stay at Continue
                    } else {
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
                        } else {
                            // create a capture text segment
                            next.captures = [{
                                captureIndex: next.node.index,
                                position: exited.pos,
                                length: exited.consumed,
                                segment: this.text.substr(exited.pos, exited.consumed),
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
                    } else if (next.node.type == "ruleset" && (next.wantOutput || next.node.name == "return")) {
                        this.yieldOutput(exited, next, next);
                    }
                } else { // exited.matchStatus == MatchStatus.FAIL
                    if (["ruleset", "rule", "capture", "group"].includes(next.node.type)) {
                        if (++next.index >= next.items.length) {
                            next.status = MatchStatus.Fail;
                        } else if (next.paths > 0) {
                            next.paths--;
                            assert(next.paths >= 1);
                        }

                    } else if (next.node.type == "token") {
                        if (!next.node.required) {
                            // nodes that are not required always pass
                            next.status = MatchStatus.Pass;
                        } else if (next.status == MatchStatus.Continue) {
                            // this node's descriptor never passed - it failed
                            next.status = MatchStatus.Fail;
                        } // it is already marked as Pass
                    } else {
                        next.status = MatchStatus.Fail;
                    }
                    if (next.node.type == "ruleset" && next.node.name == 'return') {
                        parsingError(ErrorCode.TextParsingError, this.text, maxPos, expectedTerminals());
                    }
                }
            }
        } 
        
        if (!exited.output) {
            parserError(ErrorCode.EmptyOutput);
        }
        if (exited.pos != 0) {
            parserError(ErrorCode.InputConsumedBeforeResult);
        }
        if (exited.output.length != this.text.length) {
            parsingError(ErrorCode.TextParsingError, this.text, maxPos, expectedTerminals());
        }

        return exited.output;

        function expectedTerminals() {
            return Object.keys(failedPatterns);
        }
    }

    yieldOutput(exited:ParseFrame, target:ParseFrame, base:ParseFrame) {
        // our ruleset emerged from a capture - create an output (which will descend the stack)
        target.output = {
            position: base.pos,
            length: base.consumed,
            rule: <RuleNode>exited.node,
            captures: exited.captures
        }
        // create a capture for $0 backref
        if (!target.output.captures) target.output.captures = [];
        target.output.captures.push({
            captureIndex: 0,
            position: base.pos,
            length: base.consumed,
            segment: this.text.substr(base.pos, base.consumed),
        });
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

        let frame = this.parseCache.retrieve(pos, node, leftOffset);
        if (frame) {
            if (frame.status == MatchStatus.Continue) {
                assert(frame.node.type == "ruleset");
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
                this.stack.push({
                    // the first time through we fail so that parsing can attempt subsequent rules that may pass
                    status: MatchStatus.Fail,
                    node: node,
                    items: items,
                    paths: current.paths + paths,
                    index: 0,
                    pos: pos,
                    consumed: 0,
                    wantOutput: current.wantOutput,
                    // prevent this frame from attempting to store on top of our base frame
                    cached: true, 
                    leftOffset: leftOffset,        
                });
                this.stack[i].leftContinuation.push({
                    // subsequent continuation executions need to pass at the top to kick off
                    // downward descent through the stack
                    status: MatchStatus.Pass,
                    node: node,
                    items: items,
                    paths: -1,
                    index: 0,      // this will get updated at execution
                    pos: pos,
                    consumed: 0,   // this will get updated at execution
                    wantOutput: current.wantOutput,
                    cached: false, 
                    leftOffset: leftOffset, // this will get updated at execution
                })
            } else {
                // a repeating token frame will place itself in the cache multiple times,
                // but its pos will reflect its first entry in the cache. So, we may
                // want to update the frame pos and consumed here.
                frame.consumed -= pos - frame.pos;
                assert(frame.consumed >= 0);
                frame.pos = pos;
                this.stack.push(frame);
            }
        } else {
            let wantOutput = current && current.wantOutput;
            if (current && current.node.type == "capture") {
                wantOutput = true;
            } else if (current && current.node.type == "rule") {
                wantOutput = false;
            }
            let newFrame:ParseFrame = {
                status: MatchStatus.Continue,
                node: node,
                items: items,
                paths: current ? current.paths + paths-1 : paths,
                index: 0,
                pos: pos,
                consumed: 0,
                wantOutput: wantOutput,
                cached: false,
                leftOffset: leftOffset,
            }
            this.stack.push(newFrame);
            if (newFrame.node.type == "ruleset") {
                // store rulesets early so we can detect left recursion
                this.parseCache.store(newFrame);
            }
        }
    }

    top() : ParseFrame|null { 
        return this.stack[this.stack.length-1] 
    }

    debug(...args:any[]) {
        if (this.options.debugErrors) {
            this.debugLog.push(args);
        }
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

export function parsingError(code:ErrorCode, text:string, pos:number, expected:string[]) {
    expected = expected.map((i) => i.replace(/\n/g, '\\n'));
    let list = [].join.call(expected, '\n\t');
    let reason = expected.length == 1 ? `expected: ${list}` : `expected one of the following: \n\t${list}`;        

    let info = findLineAndChar(text, pos);
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

export function findLineAndChar(text:string, pos:number) : { line: number, char: number, lineText: string, pointerText: string } {
    let lines = text.split('\n');
    let consumed = 0, linenum = 0, charnum = 0, lineText = '';
    for (let line of lines) {
        linenum++;
        if (consumed + line.length >= pos) {
            lineText = line;
            charnum = pos - consumed + 1;
            break;
        }
        consumed += line.length + 1;
    }
    let detabbed = lineText.replace(/\t/g, '    ');
    let leading = charnum - 1 + (detabbed.length - lineText.length);
    return {
        line: linenum,
        char: charnum,
        lineText: lineText,
        pointerText: ' '.repeat(leading) + '^'
    }
}