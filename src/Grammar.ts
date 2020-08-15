export type Grammar = (DefineNode|ReturnNode)[];

export interface Node { type: string }
export interface SelectorNode extends Node { options: OptionNode[] }
export interface TokenNode extends Node { 
	type: 'token', 
	required: boolean, 
	repeat: boolean, 
	and: boolean,
	not: boolean,
	descriptor: DescriptorNode 
}
export interface MatcherNode extends Node { 
	pattern?: string; // for debug purposes
	match?(s : string) : [boolean, number]; 
}

export type DescriptorNode = CaptureNode | GroupNode | StringNode | RegexNode | ClassNode | RuleRefNode | AnyNode;
export type ParseNode = ReturnNode | DefineNode | RuleNode | OptionNode | TokenNode | DescriptorNode;
export type ValueNode = BackRefNode | SplatNode | ObjectNode | ArrayNode | StringNode | NumberNode | BooleanNode | NullNode;


export interface ReturnNode       extends Node         { type: 'return',    rule: RuleNode }
export interface DefineNode       extends Node         { type: 'define',    name: string, rules: RuleNode[] }
export interface RuleNode         extends SelectorNode { type: 'rule',      value: ValueNode, captures?: boolean[], defineName?: string }
export interface CaptureNode      extends SelectorNode { type: 'capture',   index?: number }
export interface GroupNode        extends SelectorNode { type: 'group' }
export interface OptionNode       extends Node         { type: 'option',    tokens: TokenNode[] }
export interface RuleRefNode      extends Node         { type: 'ruleref',   name: string }
export interface RegexNode        extends MatcherNode  { type: 'regex',     pattern: string }
export interface ClassNode        extends MatcherNode  { type: 'class',     ranges: [string, string][] }
export interface AnyNode          extends MatcherNode  { type: 'any' }
export interface StringNode       extends MatcherNode  { type: 'string',    tokens: (StringEscapeNode|StringTextNode)[] }
export interface StringTextNode   extends Node         { type: 'text',      value: string }
export interface StringEscapeNode extends Node         { type: 'escape',    value: string }
                                          
export interface BackRefNode      extends Node { type: 'backref',   index: string }
export interface SplatNode        extends Node { type: 'splat',     backrefs: BackRefNode[] }
export interface ObjectNode       extends Node { type: 'object',    members: (MemberNode|SplatNode)[] }
export interface ArrayNode        extends Node { type: 'array',     elements: ValueNode[] }
export interface NumberNode       extends Node { type: 'number',    value: string }
export interface BooleanNode      extends Node { type: 'boolean',   value: boolean }
export interface NullNode         extends Node { type: 'null' }

export interface MemberNode { type: 'member', name: BackRefNode|StringNode, value: ValueNode }

let kNull:NullNode = { type: 'null' }

// This is a mini DSL that allows us to build an AST
// that our parser uses to parse grammar files.
// This is the same grammar as in grammar.dezent,
// though there are some restrictions to keep the
// amount of parsing logic under control:
// - there can be no whitespace within a capture
// - object splat must be written as name/value pair, e.g. ...$1': ''
// - captures can't have multiple regex options
// - grouping parens (and predicate/modifier) must be surrounded by whitespace
// - character classes must always be specific as ranges, e.g. [x-x]

export var dezentGrammar : Grammar = [
    ret(`_ ( {returnSt|defineSt} _ )*`, '$1'),

	def('_', `( singleLineComment | multiLineComment | whitespace )*`, null),

	def('singleLineComment', `'//' /[^\\n]*\\n/`,  null),
	def('multiLineComment', `'/*' /(.|\\n)*/ '*/'`, null),
	def('whitespace',       `/\\s*/`,               null),

	def('returnSt', `'return' /\\s+/ {rule} _ ';'`,
		{ type: 'return', rule: '$1' }),

	def('defineSt', `{identifier} _ '=' _ {rule} ( _ ',' _ {rule} )* _ ';'`,
		{ type: 'define', name: '$1', rules: ['$2', '...$3'] }),
	
	def('rule', `{template} _ '->' _ {value}`,
		{ type: 'rule', '...$1': '', value: '$2' }),
	
	def('template', `{templateOption} _ ( '|' _ {templateOption} _ )*`,
		{ options: ['$1', '...$2'] }),

	def('templateOption', `( {capture|group|string|regex|class|ruleref|any} _ )+`,
		{ type: 'option', tokens: '$1' }),

	def('capture', `{predicate} '{' _ {captureTemplate} _ '}' {modifier}`,
		{ type: 'token', '...$3': '', '...$1': '', descriptor: { type: 'capture', '...$2': '' } }),

	def('group', `{predicate} '(' _ {template} _ ')' {modifier}`,
	{ type: 'token', '...$3': '', '...$1': '', descriptor: { type: 'group', '...$2': '' } }),

	def('captureTemplate', `{captureTemplateOption} _ ( '|' _ {captureTemplateOption} _ )*`,
		{ options: ['$1', '...$2'] }),

	def('captureTemplateOption', `( {captureGroup|stringToken|regex|class|ruleref|any} _ )+`,
		{ type: 'option', tokens: '$1' }),

	def('captureGroup', `{predicate} '(' _ {captureTemplate} _ ')' {modifier}?`,
		{ type: 'token', '...$3': '', '...$1': '', descriptor: { type: 'group', '...$2': '' } }),

	def('regex', `{predicate} '/' {/([^\\\\\\/]|\\\\.)*/} '/' {modifier}`, 
		{ type: 'token', '...$3': '', '...$1': '', descriptor: { type: 'regex', pattern: '$2' } }),

	def('class', `{predicate} '[' {classComponent}* ']' {modifier}`,
		{ type: 'token', '...$3': '', '...$1': '', descriptor: { type: "class", ranges: '$2' } }),

	def('classComponent',
		`{classChar} '-' {classChar}`, ['$1', '$2'],
		`{classChar}`, ['$1', '$1']),

	def('classChar', `!']' {char}`, 
		'$1'),

	def('any', `{predicate} '.' {modifier}`, 
		{ type: 'token', '...$2': '', '...$1': '', descriptor: { type: "any" } }),

	def('stringToken', `{predicate} {string} {modifier}`,
		{ type: 'token', '...$3': '', '...$1': '', descriptor: '$2' }),

	def('ruleref', `{predicate} {identifier} {modifier}`,
		{ type: 'token', '...$3': '', '...$1': '', descriptor: { type: 'ruleref', name: '$2' } }),

	def('predicate',
		`'&'`, { and: true, not: false },
		`'!'`, { and: false, not: true },
		`''`,  { and: false, not: false }),

	def('modifier',
		`'*'`, { repeat: true, required: false },
		`'+'`, { repeat: true, required: true },
		`'?'`, { repeat: false, required: false },
		`''`,  { repeat: false, required: true }),

	def('value', `{backref|object|array|string|number|boolean|null}`,
		'$1'),

	def('backref', `'$' {/\\d+/}`,
		{ type: 'backref', index: '$1' }),

	def('splat',
		`'...' {backref}`, { type: 'splat', backrefs: ['$1'] },
		`'...(' _ {backref} ( _ ',' _ {backref} )* _ ')'`, { type: 'splat', backrefs: ['$1', '...$2'] }),

	def('object', `'{' ( _ {member} _ ',' )* _ {member}? _ '}'`,
		{ type: 'object', members: ['...$1', '$2'] }),

	def('member', 
		`{splat}`, '$1',
		`{backref|string|identifierAsStringNode} _ ':' _ {value}`, { name: '$1', value: '$2' }),

	def('array', `'[' ( _ {value|splat} _ ',' )* _ {value|splat}? _ ']'`,
		{ type: 'array', elements: ['...$1', '$2'] }),

	def('string', `/'/ {escape|stringText}* /'/`,
		{ type: 'string', tokens: '$1' }),

	def('stringText', `{/[^'\\\n]+/}`,
		{ type: 'text', value: '$1' }),

	def('number', 
		`{/-?\\d+(\\.\\d+)?([eE][-+]\\d+)?/}`, { type: 'number', value: '$1' },
		`{/-?\\.\\d+([eE][-+]\\d+)?/}`, { type: 'number', value: '$1' }),
	
	def('boolean',
		`'true'`, { type: 'boolean', value: true },
		`'false'`, { type: 'boolean', value: false }),

	def('null', `'null'`,
		{ type: 'null' }),

	def('escape', `'\\\\' {unicode|char}`,
		{ type: 'escape', value: '$1' }),

	def('unicode', `'u' [A-Fa-f0-9] [A-Fa-f0-9] [A-Fa-f0-9] [A-Fa-f0-9]`,
		'$0'),

	def('char', `!'\n' .`,
		'$0'),

	def('repeat', `{'*'|'+'|'?'}`, '$1'),

	def('identifier', `/[_a-zA-Z][_a-zA-Z0-9]*/`,
		'$0'),

	def('identifierAsStringNode', `{identifier}`,
		{ type: 'string', tokens: [ {type: 'text', value: '$1' } ] }),
];

function ret(template:string, output:any) : ReturnNode {
    return {
        type: 'return',
		rule: rule(template, output),
    }
}

function def(name:string, ...args:any) : DefineNode {
	let rules = [];
	for (let i = 0; i < args.length; i += 2) {
		rules.push(rule(args[i], args[i+1]));
	}
	return {
		type: 'define',
		name: name,
		rules: rules
	}
}

function rule(template:string, out:any) : RuleNode {
	return {
		type: 'rule',
		options: [ option(template.split(/ +/)) ],
		value: output(out)
	}
}

function option(tokStrs:string[]) : OptionNode {
	let tokens:TokenNode[] = [];

	for (let i = 0; i < tokStrs.length; i++) {
		let tokStr = tokStrs[i];
		let node:DescriptorNode;
		let and = tokStr[0] == '&';
		let not = tokStr[0] == '!';
		if (and || not) {
			tokStr = tokStr.substr(1);
		}
		let required = true, repeat = false;
		if (tokStr == '(') {
			let j = i;
			while (tokStrs[++j][0] != ')');
			if (['?','*'].includes(tokStrs[j][1])) required = false;
			if (['+','*'].includes(tokStrs[j][1])) repeat = true;
			node = group(tokStrs.slice(i+1, j));
			i = j;
		} else {
			if (['?','*'].includes(tokStr[tokStr.length-1])) required = false;
			if (['+','*'].includes(tokStr[tokStr.length-1])) repeat = true;
			if (!required || repeat) {
				tokStr = tokStr.substr(0, tokStr.length - 1);
			}
			if (tokStr[0] == '[') {
				let ranges = tokStr.substr(1,tokStr.length-1).match(/(.-.)/g).map((i) => i.split('-'));
				node = { type: "class", ranges: <[string,string][]>ranges };
			} else {
				switch (tokStr[0]) {
					case '{': node = capture(tokStr); break;
					case '/': node = regex(tokStr); break;
					case `'`: node = string(tokStr); break;
					case '.': node = { type: 'any' }; break;
					default:
						node = ruleref(tokStr); break;
				}
			}
		}
		tokens.push({
			type: 'token',
			required: required,
			repeat: repeat,
			and: and,
			not: not,
			descriptor: node
		})
	}

	return {
		type: 'option',
		tokens: tokens
	};
}

function group(tokens:string[]) : GroupNode {
	let options = [];
	let lastOr = -1;
	for (let i = 0; i < tokens.length; i++) {
		if (tokens[i] == '|') {
			options.push(option(tokens.slice(lastOr+1, i)));
			lastOr = i;
		}
	}
	options.push(option(tokens.slice(lastOr+1, tokens.length)));
	return {
		type: 'group',
		options: options
	}
}

function capture(token:string) : CaptureNode {
	let repeat = null;
	token = token.substr(0, token.length - 1);

	// our limited DSL parsing doesn't allow multiple regex options
	// because it gets confused when the regex contains a pipe,
	// so only split into multiple options when not a regex
	let options;
	if (token[1] == '/') {
		options = [token.substr(1, token.length - 1)];
	} else {
		options = token.substr(1, token.length - 1).split('|');
	}
	return {
		type: 'capture',
		options: options.map((t) => option([t])),
	}
}

function regex(token:string) : RegexNode {
	return {
		type: 'regex',
		pattern: token.substr(1, token.length - 2)
	}
}

function string(token:string) : StringNode {
	return {
		type: 'string',
		tokens: [{
			type: 'text',
			value: token.substr(1, token.length - 2)
		}]
	}
}

function ruleref(token:string) : RuleRefNode {
	if (!token.match(/^[a-zA-Z0-9_]+/)) {
		throw new Error(`invalid identifier: ${token}`);
	}
	return {
		type: 'ruleref',
		name: token
	}
}

function output(value: any) : ValueNode {
	switch (typeof value) {
		case 'object':
			if (value === null) {
				return { type: 'null' };
			} else if (Array.isArray(value)) {
				let ret = [];
				for (let elem of value) {
					ret.push(output(elem));
				}
				return { 
					type: 'array',
					elements: ret
				}
			} else {
				let members = [];
				for (let name in value) {
					if (name.startsWith('...')) {
						// splat
						members.push(output(name));
					} else {
						members.push({
							type: 'member',
							name: output(name),
							value: output(value[name])
						})
					}
				}
				return {
					type: 'object',
					members: members
				}
			}
		case 'string':
			if (value.match(/^\$(\d)$/)) {
				return {
					type: 'backref',
					index: RegExp.$1
				}
			} else if (value.match(/^\.\.\.\$(\d)/)) {
				return {
					type: 'splat',
					backrefs: [{
						type: 'backref',
						index: RegExp.$1
					}]
				}
			} else {
				return {
					type: 'string',
					tokens: [{
						type: 'text',
						value: value
					}]
				}
			}
		case 'number':
			return {
				type: 'number',
				value: String(value)
			}
		case 'boolean':
			return {
				type: 'boolean',
				value: !!value
			}
		default:
			throw new Error('Unexpected JSON data type: ' + typeof value)
	}
}
