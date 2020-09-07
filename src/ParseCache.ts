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

import { ParseContextFrame, MatchStatus, assert } from "./Parser";
import { Node, ReturnNode, RulesetNode, TokenNode } from "./Grammar";

export class ParseCache {
    maxid:number;
    frameCache:ParseContextFrame[][] = [];
    cacheRetrieveEnabled:boolean = true;

    constructor(maxid: number, cacheLookupEnabled:boolean) {
        this.maxid = maxid;
        this.cacheRetrieveEnabled = cacheLookupEnabled;
    }

    store(frame:ParseContextFrame, pos?:number) {
        pos = pos || frame.pos;
        let key = this.key(frame.node.id, frame.leftOffset);
        if (!this.frameCache[pos]) this.frameCache[pos] = [];
        assert(!this.frameCache[pos][key] || !this.cacheRetrieveEnabled);
        this.frameCache[pos][key] = frame;
        frame.cached = true;
    }

    retrieve(pos:number, node:Node, leftOffset:number):ParseContextFrame|undefined {
        if (this.cacheRetrieveEnabled) {
            return this.get(pos, node.id, leftOffset);
        } else {
            return undefined;
        }
    }
    
    get(pos:number, id:number, leftOffset:number) {
        if (!this.frameCache[pos]) return undefined;
        return this.frameCache[pos][this.key(id, leftOffset)];
    }

    key(id:number, leftOffset:number) {
        return leftOffset*this.maxid + id;
    }

    visitPassFrames(root:ReturnNode, rulesets: {[key:string]:RulesetNode}, enter:Function, exit:Function) {
        let visit = (frame:ParseContextFrame) => {
            assert(!!frame);
            assert(frame.status == MatchStatus.Pass);

            enter(frame);
            let consumed = 0;
            let childFrame;
            switch (frame.node.type) {
                case "ruleset": 
                    if (frame.nextFrame) {
                        visit(frame.nextFrame);
                        break;
                    }
                case "rule": 
                case "capture": 
                case "group":
                    visit(this.get(frame.pos, frame.items[frame.index].id, frame.leftOffset));
                    break;
                case "pattern": 
                    for (let token of <TokenNode[]>frame.items) {
                        if (!token.and && !token.not) {
                            let childFrame = this.get(frame.pos + consumed, token.id, frame.leftOffset);
                            visit(childFrame);
                            consumed += childFrame.consumed;
                        }
                    }
                    break;
                case "token":
                    if (frame.consumed == 0) {
                        let childFrame = this.get(frame.pos, frame.node.descriptor.id, frame.leftOffset);
                        if (childFrame.status == MatchStatus.Pass) {
                            visit(childFrame);
                        }
                    } else while (consumed < frame.consumed) {
                        let childFrame = this.get(frame.pos + consumed, frame.node.descriptor.id, frame.leftOffset);
                        visit(childFrame);
                        consumed += childFrame.consumed;
                    }
                    break;
                case "ruleref":
                    let childNode = rulesets[frame.node.name];
                    childFrame = this.get(frame.pos, childNode.id, frame.leftOffset);
                    visit(childFrame);
                    break;
            }
            exit(frame);
        }

        visit(this.get(0, root.id, 0));
    }
}