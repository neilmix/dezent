export type Grammar = (DefineNode|ReturnNode)[];

export interface Node { type: string }
export interface SelectorNode extends Node { options: OptionNode[] }
export interface RepeaterNode extends SelectorNode { repeat: RepeatString }
export interface MatcherNode extends Node { match?(s : string) : number; }
export type RepeatString = "*" | "+" | "?" | null;

export type PartNode = CaptureNode | GroupNode | StringNode | RegexNode | RuleRefNode;
export type ValueNode = BackRefNode | SplatNode | ObjectNode | ArrayNode | StringNode | NumberNode | BooleanNode | NullNode;

export type ContextNode = ReturnNode | DefineNode | RuleNode | CaptureNode | GroupNode | OptionNode;

export interface ReturnNode       extends Node         { type: "return",    rule: RuleNode }
export interface DefineNode       extends Node         { type: "define",    name: string, rules: RuleNode[] }
export interface RuleNode         extends SelectorNode { type: "rule",      output: ValueNode }
export interface CaptureNode      extends RepeaterNode { type: "capture",   id?: number }
export interface GroupNode        extends RepeaterNode { type: "group" }
export interface OptionNode       extends Node         { type: "option",    tokens: PartNode[] }
export interface RuleRefNode      extends Node         { type: "ruleref",   name: string }
export interface RegexNode        extends MatcherNode  { type: "regex",     pattern: string }

export interface StringNode       extends MatcherNode  { type: "string",    tokens: (StringEscapeNode|StringTextNode)[] }
export interface StringTextNode   extends Node         { type: "text",      value: string }
export interface StringEscapeNode extends Node         { type: "escape",    value: string }
                                          
export interface BackRefNode      extends Node { type: "backref",   index: string }
export interface SplatNode        extends Node { type: "splat",     backrefs: BackRefNode[] }
export interface ObjectNode       extends Node { type: "object",    members: Member[] }
export interface ArrayNode        extends Node { type: "array",     elements: ValueNode[] }
export interface NumberNode       extends Node { type: "number",    value: string }
export interface BooleanNode      extends Node { type: "boolean",   value: boolean }
export interface NullNode         extends Node { type: "null" }

export interface Member { name: BackRefNode|StringNode, value: ValueNode }

let kNull:NullNode = { type: "null" }

//let _ = $("_");

export var dezentGrammar : Grammar = [
    ret([], "4")
];

/*
let grammar : (defineStT|returnStT)[] = [
    ret([_, $_("any", $$(null, "defineSt","returnSt"), _)], 
        "$1"),

    def("_", ["/s*\\/"], kNull,
        ["/\\/\\/[^\\n]*\\n/"], kNull,
        "/\\/\\*(.|\\n)*\\*\\//", kNull),

    def("returnSt", ["return", _, $("parse"), _, ";"],
        { type: "return", parse: "$1" }),
    
    def("defineSt", [$("identifier"), _, "=", _, $("parse"), $_("any", _, ",", _, $("parse")), _, ";"],
        { type: "define", name: "$1", parses: ["$2", splat("$3")]}),
    
    def("parse", [$("template"), _, "->", _, $("value")],
        { template: "$1", value: "$2" }),

    def("template", [$("templateOption"), $_("any", _, "|", _, $("templateOption"))],
        { type: "template", options: ["$1", splat("$2")]}),
    
    def("templateOption", [$$("some", "templateCapture", "templateGroup", "string", "regex", "ruleref")],
        { type: "option", parse: [splat("$1"), splat("$2, $3")]}),
    
    
];*/

// returnSt
function ret(matcher: any, output: any) : ReturnNode {
    return {
        type: "return",
        rule: {
            type: "rule",
            options: [{type: "option", tokens: matcher}],
            output: { type: "boolean", value: true }
        }
    }
}

/*
// templateGroup
function $_(repeat:string, ...options) {
}

// templateCapture
function $$(repeat:string, ...options) {
}

// shortcut templateCapture of one reference
function $(id:string) {
    return $$(null, id);
}

// defineSt
function def(name:string, tpl1:any, val1:any, tpl2?:any, val2?:any, tpl3?:any, val3?:any) : defineStT {
}

function splat(...arg) : splatT {

}
*/