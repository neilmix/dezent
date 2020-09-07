// todo:
// - handle number vs string backrefs in output gracefully
// - documentation
// - command line script w/tests
// - package license
// - release?
// - string interpolation
// - streaming support
//   - chunked parsing
//   - sax-like output callbacks
//   - cache eviction / progressive tabling / dynamic analysis
// - memory optimization:
//   - don't create frames for terminals
//   - don't cache failed frames, cache boolean instead
//   - recycle frames and arrays
// - compiled grammar versioning
// - refactor: OutputBuilder, GrammarCompiler
// - @id
// - backref within pattern
// - regex-like search-and-find
// - refactor omitFails to be on the frame?
// - optional trailing semicolon?
// - remove/disable property accesses?

// speculative/research todo:
// - compile-time data-type checking
// - error messaging
// - error recovery
// - macros/functions, e.g. definition(pattern1, pattern2)

import { 
    Grammar, createUncompiledDezentGrammar, RulesetNode, ReturnNode,
    ParseNode, RuleNode, PatternNode, TokenNode
} from "./Grammar";

import { ParseCache } from "./ParseCache";
import { ParseManager } from "./ParseManager";
import { OutputContext, OutputToken } from "./OutputContext";

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

export type ParseContextFrame = {
    status: MatchStatus,
    node: ParseNode,
    items: RuleNode[] | PatternNode[] | TokenNode[],
    index: number,
    pos: number,
    consumed: number,
    cached: boolean,
    leftOffset: number,
    leftContinuation?: ParseContextFrame[],
    nextFrame?: ParseContextFrame,
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
    stack : ParseContextFrame[] = [];
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

    parse() : OutputContext {
        let maxPos = 0;
        let failedPatterns = {};

        while (this.stack.length) {
            let current = this.top();

            if (current.index > current.items.length) {
                parserError(ErrorCode.ArrayOverrun);
            }

            if (current.status == MatchStatus.Continue) {
                switch (current.node.type) {
                    default:
                        this.enter(current.items[current.index]);
                        break;
                    case "ruleref":
                        this.enter(this.rulesets[current.node.name]);
                        break;
                    case "string":
                    case "class":
                    case "any":
                        let text = this.text.substr(this.top().pos);
                        let [matched, consumed] = current.node.match(text);
                        if (matched) {
                            current.consumed = consumed;
                            current.status = MatchStatus.Pass;
                        } else {
                            current.status = MatchStatus.Fail;
                        }
                        break;
                }
            } else {
                let exited = this.stack.pop();
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
                        top.nextFrame = exited;
                        // we got at least one successful continuation - mark our base ruleset as a success
                        next.status = MatchStatus.Pass;
                        next.nextFrame = exited;
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
                } else { // exited.matchStatus == MatchStatus.FAIL
                    if (exited.pos == maxPos && exited.node["pattern"]) {
                        if (!this.omitFails && exited.node["pattern"]) {
                            failedPatterns[exited.node["pattern"]] = true;
                        }
                    }
                    if (["ruleset", "rule", "capture", "group"].includes(next.node.type)) {
                        if (++next.index >= next.items.length) {
                            next.status = MatchStatus.Fail;
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

        let output = new OutputContext();
        this.parseCache.visitPassFrames(
            this.root, 
            this.rulesets, 
            (frame:ParseContextFrame) => {
                if (["group","capture"].includes(frame.node.type)) {
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
            }, 
            (frame:ParseContextFrame) => {
                if (["group","capture"].includes(frame.node.type)) {
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
            }
        );
        
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
    }

    enter(node:ParseNode) {
        let current = this.top();
        let pos = current ? current.pos + current.consumed : 0;
        let leftOffset = current ? current.leftOffset : 0;
        let items;

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
                this.stack[i].leftContinuation.forEach((f) => f.cached = false);
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
                    leftOffset: leftOffset,        
                });
                this.stack[i].leftContinuation.push({
                    // subsequent continuation executions need to pass at the top to kick off
                    // downward descent through the stack
                    status: MatchStatus.Pass,
                    node: node,
                    items: items,
                    index: 0,      // this will get updated at execution
                    pos: pos,
                    consumed: 0,   // this will get updated at execution
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
            let newFrame = {
                status: MatchStatus.Continue,
                node: node,
                items: items,
                index: 0,
                pos: pos,
                consumed: 0,
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

    top() : ParseContextFrame|null { 
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