import { ParseContextFrame, MatchStatus, assert } from "./Parser";
import { Node, ReturnNode, RulesetNode, TokenNode } from "./Grammar";

export class ParseCache {
    maxid:number;
    passFail:ParseContextFrame[] = [];
    passFailRetrieveEnabled:boolean = true;

    constructor(maxid: number, cacheLookupEnabled:boolean) {
        this.maxid = maxid;
        this.passFailRetrieveEnabled = cacheLookupEnabled;
    }

    store(frame:ParseContextFrame, pos?:number) {
        let key = this.key(pos||frame.pos, frame.node.id, frame.leftOffset);
        assert(!this.passFail[key] || !this.passFailRetrieveEnabled);
        this.passFail[key] = frame;
        frame.cached = true;
    }

    retrieve(pos:number, node:Node, leftOffset:number):ParseContextFrame|undefined {
        if (this.passFailRetrieveEnabled) {
            return this.get(pos, node.id, leftOffset);
        } else {
            return undefined;
        }
    }
    
    get(pos:number, id:number, leftOffset:number) {
        return this.passFail[this.key(pos, id, leftOffset)];
    }

    key(pos:number, id:number, leftOffset:number) {
        leftOffset = leftOffset > 0 ? leftOffset : 0;
        return (pos+leftOffset)*this.maxid + id;
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
                        debugger;
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

        visit(this.get(0, root.id, -1));
    }
}