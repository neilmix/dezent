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


import { 
    Grammar, createUncompiledDezentGrammar, RulesetNode, ReturnNode,
    SelectorNode, RuleRefNode, MatcherNode, CaptureNode, RuleNode, PatternNode, TokenNode
} from "./Grammar";

import { ParseBuffer, ParseBufferExhaustedError } from "./ParseBuffer";
import { GrammarCompiler, grammarError } from "./GrammarCompiler";
import { Output, Callbacks, ValueBuilder } from "./Output";

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
    FunctionNotFound          = 1009,
    CallbackError             = 1010,
    InvalidObjectTuple        = 1011,
    InvalidAccessRoot         = 1012,
    InvalidAccessIndex        = 1013,
    InvalidAccessProperty     = 1014,
    UnknownPragma             = 1015,

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
    InputFreed                = 2012,
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
}

/*
 * ---- Notes on left recursion ----
 * Left recursion is a real mind-bender. Here's an overview of how it
 * works in this implementation.
 * 1) The recursing ruleset executes its base frame and is cached.
 * 2) When the ruleset is called again, left recursion is detected by virtue of the 
 *    fact that the given ruleset is already active in the cache at the same location.
 * 3) Rather than executing a new default-initialized frame (which would lead to an
 *    infinite loop), the base ruleset frame is duplicated and advanced to the rule 
 *    immediately following the currently executing rule. This allows execution to 
 *    proceed and find a match (any match) for the ruleset in question (or fail).
 * 4) The base ruleset frame is market as leftRecursing, for later reference.
 * 5) When the stack descends back to the base ruleset frame, the fact that it is
 *    leftRecursing is detected, leading to special frame handling.
 * 6) The returning callee frame is set aside for the moment (leftReturn) and the 
 *    base frame executes from the same position again.
 * 7) Execution proceeds until the ruleset is called again in recursion.
 * 8) This time, the base frame is retrieved from the cache and detected as leftRecursing, 
 *    leading to duplication of the base frame (without advancement) and placement 
 *    on the stack, followed by placement of the base frame's previously stored leftReturn
 *    onto the stack. This allows execution to resume with the previous recursion's 
 *    output as this recursions return value, thereby resulting in an increased 
 *    consumption of input. In this way, output consumption grows with each recursion.
 * 9) Returning to the base frame, once recursion fails to match or consume more input,
 *    the frame is complete and its execution terminated. This is counter-intuitive,
 *    because remaining rules will be skipped and unexecuted on the base frame, but
 *    that is OK because the rules were executed during the iterative recursion process.
 *    (The largest valid consumption of input that satisfies the ruleset is the return
 *    value for the ruleset.)
 */ 

export type ParseContext = {

}

export type ParseFrame = {
    complete: boolean,
    matched: boolean,
    ruleset: RulesetNode | null,
    selector: SelectorNode,
    ruleIndex: number,
    patternIndex: number,
    pattern: PatternNode,
    tokenIndex: number,
    token: TokenNode,
    pos: number,
    tokenPos: number,
    consumed: number,
    callee: ParseFrame | null,
    wantOutput: boolean,
    output?: Output,
    captures?: Output[],
    leftRecursing: boolean, // see note above
    leftReturn: ParseFrame, // see note above
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
    dumpDebug?: boolean,
    minBufferSizeInMB?: number,
    callbacks?: Callbacks,
}

export function parseGrammar(text:string, options:ParserOptions) : Grammar {
    let buf = new ParseBuffer(text);
    let parser = new Parser(findDezentGrammar(), buf, options);
    try {
        let grammar = parser.parse();
        GrammarCompiler.compileGrammar(grammar, text, options.callbacks);
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
    buffer : ParseBuffer;
    rulesets: {[key:string]:RulesetNode};
    valueBuilder : ValueBuilder;
    options : ParserOptions;
    omitFails : number = 0;
    debugLog : any[][] = [];
    error : Error;
    errorPos : number = 0;
    failedPatterns : string[] = [];
    frameStack : ParseFrame[] = [];

    constructor(grammar:Grammar, buffer:ParseBuffer, options:ParserOptions) {
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
        this.valueBuilder = new ValueBuilder(grammar, this.options.callbacks);
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
                            return BufferEmpty;
                        } else {
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
                if ((<MatcherNode>descriptor).match) {
                    try {
                        [matched, consumed] = (<MatcherNode>descriptor).match(this.buffer, consumedPos);
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
                    continue CURRENT;
                } else {
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
                    } else {
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
                    && consumedPos - current.tokenPos == 0
                ) {
                    // our token failed, therefore the pattern fails
                    if (consumedPos >= this.errorPos && !this.omitFails && (<MatcherNode>descriptor).pattern) {
                        if (consumedPos > this.errorPos) {
                            this.failedPatterns.length = 0;
                            this.errorPos = consumedPos;
                        }
                        let pattern = (<MatcherNode>descriptor).pattern;
                        if (current.token.not) pattern = 'not: ' + pattern;
                        this.failedPatterns.push(pattern);
                    }
                    current.consumed = 0;
                    if (++current.patternIndex >= current.selector.patterns.length) {
                        // no matching pattern - go to next rule if applicable, or fail if not
                        if (current.ruleset) {
                            this.nextRule(current);
                        } else {
                            current.complete = true;
                        }
                    } else {
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
                    } else if (callee && callee.captures) {
                        // captures need to descend the stack
                        if (current.captures) {
                            current.captures = current.captures.concat(callee.captures);
                        } else {
                            current.captures = callee.captures;
                        }
                    }
                } else if (descriptor.type == "capture" && !current.token.required && !current.token.repeat) {
                    // a failed non-required non-repeating capture should yield null
                    let output = {
                        captureIndex: (<CaptureNode>descriptor).index,
                        position: consumedPos,
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
            } while (matched && current.token.repeat && consumed > 0); // make sure we consumed to avoid infinite loops

            if (++current.tokenIndex < current.pattern.tokens.length) {
                current.token = current.pattern.tokens[current.tokenIndex];
                current.tokenPos = current.pos + current.consumed;
            } else {
                // we got through all tokens successfully - pass!
                current.matched = true;
                current.complete = true;

                if (current.ruleset) {
                    if ((<RuleNode>current.selector).hasBackref0) {
                        // create a capture for $0 backref
                        if (!current.captures) current.captures = [];
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

    nextRule(frame:ParseFrame) {
        frame.ruleIndex++;
        frame.selector = frame.ruleset.rules[frame.ruleIndex];
        frame.callee = null;
        if (!frame.selector) {
            frame.complete = true;
        } else {
            frame.patternIndex = 0;
            frame.pattern = frame.selector.patterns[0];
            frame.tokenIndex = 0;
            frame.token = frame.pattern.tokens[0];
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

    callFrame(current:ParseFrame, callee:SelectorNode|RulesetNode) {
        let pos = current ? current.pos + current.consumed : 0;

        let recursed;
        if (current && callee.type == "ruleset") {
            for (let i = this.frameStack.length - 1; i >= 0; i--) {
                let check = this.frameStack[i];
                if (check.pos != current.pos) {
                    break;
                }
                if (check.ruleset && check.ruleset.name == (<RulesetNode>callee).name) {
                    recursed = check;
                    break;
                }
            }
        }
        let frame:ParseFrame;
        let secondFrame:ParseFrame;
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
            } else {
                // this is the first recursion iteration - get ourselves ready
                // to work through multiple recursion iterations by marking our
                // base frame as left recursing and advancing our new frame to
                // avoid infinite loop.
                this.nextRule(frame);
                recursed.leftRecursing = true;
                current.callee = frame;
                this.frameStack.push(frame);
            }
        } else if (!frame) {
            let selector = callee.type == "ruleset" ? (<RulesetNode>callee).rules[0] : <SelectorNode>callee;
            let pattern = selector.patterns[0];
            frame = {
                matched: false,
                complete: false,
                ruleset: callee.type == "ruleset" ? <RulesetNode>callee : null,
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
            if (current) current.callee = frame;
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
