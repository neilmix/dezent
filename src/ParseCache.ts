import { ParseContextFrame, MatchStatus, parserError, ErrorCode } from "./Parser";
import { ReturnNode, RulesetNode, TokenNode } from "./Grammar";

export class ParseCache {
    passFail:ParseContextFrame[][] = [];
    passFailRetrieveEnabled:boolean = true;

    constructor(cacheLookupEnabled:boolean) {
        this.passFailRetrieveEnabled = cacheLookupEnabled;
    }

    passFailPos(pos:number) : ParseContextFrame[] {
        if (!this.passFail[pos]) {
            this.passFail[pos] = [];
        }
        return this.passFail[pos];
    }

    store(frame:ParseContextFrame, status:MatchStatus, pos?:number) {
        frame.status = status;
        this.passFailPos(pos||frame.pos)[frame.node.id] = frame;
    }

    retrieve(pos, node):ParseContextFrame|undefined {
        if (this.passFailRetrieveEnabled) {
            return this.passFailPos(pos)[node.id];
        } else {
            return undefined;
        }
    }
    
    visitPassFrames(root:ReturnNode, rulesets: {[key:string]:RulesetNode}, enter:Function, exit:Function) {
        let visit = (frame:ParseContextFrame) => {
            if (!frame) parserError(ErrorCode.Unreachable);
            if (frame.status != MatchStatus.Pass) parserError(ErrorCode.Unreachable);

            //console.log("+", frame.node.type, frame.node["name"] || frame.node["pattern"] || "");
            enter(frame);
            let consumed = 0;
            let childFrame;
            switch (frame.node.type) {
                case "ruleset": 
                case "rule": 
                case "capture": 
                case "group":
                    childFrame = this.passFail[frame.pos][frame.items[frame.index].id];
                    visit(childFrame);
                    break;
                case "pattern": 
                    for (let token of <TokenNode[]>frame.items) {
                        if (!token.and && !token.not) {
                            let childFrame = this.passFail[frame.pos + consumed][token.id];
                            visit(childFrame);
                            consumed += childFrame.consumed;
                        }
                    }
                    break;
                case "token":
                    if (frame.consumed == 0) {
                        let childFrame = this.passFail[frame.pos][frame.node.descriptor.id];
                        if (childFrame.status == MatchStatus.Pass) {
                            visit(childFrame);
                        }
                    } else while (consumed < frame.consumed) {
                        let childFrame = this.passFail[frame.pos + consumed][frame.node.descriptor.id];
                        visit(childFrame);
                        consumed += childFrame.consumed;
                    }
                    break;
                case "ruleref":
                    let childNode = rulesets[frame.node.name];
                    childFrame = this.passFail[frame.pos][childNode.id];
                    visit(childFrame);
                    break;
            }
            exit(frame);
            //console.log("-", frame.node.type);
        }

        visit(this.passFail[0][root.id]);
    }
}