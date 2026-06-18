import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanComposer } from "./composer.js";

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "sage-scan-composer-"));
  await writeFile(
    join(dir, "composer.json"),
    JSON.stringify({
      require: { php: "^8.3", "laravel/pennant": "^1.11" },
      "require-dev": { "phpunit/phpunit": "^11.0" },
      repositories: [
        { type: "vcs", url: "https://git.acme.local/acme/secret.git" },
        { type: "vcs", url: "https://github.com/acme/private-on-github.git" },
      ],
    }),
  );
  await writeFile(
    join(dir, "composer.lock"),
    JSON.stringify({
      packages: [
        {
          name: "laravel/pennant",
          version: "v1.11.0",
          source: { type: "git", url: "https://github.com/laravel/pennant.git" },
          dist: { type: "zip", url: "https://api.github.com/repos/laravel/pennant/zipball/abc" },
        },
        {
          name: "acme/secret",
          version: "1.0.0",
          source: { type: "git", url: "https://git.acme.local/acme/secret.git" },
          dist: { type: "zip", url: "https://git.acme.local/acme/secret/zip" },
        },
        {
          name: "acme/private-on-github",
          version: "2.0.0",
          source: { type: "git", url: "https://github.com/acme/private-on-github.git" },
          dist: { type: "zip", url: "https://api.github.com/repos/acme/private-on-github/zipball/x" },
        },
        {
          name: "acme/local-ui",
          version: "1.0.0",
          source: { type: "path", url: "../packages/ui" },
          dist: { type: "path", url: "../packages/ui" },
        },
      ],
      "packages-dev": [
        {
          name: "phpunit/phpunit",
          version: "11.4.0",
          source: { type: "git", url: "https://github.com/sebastianbergmann/phpunit.git" },
          dist: { type: "zip", url: "https://api.github.com/repos/sebastianbergmann/phpunit/zipball/y" },
        },
      ],
    }),
  );
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("scanComposer", () => {
  it("finds packages from both packages and packages-dev", async () => {
    const pkgs = await scanComposer(dir);
    expect(pkgs.find((p) => p.name === "laravel/pennant")?.version).toBe("v1.11.0");
    expect(pkgs.find((p) => p.name === "phpunit/phpunit")?.ecosystem).toBe("composer");
  });

  it("marks require / require-dev as direct, ignoring php + ext-* platform reqs", async () => {
    const pkgs = await scanComposer(dir);
    expect(pkgs.find((p) => p.name === "laravel/pennant")?.direct).toBe(true);
    expect(pkgs.find((p) => p.name === "phpunit/phpunit")?.direct).toBe(true);
    expect(pkgs.find((p) => p.name === "php")).toBeUndefined();
  });

  it("treats a normal Packagist (github-sourced) package as public", async () => {
    expect((await scanComposer(dir)).find((p) => p.name === "laravel/pennant")?.publicCoordinate).toBe(true);
  });

  it("treats a path package as NOT public", async () => {
    expect((await scanComposer(dir)).find((p) => p.name === "acme/local-ui")?.publicCoordinate).toBe(false);
  });

  it("treats a custom-host private vcs repo as NOT public", async () => {
    expect((await scanComposer(dir)).find((p) => p.name === "acme/secret")?.publicCoordinate).toBe(false);
  });

  it("treats a private github repo (declared in repositories) as NOT public by exact url", async () => {
    expect(
      (await scanComposer(dir)).find((p) => p.name === "acme/private-on-github")?.publicCoordinate,
    ).toBe(false);
  });

  it("does NOT mismark other github packages private just because one github repo is declared private", async () => {
    // phpunit is github-sourced and NOT declared private -> stays public
    expect((await scanComposer(dir)).find((p) => p.name === "phpunit/phpunit")?.publicCoordinate).toBe(true);
  });

  it("returns [] when there is no composer.lock", async () => {
    const empty = await mkdtemp(join(tmpdir(), "sage-scan-composer-empty-"));
    expect(await scanComposer(empty)).toEqual([]);
    await rm(empty, { recursive: true, force: true });
  });
});
