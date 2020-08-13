import "jest";

import "./Parser";
import { parseText } from "./Parser";

test("return values", () => {
    let out = parseText("return /.*/ -> true;", "anything", {debugErrors:true});
    expect(out).toBe(true);

    out = parseText("return /.*/ -> { foo: 1, baz: 2, bee: 3 };", "anything", {debugErrors:true});
    expect(out).toEqual({ foo: 1, baz: 2, bee: 3 });
});
