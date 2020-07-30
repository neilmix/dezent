import "jest";

import "./Parser";
import { parseTextWithGrammar } from "./Parser";

test("placeholder", () => {
    let out = parseTextWithGrammar([{
        type: "return",
        rule: {
            type: "rule",
            options: [{
                type: "option",
                tokens: [{
                    type: "regex",
                    pattern: ".*"
                }]
            }],
            output: {
                type: "boolean",
                value: true
            }
        }
    }], "anything");
    expect(out).toBe(true);
});
