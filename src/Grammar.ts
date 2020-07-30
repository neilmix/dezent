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

export var dezentGrammar : Grammar = [
    ret(`_ ( {returnSt|defineSt} _ )* `, "$1"),

    def("_", `_ = /\s*/`, null,
			 `/\/\/[^\n]*\n/`, null,
			 `/\/\*(.|\n)*\*\//`, null),

	def("returnSt", `"return" _ {parse} _ ";"`,
		{ type: "return", rule: "$1" }),

	def("defineSt", `{identifier} _ "=" _ {rule} ( _ "," _ {rule} )* _ ";"`,
		{ type: "define", name: "$1", rules: ["$2", "...$3"] }),
	
	def("rule", `{template} _ "->" _ {value}`,
		{ type: "rule", "...": "$1", value: "$2" }),
	
	def("template", `{templateOption} ( _ "|" _ {templateOption} )*`,
		{ options: ["$1", "...$2"] }),

	def("templateOption", `{capture|group|string|regex|ruleref}+`,
		{ type: "option", tokens: "$1" }),

	def("capture", `"{" _ {captureTemplate} _ "}" {repeat}?`,
		{ type: "capture", "...": "$1", repeat: "$2" }),


	def("group", `"(" _ {template} _ ")" {repeat}?`,
		{ type: "group", "...": "$1", repeat: "$2" }),

	def("captureTemplate", `{captureTemplateOption} ( _ "|" _ {captureTemplateOption} )*`,
		{ options: ["$1", "...$2"] }),

	def("captureTemplateOption", `{captureGroup|string|regex|ruleref}+`,
		{ type: "option", tokens: "$1" }),

	def("captureGroup", `"(" _ {captureTemplate} _ ")" {repeat}?`,
		{ type: "group", "...": "$1", repeat: "$2" }),

	def("regex",
		`"//"`, { type: "regex", pattern: "" },
		`"/" {/[^/]+([^/]|\\[^/])*/} "/"`, { type: "regex", pattern: "$1" }),

	def("ruleref", `{identifier}`,
		{ type: "ruleref", name: "$1" }),

	def("value", `{backref|object|array|string|number|boolean|null}`,
		"$1"),

	def("backref", `"$" {/\d+/}`,
		{ type: "backref", index: "$1" }),

	def("splat",
	`"..." {backref}`, { type: "splat", backrefs: ["$1"] },
	`"...(" _ {backref} ( _ "," _ {backref} )* _ ")"`, { type: "splat", backrefs: ["$1", "...$2"] }),

	def("object", `"{" ( _ {member} _ "," )* _ {member}? _ "}"`,
		{ type: "object", members: ["...$1", "$2"] }),

	def("member", `{backref|string} _ ":" _ {value}`,
		{ name: "$1", value: "$2" }),

	def("array", `"[" ( _ {value|splat} _ "," )* _ {value}? _ "]"`,
		{ type: "array", elements: ["...$1", "$2"] }),

	def("string", `/"/ {escape|stringText}* /"/`,
		{ type: "string", tokens: "$1" }),

	def("stringText", `{/[^"\\\n]+/}`,
		{ type: "text", value: "$1" }),

	def("number", `{"/-?\d+(\.\d+)?([eE][-+]\d+)?/}`,
		{ type: "number", value: "$1" }),

	def("boolean",
		`"true"`, { type: "boolean", value: true },
		`"false"`, { type: "boolean", value: false }),

	def("null", `"null"`,
		{ type: "null" }),

	def("escape", `/\\(u[A-Fa-f0-9][A-Fa-f0-9][A-Fa-f0-9][A-Fa-f0-9]|[^\n])/`,
		{ type: "escape", value: "$1" }),

	def("repeat", `{"*"|"+"|"?"}`, "$1"),

	def("identifier", `{/[_a-zA-Z][_a-zA-Z0-9]*/}`,
		"$1")

];

function ret(template:string, output:any) : ReturnNode {
    return {
        type: "return",
		rule: rule(template, output),
    }
}

function def(name:string, ...args:any) : DefineNode {
	let rules = [];
	for (let i = 0; i < args.length; i++) {
		rules.push(rule(args[i], args[i+1]));
	}
	return {
		type: "define",
		name: name,
		rules: rules
	}
}

function rule(template:string, output:any) : RuleNode {
	return {
		type: "rule",
		options: [ option(template.split(/\s+/)) ],
		output: output(output)
	}
}

function option(tokens:string[]) : OptionNode {
	let parts = [];

	for (let i = 0; i < tokens.length; i++) {
		let token = tokens[i];
		if (token[i] == '(') {
			let j = i;
			while (tokens[++j][0] != ')');
			parts.push(group(tokens.slice(i+1, j), tokens[j][1]));
			i = j;
		} else {
			parts.push(part(token));
		}
	}

	return {
		type: "option",
		tokens: parts
	};
}

function part(token:string) : PartNode {
	switch (token[0]) {
		case "{": return capture(token);
		case "/": return regex(token);
		case `"`: return string(token);
		default:
			return ruleref(token);
	}

}

function group(tokens:string[], repeat: string) : GroupNode {
	return {
		type: "group",
		options: [option(tokens)],
		repeat: <RepeatString>repeat || null
	}
}

function capture(token:string) : CaptureNode {
	let repeat = null;
	if (token[token.length - 1] != "}") {
		repeat = token[token.length - 1];
		token = token.substr(0, token.length - 1);
	}
	let options = token.substr(1, token.length - 2).split('|');
	return {
		type: "capture",
		options: options.map((t) => option([t])),
		repeat: repeat
	}
}

function regex(token:string) : RegexNode {
	return {
		type: "regex",
		pattern: token.substr(1, token.length - 2)
	}
}

function string(token:string) : StringNode {
	return {
		type: "string",
		tokens: [{
			type: "text",
			value: token.substr(1, token.length - 1)
		}]
	}
}

function ruleref(token:string) : RuleRefNode {
	if (!token.match(/^[a-zA-Z0-9_]+/)) {
		throw new Error(`invalid identifier: $token`);
	}
	return {
		type: "ruleref",
		name: token
	}
}

function output(value: any) : any {
	???
}
