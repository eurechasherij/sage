import { describe, expect, it } from "bun:test";
import { gateDecision, isSourceFile } from "./gate.js";

describe("isSourceFile", () => {
  it("treats code under src as source", () => {
    expect(isSourceFile("src/app/handler.ts")).toBe(true);
    expect(isSourceFile("app/Models/User.php")).toBe(true);
  });
  it("excludes tests, config, docs, node_modules, and the decision artifacts", () => {
    expect(isSourceFile("src/x.test.ts")).toBe(false);
    expect(isSourceFile("vite.config.ts")).toBe(false);
    expect(isSourceFile("docs/design.md")).toBe(false);
    expect(isSourceFile("node_modules/foo/index.js")).toBe(false);
    expect(isSourceFile(".sage/decisions/proj-1.json")).toBe(false);
    expect(isSourceFile("README.md")).toBe(false);
    expect(isSourceFile("package.json")).toBe(false);
  });
});

describe("gateDecision", () => {
  const base = { toolName: "Write", filePath: "src/x.ts", hasDecisionArtifact: false, gateOff: false };

  it("blocks editing source when no decision artifact exists", () => {
    expect(gateDecision(base).decision).toBe("block");
  });
  it("allows once a decision artifact exists", () => {
    expect(gateDecision({ ...base, hasDecisionArtifact: true }).decision).toBe("allow");
  });
  it("allows non-edit tools", () => {
    expect(gateDecision({ ...base, toolName: "Read" }).decision).toBe("allow");
  });
  it("allows editing non-source files (tests/docs/config)", () => {
    expect(gateDecision({ ...base, filePath: "src/x.test.ts" }).decision).toBe("allow");
    expect(gateDecision({ ...base, filePath: "docs/x.md" }).decision).toBe("allow");
  });
  it("respects the SAGE_GATE=off escape hatch", () => {
    expect(gateDecision({ ...base, gateOff: true }).decision).toBe("allow");
  });
});
