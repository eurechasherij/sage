import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanPnpm } from "./pnpm.js";

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "sage-scan-pnpm-"));
  await writeFile(
    join(dir, "package.json"),
    JSON.stringify({ dependencies: { swr: "^2.2.0" }, devDependencies: { foo: "^1.0.0" } }),
  );
  await writeFile(
    join(dir, "pnpm-lock.yaml"),
    `lockfileVersion: '9.0'
settings:
  autoInstallPeers: true
importers:
  .:
    dependencies:
      swr:
        specifier: ^2.2.0
        version: 2.2.5
packages:
  swr@2.2.5:
    resolution: {integrity: sha512-aaa}
  '@acme/ui@1.0.0':
    resolution: {tarball: https://npm.acme.local/@acme/ui/-/ui-1.0.0.tgz}
  dequal@2.0.3:
    resolution: {integrity: sha512-ccc}
  react@18.3.1:
    resolution: {integrity: sha512-ddd}
  foo@1.0.0(react@18.3.1):
    resolution: {integrity: sha512-eee}
snapshots:
  swr@2.2.5:
    dependencies: {}
`,
  );
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("scanPnpm", () => {
  it("parses name@version from the packages section (ecosystem npm)", async () => {
    const swr = (await scanPnpm(dir)).find((p) => p.name === "swr");
    expect(swr).toMatchObject({ version: "2.2.5", ecosystem: "npm", direct: true, publicCoordinate: true });
  });

  it("strips peer-dependency suffixes from the package id", async () => {
    expect((await scanPnpm(dir)).find((p) => p.name === "foo")).toMatchObject({ version: "1.0.0", direct: true });
  });

  it("treats a custom-registry tarball resolution as NOT public", async () => {
    expect((await scanPnpm(dir)).find((p) => p.name === "@acme/ui")?.publicCoordinate).toBe(false);
  });

  it("treats integrity-only (default registry) as public, and marks transitives", async () => {
    const dequal = (await scanPnpm(dir)).find((p) => p.name === "dequal");
    expect(dequal).toMatchObject({ publicCoordinate: true, direct: false });
  });

  it("returns [] when there is no pnpm-lock.yaml", async () => {
    const empty = await mkdtemp(join(tmpdir(), "sage-pnpm-empty-"));
    expect(await scanPnpm(empty)).toEqual([]);
    await rm(empty, { recursive: true, force: true });
  });
});
