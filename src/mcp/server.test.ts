import { describe, expect, it } from "vitest";
import { createServer } from "./server.js";

describe("mcp server", () => {
  it("constructs with the pure-data tools wired", () => {
    const server = createServer();
    expect(server).toBeDefined();
  });
});
