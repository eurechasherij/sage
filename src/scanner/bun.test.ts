import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanBun } from "./bun.js";

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "sage-scan-bun-"));
  // Trailing commas on purpose — exercises the JSONC parser.
  await writeFile(
    join(dir, "bun.lock"),
    `{
  "lockfileVersion": 1,
  "workspaces": {
    "": {
      "name": "app",
      "dependencies": { "swr": "^2.2.0", "@acme/ui": "^1.0.0", },
      "devDependencies": { "typescript": "^5.6.0", },
    },
  },
  "packages": {
    "swr": ["swr@2.2.5", "", {}, "sha512-aaa"],
    "typescript": ["typescript@5.6.3", "", {}, "sha512-bbb"],
    "dequal": ["dequal@2.0.3", "", {}, "sha512-ccc"],
    "@acme/ui": ["@acme/ui@1.0.0", "", {}, "sha512-ddd"],
    "localpkg": ["localpkg@workspace:packages/localpkg"],
    "fromgit": ["fromgit@github:owner/repo#abc"],
    "aliased": ["aliased@npm:left-pad@1.3.0", "", {}, "sha512-eee"],
  },
}
`,
  );
  await writeFile(
    join(dir, "bunfig.toml"),
    `[install]\nexact = true\n\n[install.scopes]\n"@acme" = "https://npm.acme.local/"\n`,
  );
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("scanBun", () => {
  it("parses a JSONC bun.lock and reports installed packages (ecosystem npm)", async () => {
    const swr = (await scanBun(dir)).find((p) => p.name === "swr");
    expect(swr).toMatchObject({ version: "2.2.5", ecosystem: "npm", direct: true, publicCoordinate: true });
  });

  it("marks devDependencies direct and transitives not", async () => {
    const pkgs = await scanBun(dir);
    expect(pkgs.find((p) => p.name === "typescript")?.direct).toBe(true);
    expect(pkgs.find((p) => p.name === "dequal")?.direct).toBe(false);
  });

  it("treats a workspace package as NOT public", async () => {
    expect((await scanBun(dir)).find((p) => p.name === "localpkg")?.publicCoordinate).toBe(false);
  });

  it("treats a git package as NOT public", async () => {
    expect((await scanBun(dir)).find((p) => p.name === "fromgit")?.publicCoordinate).toBe(false);
  });

  it("treats a custom-registry scope (bunfig install.scopes) as NOT public", async () => {
    expect((await scanBun(dir)).find((p) => p.name === "@acme/ui")?.publicCoordinate).toBe(false);
  });

  it("resolves an npm: alias to the real package, marked public", async () => {
    const real = (await scanBun(dir)).find((p) => p.name === "left-pad");
    expect(real).toMatchObject({ version: "1.3.0", publicCoordinate: true });
  });

  it("returns [] when there is no bun.lock", async () => {
    const empty = await mkdtemp(join(tmpdir(), "sage-scan-bun-empty-"));
    expect(await scanBun(empty)).toEqual([]);
    await rm(empty, { recursive: true, force: true });
  });
});
