"use strict";
exports.__esModule = true;
exports.dezentGrammar = void 0;
var kNull = { type: "null" };
//let _ = $("_");
exports.dezentGrammar = [
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
function ret(matcher, output) {
    return {
        type: "return",
        rule: {
            type: "rule",
            options: [{ type: "option", tokens: matcher }],
            output: { type: "boolean", value: true }
        }
    };
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
