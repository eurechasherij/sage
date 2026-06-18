import { describe, expect, it } from "bun:test";
import { parseJsonc } from "./jsonc.js";

describe("parseJsonc", () => {
  it("strips trailing commas in objects and arrays", () => {
    expect(parseJsonc<{ a: number; b: number[] }>('{"a":1,"b":[1,2,],}')).toEqual({ a: 1, b: [1, 2] });
  });

  it("strips // line and /* */ block comments", () => {
    expect(parseJsonc<{ a: number; b: number }>('{\n// c\n"a":1, /* x */ "b":2\n}')).toEqual({ a: 1, b: 2 });
  });

  it("does not corrupt string contents (',}' and '//' inside strings)", () => {
    expect(parseJsonc<{ a: string; b: string }>('{"a":"x,}","b":"http://y"}')).toEqual({ a: "x,}", b: "http://y" });
  });
});
