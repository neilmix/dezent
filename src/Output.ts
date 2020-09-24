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
    assert,
    ErrorCode, parserError
} from './Parser';

import {
    grammarError
} from './ParseManager';

import { 
    Grammar, RuleNode, ValueNode, ObjectNode, ArrayNode, BooleanNode, StringNode, StringTextNode, EscapeNode,
    NumberNode, BackRefNode, ConstRefNode, MetaRefNode, PivotNode, SpreadNode
} from './Grammar';

export type Output = {
    captureIndex?: number,
    position: number,
    length: number,
    segment?: string,
    rule?: RuleNode,
    captures?: Output[],
}

export class ValueBuilder {
    grammar:Grammar;
    output:Output;

    constructor(grammar:Grammar, output:Output) {
        this.grammar = grammar;
        this.output = output;
    }

    value(node?:ValueNode, captures?:any[], metas?:{ position: number, length: number }) {
        if (!this.output) return undefined;

        if (!node) {
            node = this.output.rule.value;
            captures = this.buildCaptures(this.output);
            metas = { position: this.output.position, length: this.output.length };
        }

        let out = this[node.type](<any>node, captures, metas);
        if (node.access) for (let prop of node.access) {
            if (out == null || (typeof out != 'object' && typeof out != 'string')) {
                grammarError(ErrorCode.InvalidAccessRoot, this.grammar.text, prop.meta, JSON.stringify(out));
            }
            let index;
            if (prop.value) {
                index = this.value(prop.value, captures, metas);
                if (typeof index != 'string' && typeof index != 'number') {
                    grammarError(ErrorCode.InvalidAccessIndex, this.grammar.text, prop.meta, JSON.stringify(index));
                }
            } else {
                index = prop.name;
            }
            if (!out.hasOwnProperty(index)) {
                grammarError(ErrorCode.InvalidAccessProperty, this.grammar.text, prop.meta, index);
            }
            out = out[index];
        }
        return out;
    }

    buildCaptures(output:Output) {
        let valueCaptures:any = output.rule.captures.map((b) => b === true ? [] : null); 
        if (output.captures) for (let capture of output.captures) {
            let value;
            if (capture.rule) {
                value = this.value(
                    capture.rule.value, 
                    this.buildCaptures(capture), 
                    { position: capture.position, length: capture.length }
                );
            } else {
                assert(capture.segment !== undefined);
                value = capture.segment;                
            }

            assert(capture.captureIndex !== undefined);
            assert(capture.captureIndex < output.rule.captures.length);
            if (output.rule.captures[capture.captureIndex]) {
                // this indicates the capture is an array
                if (!valueCaptures[capture.captureIndex]) {
                    valueCaptures[capture.captureIndex] = [];
                }
                valueCaptures[capture.captureIndex].push(value);
            } else {
                // this is a solo capture
                assert(valueCaptures[capture.captureIndex] === null);
                valueCaptures[capture.captureIndex] = value;
            }
        }
        return valueCaptures;
    }

    backref(node:BackRefNode, captures) {
        let cap = captures[node.index];
        if (node.collapse && Array.isArray(cap)) {
            let ret = [];
            for (let item of cap) {
                if (item != null) {
                    ret.push(item);
                }
            }
            return ret;
        } else {
            return cap;
        }
    }

    constref(node:ConstRefNode, captures, metas) {
        let resolved = this.grammar.vars[node.name];
        return this.value(resolved, captures, metas);
    }

    metaref(node:MetaRefNode, captures, metas) {
        return metas[node.name];
    }

    pivot(node:PivotNode, captures, metas) {
        let value = this.value(node.value, captures, metas);
        if (!Array.isArray(value)) {
            grammarError(ErrorCode.InvalidPivot, this.grammar.text, node.meta, JSON.stringify(value));
        }
        value.map((item) => {
            if (!Array.isArray(item)) {
                grammarError(ErrorCode.InvalidPivot, this.grammar.text, node.meta, JSON.stringify(item));
            }
            if (item.length != value[0].length) {
                grammarError(ErrorCode.PivotArraySizeMismatch, this.grammar.text, node.meta);
            }
        })
        let ret = [];
        for (let item of value[0]) {
            ret.push([]);
        }
        for (let i = 0; i < value.length; i++) {
            for (let j = 0; j < value[0].length; j++) {
                ret[j][i] = value[i][j];
            }
        }
        return ret;
    }

    spread(node:SpreadNode, captures, metas) {
        let value = this.value(node.value, captures, metas);
        if (!value || (typeof value != 'object' && typeof value != 'string')) {
            grammarError(ErrorCode.InvalidSpread, this.grammar.text, node.meta, JSON.stringify(value));
        }
        if (typeof value == "string") {
            return value.split('');
        } else if (Array.isArray(value)) {
            return value;
        } else {
            return Object.entries(value);
        }
    }

    object(node:ObjectNode, captures, metas) {
        let ret = {};
        for (let member of node.members) {
            if (member.type == "spread") {
                let tuples = this.value(member, captures, metas);
                for (let tuple of tuples) {
                    if (!Array.isArray(tuple) || tuple.length != 2) {
                        grammarError(ErrorCode.InvalidObjectTuple, this.grammar.text, member.meta, JSON.stringify(tuple));
                    }
                    // make sure our value isn't void...
                    if (tuple[1] !== undefined) {
                        ret[tuple[0]] = tuple[1];
                    }
                }
            } else {
                ret[this.value(member.name, captures, metas)] 
                    = this.value(member.value, captures, metas);
            }
        }
        return ret;
    }

    array (node:ArrayNode, captures, metas) {
        let ret = [];
        for (let elem of node.elements) {
            if (elem.type == "spread") {
                ret = ret.concat(this.value(elem, captures, metas));
            } else {
                let val = this.value(elem, captures, metas);
                if (
                    val !== undefined // void
                    && ((elem.type == "backref" && !elem.collapse) || val !== null)) 
                {
                    ret.push(val);
                }
            }
        }
        return ret;
    }

    string(node:StringNode) {
        return buildString(node);
    }

    number(node:NumberNode) {
        return Number(node.value);
    }

    boolean(node:BooleanNode) {
        return node.value;
    }

    null() {
        return null;
    }

    void() {
        return undefined;
    }
}

export function buildString(node:StringNode) {
    return node.tokens.map((node:StringTextNode|EscapeNode) => {
        if (node.type == "text") {
            return node.value;
        } else if (node.value[0] == 'u') {
            return String.fromCharCode(Number(`0x${node.value.substr(1)}`));
        } else if(node.value.length > 1) {
            parserError(ErrorCode.Unreachable);
        } else if ("bfnrt".indexOf(node.value) >= 0) {
            return ({ b:'\b', f:'\f', n:'\n', r:'\r', t:'\t' })[node.value];
        } else {
            return node.value;
        }
    }).join("")
}
