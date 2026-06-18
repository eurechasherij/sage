import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanNpm } from "./npm.js";

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "sage-scan-npm-"));
  await writeFile(
    join(dir, "package.json"),
    JSON.stringify({
      name: "app",
      dependencies: { swr: "^2.2.0" },
      devDependencies: { vitest: "^2.1.0" },
    }),
  );
  await writeFile(
    join(dir, "package-lock.json"),
    JSON.stringify({
      lockfileVersion: 3,
      packages: {
        "": { name: "app" },
        "node_modules/swr": {
          version: "2.2.5",
          resolved: "https://registry.npmjs.org/swr/-/swr-2.2.5.tgz",
        },
        "node_modules/vitest": {
          version: "2.1.4",
          resolved: "https://registry.npmjs.org/vitest/-/vitest-2.1.4.tgz",
        },
        "node_modules/@acme/internal": {
          version: "1.0.0",
          resolved: "https://npm.acme.local/@acme/internal/-/internal-1.0.0.tgz",
        },
        "node_modules/ui": { link: true, resolved: "packages/ui" },
        // transitive scoped + nested path -> name resolves to the last segment
        "node_modules/swr/node_modules/dequal": {
          version: "2.0.3",
          resolved: "https://registry.npmjs.org/dequal/-/dequal-2.0.3.tgz",
        },
      },
    }),
  );
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("scanNpm", () => {
  it("finds installed packages with their resolved versions", async () => {
    const swr = (await scanNpm(dir)).find((p) => p.name === "swr");
    expect(swr).toBeDefined();
    expect(swr?.version).toBe("2.2.5");
    expect(swr?.ecosystem).toBe("npm");
  });

  it("marks declared deps as direct, transitive ones as not", async () => {
    const pkgs = await scanNpm(dir);
    expect(pkgs.find((p) => p.name === "swr")?.direct).toBe(true);
    expect(pkgs.find((p) => p.name === "vitest")?.direct).toBe(true);
    expect(pkgs.find((p) => p.name === "dequal")?.direct).toBe(false);
  });

  it("treats public-registry packages as a public coordinate", async () => {
    expect((await scanNpm(dir)).find((p) => p.name === "swr")?.publicCoordinate).toBe(true);
  });

  it("treats private-registry packages as NOT public (never send)", async () => {
    expect(
      (await scanNpm(dir)).find((p) => p.name === "@acme/internal")?.publicCoordinate,
    ).toBe(false);
  });

  it("treats workspace links as NOT public", async () => {
    expect((await scanNpm(dir)).find((p) => p.name === "ui")?.publicCoordinate).toBe(false);
  });

  it("resolves scoped and nested names from their node_modules path", async () => {
    const pkgs = await scanNpm(dir);
    expect(pkgs.find((p) => p.name === "@acme/internal")).toBeDefined();
    expect(pkgs.find((p) => p.name === "dequal")).toBeDefined();
  });

  it("returns [] when there is no package-lock.json", async () => {
    const empty = await mkdtemp(join(tmpdir(), "sage-scan-empty-"));
    expect(await scanNpm(empty)).toEqual([]);
    await rm(empty, { recursive: true, force: true });
  });
});
