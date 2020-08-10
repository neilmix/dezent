import "jest";

import "./Parser";
import { parseText } from "./Parser";

test("return values", () => {
    let out = parseText("return /.*/ -> true;", "anything");
    expect(out).toBe(true);
});
