export type Grammar = { 
	text?: string,
	ruledefs: RuleDefNode[], 
	vars: { [key:string]: ValueNode }, 
	ruledefLookup?: { [key:string]: RuleDefNode } 
};

export interface Meta {
	pos: number,
	length: number
}

export interface Node { 
	type: string,
	meta?: Meta
}
export interface OutputNode extends Node {
	collapse?: boolean
}

export interface SelectorNode extends Node { options: PatternNode[], canFail?: boolean }
export interface MatcherNode extends Node { 
	pattern?: string; // for debug purposes
	match?(s : string) : [boolean, number]; 
}
export interface RangeNode extends Node {
	value: string,
	match?: string
}

export type DescriptorNode = CaptureNode | GroupNode | StringNode | ClassNode | RuleRefNode | AnyNode;
export type ParseNode = RuleDefNode | RuleNode | PatternNode | TokenNode | DescriptorNode;
export type ValueNode = BackRefNode | VarRefNode | MetaRefNode | PivotNode | SpreadNode | ObjectNode | ArrayNode | StringNode | NumberNode | BooleanNode | NullNode;

export interface MetaData {
}

export interface RuleDefNode extends Node { 
	type: 'ruledef',
	name: string,
	rules: RuleNode[],
	canFail?: boolean
}

export interface ReturnNode extends RuleDefNode {
	name: 'return'
}

export interface RuleNode extends SelectorNode { 
	type: 'rule',
	value: ValueNode, 
	captures?: boolean[], 
	ruledefName?: string
}

export interface PatternNode extends Node { 
	type: 'pattern',
	tokens: TokenNode[],
	canFail?: boolean 
}

export interface TokenNode extends Node { 
	type: 'token', 
	required: boolean, 
	repeat: boolean, 
	and: boolean,
	not: boolean,
	descriptor: DescriptorNode 
}
export interface CaptureNode      extends SelectorNode { type: 'capture',   index?: number }
export interface GroupNode        extends SelectorNode { type: 'group' }
export interface RuleRefNode      extends Node         { type: 'ruleref',   name: string }
export interface ClassNode        extends MatcherNode  { type: 'class',     ranges: [RangeNode, RangeNode][] }
export interface AnyNode          extends MatcherNode  { type: 'any' }
export interface StringNode       extends MatcherNode, 
                                          OutputNode   { type: 'string',    tokens: (EscapeNode|StringTextNode)[] }
export interface StringTextNode   extends Node         { type: 'text',      value: string }
export interface EscapeNode       extends RangeNode    { type: 'escape',    value: string }
export interface CharNode         extends RangeNode    { type: 'char',      value: string }

export interface BackRefNode      extends OutputNode { type: 'backref',   index: string }
export interface VarRefNode       extends OutputNode { type: 'varref',    name: string }
export interface MetaRefNode      extends OutputNode { type: 'metaref',   name: string }
export interface PivotNode        extends OutputNode { type: 'pivot',     value: BackRefNode|VarRefNode|ObjectNode|ArrayNode|PivotNode }
export interface SpreadNode       extends OutputNode { type: 'spread',    refs: (BackRefNode|VarRefNode)[] }
export interface ObjectNode       extends OutputNode { type: 'object',    members: (MemberNode|SpreadNode)[] }
export interface ArrayNode        extends OutputNode { type: 'array',     elements: ValueNode[] }
export interface NumberNode       extends OutputNode { type: 'number',    value: string }
export interface BooleanNode      extends OutputNode { type: 'boolean',   value: boolean }
export interface NullNode         extends OutputNode { type: 'null' }

export interface MemberNode { type: 'member', name: BackRefNode|StringNode, value: ValueNode }

let kNull:NullNode = { type: 'null' }

export function createUncompiledDezentGrammar():Grammar {

	// This is a mini DSL that allows us to build an AST
	// that our parser uses to parse grammar files.
	// This is the same grammar as in grammar.dezent,
	// though there are some restrictions to avoid
	// having to write a full recursive descent parser:
	// - there can be no whitespace within a capture
	// - object spread must be written as name/value pair, e.g. ...$1': ''
	// - grouping parens (and predicate/modifier) must be surrounded by whitespace
	// - character classes don't support spaces - use \\u0020
	// - collapse can only happen with backrefs
	// - spread operator can only be used with backrefs

	return {
		ruledefs: [
			returndef(`_ ( {returndef|ruledef} _ | '$' {identifier} _ '=' _ {value} _ ';' _ )*`, 
				{ ruledefs: "$1", vars: { '...($2,$3)': '' } }),

			ruledef('_', `( singleLineComment | multiLineComment | whitespace? )*`, null),

			ruledef('singleLineComment', `'//' ( !'\\n' . )* '\\n'`, null),
			ruledef('multiLineComment',  `'/*' ( !'*/' . )* '*/'`, null),
			ruledef('whitespace',        `[\\u0020\\t-\\r]+`, null),

			ruledef('returndef', `'return' whitespace _ {rule} _ ';'`,
				{ type: 'ruledef', name: 'return', rules: ['$1'], '...$meta': '' }),

			ruledef('ruledef', `{identifier} _ '=' _ {rule} ( _ ',' _ {rule} )* _ ';'`,
				{ type: 'ruledef', name: '$1', rules: ['$2', '...$3'], '...$meta': '' }),

			ruledef('rule', `{options} _ '->' _ {value}`,
				{ type: 'rule', '...$1': '', value: '$2', '...$meta': '' }),
			
			ruledef('options', `{pattern} _ ( '|' _ {pattern} _ )*`,
				{ options: ['$1', '...$2'] }),

			ruledef('pattern', `( {token} _ )+`,
				{ type: 'pattern', tokens: '$1' }),

			ruledef('token', `{predicate} {capture|group|string|class|ruleref|any} {modifier}`,
				{ type: 'token', '...$3': '', '...$1': '', descriptor: '$2' }),
			
			ruledef('capture', `'{' _ {captureOptions} _ '}'`,
				{ type: 'capture', '...$1': '' }),

			ruledef('group', `'(' _ {options} _ ')'`,
				{ type: 'group', '...$1': '' }),

			ruledef('captureOptions', `{capturePattern} _ ( '|' _ {capturePattern} _ )*`,
				{ options: ['$1', '...$2'] }),

			ruledef('capturePattern', `( {captureToken} _ )+`,
				{ type: 'pattern', tokens: '$1' }),

			ruledef('captureToken', `{predicate} {captureGroup|string|class|ruleref|any} {modifier}`,
				{ type: 'token', '...$3': '', '...$1': '', descriptor: '$2' }),

			ruledef('captureGroup', `'(' _ {captureOptions} _ ')'`,
				{ type: 'group', '...$1': '' }),

			ruledef('class', `'[' {classComponent}* ']'`,
				{ type: 'class', ranges: '$1' }),
			
			ruledef('classComponent',
				`{classChar} '-' {classChar}`, ['$1', '$2'],
				`{classChar}`, ['$1', '$1']),

			ruledef('classChar', `!']' {escape|char}`, 
				'$1'),

			ruledef('char', `charstr`,
				{ type: 'char', value: '$0' }),
			
			ruledef('any', `'.'`, 
				{ type: 'any' }),

			ruledef('ruleref', `{identifier}`,
				{ type: 'ruleref', name: '$1', '...$meta': '' }),

			ruledef('predicate',
				`'&'`, { and: true, not: false },
				`'!'`, { and: false, not: true },
				`''`,  { and: false, not: false }),

			ruledef('modifier',
				`'*'`, { repeat: true, required: false },
				`'+'`, { repeat: true, required: true },
				`'?'`, { repeat: false, required: false },
				`''`,  { repeat: false, required: true }),

			ruledef('value', `{backref|varref|metaref|pivot|object|array|string|number|boolean|null}`,
				'$1'),

			ruledef('backref', `'$' {[0-9]+}`,
				{ type: 'backref', index: '$1', '...$meta': '' }),

			ruledef('varref', `'$' {identifier}`,
				{ type: 'varref', name: '$1', '...$meta': '' }),

			ruledef('metaref', `'@' {'position'|'length'}`,
				{ type: 'metaref', name: '$1' }),

			ruledef('pivot', `'^' {backref|varref|array|pivot}`,
				{ type: 'pivot', value: '$1' }),

			ruledef('spread',
				`'...' {backref|varref|object|array|string}`, { type: 'spread', refs: ['$1'], '...$meta': '' },
				`'...(' _ {backref|varref} ( _ ',' _ {backref|varref} )* _ ')'`, { type: 'spread', refs: ['$1', '...$2'], '...$meta': '' }),

			ruledef('object', `'{' ( _ {member} _ ',' )* _ {member}? _ '}'`,
				{ type: 'object', members: ['...$1', '$2?'] }),

			ruledef('member', 
				`{spread}`, '$1',
				`{backref|string|identifierAsStringNode} _ ':' _ {value}`, { type: 'member', name: '$1', value: '$2' }),

			ruledef('array', `'[' ( _ {element} _ ',' )* _ {element}? _ ']'`,
				{ type: 'array', elements: ['...$1', '$2?'] }),

			ruledef('element',
				`{value|spread} '?'`, { '...$1':'', collapse: true },
				`{value|spread}`, { '...$1':'', collapse: false }),

			ruledef('string', `'\\'' {escape|stringText}* '\\''`,
				{ type: 'string', tokens: '$1' }),

			ruledef('stringText', `( !['\\\\] . )+`,
				{ type: 'text', value: '$0' }),

			ruledef('number', 
				`'-'? ( [0-9]+ )? '.' [0-9]+ ( [eE] [-+] [0-9]+ )?`, { type: 'number', value: '$0' },
				`'-'? [0-9]+ ( [eE] [-+] [0-9]+ )?`, { type: 'number', value: '$0' }),
			
			ruledef('boolean',
				`'true'`, { type: 'boolean', value: true },
				`'false'`, { type: 'boolean', value: false }),

			ruledef('null', `'null'`,
				{ type: 'null' }),

			ruledef('escape', `'\\\\' {unicode|charstr}`,
				{ type: 'escape', value: '$1' }),

			ruledef('unicode', `'u' [A-Fa-f0-9] [A-Fa-f0-9] [A-Fa-f0-9] [A-Fa-f0-9]`,
				'$0'),

			ruledef('charstr', `!'\\n' .`,
				'$0'),

			ruledef('identifier', `[_a-zA-Z] [_a-zA-Z0-9]*`,
				'$0'),

			ruledef('identifierAsStringNode', `{identifier}`,
				{ type: 'string', tokens: [ {type: 'text', value: '$1' } ] }),
		],
		vars: {
			meta: output({ meta: { pos: "@position", length: "@length" } })
		}
	};
}

function returndef(options:string, output:any) : ReturnNode {
    return {
		type: 'ruledef',
		name: 'return',
		rules: [rule(options, output)],
    }
}

function ruledef(name:string, ...args:any) : RuleDefNode {
	let rules = [];
	for (let i = 0; i < args.length; i += 2) {
		rules.push(rule(args[i], args[i+1]));
	}
	return {
		type: 'ruledef',
		name: name,
		rules: rules
	}
}

function rule(options:string, out:any) : RuleNode {
	return {
		type: 'rule',
		options: [ pattern(options.split(/ +/)) ],
		value: output(out)
	}
}

function pattern(tokStrs:string[]) : PatternNode {
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
				node = charClass(tokStr);
			} else {
				switch (tokStr[0]) {
					case '{': node = capture(tokStr); break;
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
		type: 'pattern',
		tokens: tokens
	};
}

function group(tokens:string[]) : GroupNode {
	let options = [];
	let lastOr = -1;
	for (let i = 0; i < tokens.length; i++) {
		if (tokens[i] == '|') {
			options.push(pattern(tokens.slice(lastOr+1, i)));
			lastOr = i;
		}
	}
	options.push(pattern(tokens.slice(lastOr+1, tokens.length)));
	return {
		type: 'group',
		options: options
	}
}

function capture(token:string) : CaptureNode {
	let repeat = null;
	token = token.substr(0, token.length - 1);

	let options = token.substr(1, token.length - 1).split('|');

	return {
		type: 'capture',
		options: options.map((t) => pattern([t])),
	}
}

function charClass(token:String) : ClassNode {
	let ranges = [];
	let j = 1;
	let parseBound = () => {
		let bound;
		if (token[j] == '\\') {
			j++;
			let value = token[j] == 'u' ? token.substr(j, 5) : token[j];
			j += value.length - 1;
			bound = { type: 'escape', value: value };
		} else {
			bound = { type: 'char', value: token[j] };
		}
		j++;
		return bound;
	}
	while (j < token.length - 1) {
		let start = parseBound();
		let end;
		if (token[j] == '-') {
			j++;
			end = parseBound();
		}
		ranges.push([start,end||start]);
	}
	return { type: 'class', ranges: ranges };
}

function string(token:string) : StringNode {
	token = token.substr(1, token.length - 2); // strip bounding quotes
	if (token.length == 2 && token[0] == '\\') {
		return {
			type: 'string',
			tokens: [{
				type: 'escape',
				value: token[1]
			}]
		};
	} else if (token.indexOf('\\') >= 0) {
		throw new Error('not yet implemented');
	} else if (token.length == 0) {
		return {
			type: 'string',
			tokens: []
		}
	} else {
		return {
			type: 'string',
			tokens: [{
				type: 'text',
				value: token
			}]
		}
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
					let out = output(elem);
					out.collapse = elem.length > 1 && elem[elem.length-1] == '?';
					ret.push(out);
				}
				return { 
					type: 'array',
					elements: ret
				}
			} else {
				let members = [];
				for (let name in value) {
					if (name.startsWith('...')) {
						// spread
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
			if (value.match(/^\$(\d+)/)) {
				return {
					type: 'backref',
					index: RegExp.$1
				}
			} else if (value.match(/^@([a-zA-Z_]+)/)) {
				return {
					type: 'metaref',
					name: RegExp.$1
				}
			} else if (value.match(/^\.\.\./)) {
				let ref = function(name:string):BackRefNode|VarRefNode { 
					// don't use a regexp here because it will mess up the backrefs just prior to this call
					return name[0] <= '9'
						? { type: 'backref', index: name } 
						: { type: 'varref', name: name };
				}
				if (value.match(/^...\$([0-9]+|[a-zA-Z_]+)/)) {
					return { type: 'spread', refs: [ ref(RegExp.$1) ] };
				} else if (value.match(/^...\(\$([0-9]+|[a-zA-Z_]+),\$([0-9]+|[a-zA-Z_]+)\)/)) {
					return { type: 'spread', refs: [ ref(RegExp.$1), ref(RegExp.$2) ] };
				} else {
					throw new Error();
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
