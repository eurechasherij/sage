import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { taskKey } from "./taskkey.js";
import {
  buildArtifact,
  isArtifactValid,
  readArtifact,
  writeArtifact,
  type BuildInput,
} from "./artifact.js";

function input(over: Partial<BuildInput> = {}): BuildInput {
  return {
    taskKey: "proj-412",
    taskText: "add polling to the dashboard",
    lockfileContent: '{"lockfileVersion":3}',
    capabilities: ["client-side data fetching", "polling"],
    toolVersion: "0.0.1",
    policyVersion: "1",
    mode: "human-decides",
    decisions: [
      { capability: "polling", outcome: "reused", package: "swr", version: "2.2.5", reason: "already installed", docsChecked: ["https://swr.vercel.app"] },
    ],
    degradedSources: [],
    timestamp: "2026-06-18T00:00:00Z",
    ...over,
  };
}

describe("taskKey", () => {
  it("prefers ticket, then branch, then text hash", () => {
    expect(taskKey({ ticket: "PROJ-412" })).toBe("proj-412");
    expect(taskKey({ branch: "feature/Polling Work" })).toBe("feature-polling-work");
    expect(taskKey({ text: "do the thing" })).toMatch(/^task-[0-9a-f]{12}$/);
    expect(taskKey({})).toBe("task-unknown");
  });
});

describe("decision artifact", () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "sage-decision-"));
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("writes and reads back an artifact", async () => {
    const art = buildArtifact(input());
    await writeArtifact(dir, art);
    const read = await readArtifact(dir, "proj-412");
    expect(read).toEqual(art);
  });

  it("capabilities hash is order-insensitive", () => {
    const a = buildArtifact(input({ capabilities: ["a", "b"] }));
    const b = buildArtifact(input({ capabilities: ["b", "a"] }));
    expect(a.capabilitiesHash).toBe(b.capabilitiesHash);
  });

  it("validates when task, lockfile, and capabilities match", () => {
    const art = buildArtifact(input());
    const v = isArtifactValid(art, {
      taskText: "add polling to the dashboard",
      lockfileContent: '{"lockfileVersion":3}',
      capabilities: ["polling", "client-side data fetching"],
    });
    expect(v.valid).toBe(true);
  });

  it("invalidates when the lockfile changed", () => {
    const art = buildArtifact(input());
    const v = isArtifactValid(art, {
      taskText: "add polling to the dashboard",
      lockfileContent: '{"lockfileVersion":3,"changed":true}',
      capabilities: ["polling", "client-side data fetching"],
    });
    expect(v.valid).toBe(false);
    expect(v.mismatches).toContain("lockfile changed");
  });

  it("invalidates when a new capability appears (artifact does not cover it)", () => {
    const art = buildArtifact(input());
    const v = isArtifactValid(art, {
      taskText: "add polling to the dashboard",
      lockfileContent: '{"lockfileVersion":3}',
      capabilities: ["polling", "client-side data fetching", "feature flag"],
    });
    expect(v.valid).toBe(false);
    expect(v.mismatches).toContain("capabilities changed");
  });

  it("returns null reading a missing artifact", async () => {
    expect(await readArtifact(dir, "nope")).toBeNull();
  });
});
