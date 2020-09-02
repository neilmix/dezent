import { ParseContextFrame, MatchStatus, parserError, ErrorCode } from "./Parser";
import { ReturnNode, RulesetNode, TokenNode } from "./Grammar";

export class ParseCache {
    maxid:number;
    passFail:ParseContextFrame[] = [];
    passFailRetrieveEnabled:boolean = true;

    constructor(maxid: number, cacheLookupEnabled:boolean) {
        this.maxid = maxid;
        this.passFailRetrieveEnabled = cacheLookupEnabled;
    }

    store(frame:ParseContextFrame, pos?:number) {
        this.passFail[(pos||frame.pos)*this.maxid + frame.node.id] = frame;
    }

    retrieve(pos, node):ParseContextFrame|undefined {
        if (this.passFailRetrieveEnabled) {
            return this.get(pos, node.id);
        } else {
            return undefined;
        }
    }
    
    get(pos:number, id:number) {
        return this.passFail[pos*this.maxid + id];
    }

    visitPassFrames(root:ReturnNode, rulesets: {[key:string]:RulesetNode}, enter:Function, exit:Function) {
        let visit = (frame:ParseContextFrame) => {
            if (!frame) parserError(ErrorCode.Unreachable);
            if (frame.status != MatchStatus.Pass) parserError(ErrorCode.Unreachable);

            enter(frame);
            let consumed = 0;
            let childFrame;
            switch (frame.node.type) {
                case "ruleset": 
                case "rule": 
                case "capture": 
                case "group":
                    childFrame = this.get(frame.pos, frame.items[frame.index].id);
                    visit(childFrame);
                    break;
                case "pattern": 
                    for (let token of <TokenNode[]>frame.items) {
                        if (!token.and && !token.not) {
                            let childFrame = this.get(frame.pos + consumed, token.id);
                            visit(childFrame);
                            consumed += childFrame.consumed;
                        }
                    }
                    break;
                case "token":
                    if (frame.consumed == 0) {
                        let childFrame = this.get(frame.pos, frame.node.descriptor.id);
                        if (childFrame.status == MatchStatus.Pass) {
                            visit(childFrame);
                        }
                    } else while (consumed < frame.consumed) {
                        let childFrame = this.get(frame.pos + consumed, frame.node.descriptor.id);
                        visit(childFrame);
                        consumed += childFrame.consumed;
                    }
                    break;
                case "ruleref":
                    let childNode = rulesets[frame.node.name];
                    childFrame = this.get(frame.pos, childNode.id);
                    visit(childFrame);
                    break;
            }
            exit(frame);
        }

        visit(this.get(0, root.id));
    }
}