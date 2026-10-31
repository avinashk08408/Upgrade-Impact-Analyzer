import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { ManifestParser } from "../src/multilang/manifestParsers.js";
import { MultiLangUsageScanner } from "../src/multilang/usageScanner.js";
import { MultiLangRegistryClient } from "../src/multilang/registryClients.js";

describe("MultiLang Engine", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "breakcheck-multilang-test-"));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  describe("ManifestParser", () => {
    it("should parse Python dependencies from requirements.txt", async () => {
      const requirements = `
# Core HTTP and Web frameworks
requests==2.31.0
fastapi>=0.109.0
uvicorn
-r other-requirements.txt
`;
      await fs.writeFile(path.join(tempDir, "requirements.txt"), requirements, "utf-8");

      const deps = await ManifestParser.discoverAllDependencies(tempDir);
      const requestsDep = deps.find((d) => d.name === "requests");
      const fastapiDep = deps.find((d) => d.name === "fastapi");
      const uvicornDep = deps.find((d) => d.name === "uvicorn");

      expect(requestsDep).toBeDefined();
      expect(requestsDep?.currentVersion).toBe("2.31.0");
      expect(requestsDep?.ecosystem).toBe("pypi");
      expect(requestsDep?.language).toBe("Python");
      expect(requestsDep?.isRangeOnly).toBe(false);

      expect(fastapiDep).toBeDefined();
      expect(fastapiDep?.currentVersion).toBe("unknown");
      expect(fastapiDep?.requestedRange).toBe(">=0.109.0");
      expect(fastapiDep?.isRangeOnly).toBe(true);

      expect(uvicornDep).toBeDefined();
      expect(uvicornDep?.currentVersion).toBe("unknown");
      expect(uvicornDep?.isRangeOnly).toBe(true);
    });

    it("should parse Rust dependencies from Cargo.toml", async () => {
      const cargoToml = `
[package]
name = "demo-app"
version = "0.1.0"
edition = "2021"

[dependencies]
serde = "1.0.197"
tokio = { version = "1.35.1", features = ["full"] }

[dev-dependencies]
tempfile = "3.8.1"
`;
      await fs.writeFile(path.join(tempDir, "Cargo.toml"), cargoToml, "utf-8");

      const deps = await ManifestParser.discoverAllDependencies(tempDir);
      const serdeDep = deps.find((d) => d.name === "serde");
      const tokioDep = deps.find((d) => d.name === "tokio");
      const tempfileDep = deps.find((d) => d.name === "tempfile");

      expect(serdeDep).toBeDefined();
      expect(serdeDep?.currentVersion).toBe("1.0.197");
      expect(serdeDep?.ecosystem).toBe("cargo");
      expect(serdeDep?.language).toBe("Rust");

      expect(tokioDep).toBeDefined();
      expect(tokioDep?.currentVersion).toBe("1.35.1");

      expect(tempfileDep).toBeDefined();
      expect(tempfileDep?.currentVersion).toBe("3.8.1");
    });

    it("should parse Go dependencies from go.mod", async () => {
      const goMod = `
module myproject

go 1.22

require (
\tgithub.com/gin-gonic/gin v1.9.1
\tgorm.io/gorm v1.25.7
)

require github.com/joho/godotenv v1.5.1 // indirect
`;
      await fs.writeFile(path.join(tempDir, "go.mod"), goMod, "utf-8");

      const deps = await ManifestParser.discoverAllDependencies(tempDir);
      const ginDep = deps.find((d) => d.name === "github.com/gin-gonic/gin");
      const gormDep = deps.find((d) => d.name === "gorm.io/gorm");
      const dotenvDep = deps.find((d) => d.name === "github.com/joho/godotenv");

      expect(ginDep).toBeDefined();
      expect(ginDep?.currentVersion).toBe("1.9.1");
      expect(ginDep?.ecosystem).toBe("go");

      expect(gormDep).toBeDefined();
      expect(gormDep?.currentVersion).toBe("1.25.7");

      expect(dotenvDep).toBeDefined();
      expect(dotenvDep?.currentVersion).toBe("1.5.1");
    });

    it("should parse PHP dependencies from composer.json", async () => {
      const composerJson = JSON.stringify({
        require: {
          php: "^8.2",
          "guzzlehttp/guzzle": "^7.8",
          "monolog/monolog": "^3.5"
        }
      });
      await fs.writeFile(path.join(tempDir, "composer.json"), composerJson, "utf-8");

      const deps = await ManifestParser.discoverAllDependencies(tempDir);
      const guzzleDep = deps.find((d) => d.name === "guzzlehttp/guzzle");
      const monologDep = deps.find((d) => d.name === "monolog/monolog");
      const phpDep = deps.find((d) => d.name === "php");

      expect(guzzleDep).toBeDefined();
      expect(guzzleDep?.currentVersion).toBe("unknown");
      expect(guzzleDep?.requestedRange).toBe("^7.8");
      expect(guzzleDep?.isRangeOnly).toBe(true);
      expect(guzzleDep?.ecosystem).toBe("composer");

      expect(monologDep).toBeDefined();
      expect(monologDep?.currentVersion).toBe("unknown");
      expect(monologDep?.requestedRange).toBe("^3.5");
      expect(monologDep?.isRangeOnly).toBe(true);

      expect(phpDep).toBeUndefined();
    });

    it("should parse Python dependencies from pyproject.toml (PEP 621 and Poetry)", async () => {
      const pyproject = `
[project]
name = "api-service"
version = "0.1.0"
dependencies = [
    "httpx>=0.27.0",
    "pydantic==2.6.4"
]

[tool.poetry.dependencies]
flask = "^3.0.2"
`;
      await fs.writeFile(path.join(tempDir, "pyproject.toml"), pyproject, "utf-8");

      const deps = await ManifestParser.discoverAllDependencies(tempDir);
      const httpxDep = deps.find((d) => d.name === "httpx");
      const pydanticDep = deps.find((d) => d.name === "pydantic");
      const flaskDep = deps.find((d) => d.name === "flask");

      expect(httpxDep).toBeDefined();
      expect(httpxDep?.currentVersion).toBe("unknown");
      expect(httpxDep?.requestedRange).toBe(">=0.27.0");
      expect(httpxDep?.isRangeOnly).toBe(true);
      expect(httpxDep?.ecosystem).toBe("pypi");

      expect(pydanticDep).toBeDefined();
      expect(pydanticDep?.currentVersion).toBe("2.6.4");
      expect(pydanticDep?.isRangeOnly).toBe(false);

      expect(flaskDep).toBeDefined();
      expect(flaskDep?.currentVersion).toBe("unknown");
      expect(flaskDep?.requestedRange).toBe("^3.0.2");
      expect(flaskDep?.isRangeOnly).toBe(true);
    });

    it("should parse Ruby dependencies from Gemfile", async () => {
      const gemfile = `
source "https://rubygems.org"
gem "rails", "~> 7.1.3"
gem "pg", ">= 1.5.0"
gem "puma"
`;
      await fs.writeFile(path.join(tempDir, "Gemfile"), gemfile, "utf-8");

      const deps = await ManifestParser.discoverAllDependencies(tempDir);
      const railsDep = deps.find((d) => d.name === "rails");
      const pgDep = deps.find((d) => d.name === "pg");
      const pumaDep = deps.find((d) => d.name === "puma");

      expect(railsDep).toBeDefined();
      expect(railsDep?.currentVersion).toBe("unknown");
      expect(railsDep?.requestedRange).toBe("~> 7.1.3");
      expect(railsDep?.isRangeOnly).toBe(true);
      expect(railsDep?.ecosystem).toBe("rubygems");

      expect(pgDep).toBeDefined();
      expect(pgDep?.currentVersion).toBe("unknown");
      expect(pgDep?.requestedRange).toBe(">= 1.5.0");
      expect(pgDep?.isRangeOnly).toBe(true);

      expect(pumaDep).toBeDefined();
      expect(pumaDep?.currentVersion).toBe("unknown");
      expect(pumaDep?.isRangeOnly).toBe(true);
    });

    it("should resolve exact installed versions from package-lock.json", async () => {
      const packageJson = JSON.stringify({
        dependencies: {
          axios: "^1.6.0"
        }
      });
      const lockfile = JSON.stringify({
        name: "test-app",
        version: "1.0.0",
        lockfileVersion: 3,
        packages: {
          "node_modules/axios": {
            version: "1.6.8"
          }
        }
      });
      await fs.writeFile(path.join(tempDir, "package.json"), packageJson, "utf-8");
      await fs.writeFile(path.join(tempDir, "package-lock.json"), lockfile, "utf-8");

      const deps = await ManifestParser.discoverAllDependencies(tempDir);
      const axiosDep = deps.find((d) => d.name === "axios");

      expect(axiosDep).toBeDefined();
      expect(axiosDep?.currentVersion).toBe("1.6.8");
      expect(axiosDep?.requestedRange).toBe("^1.6.0");
      expect(axiosDep?.isLockfileResolved).toBe(true);
      expect(axiosDep?.isRangeOnly).toBe(false);
    });

    it("should parse peerDependencies and optionalDependencies without duplicating dependencies", async () => {
      const packageJson = JSON.stringify({
        dependencies: {
          react: "^18.2.0"
        },
        devDependencies: {
          typescript: "^5.0.0"
        },
        peerDependencies: {
          react: ">=18.0.0",
          "react-dom": ">=18.0.0"
        },
        optionalDependencies: {
          fsevents: "^2.3.2"
        }
      });
      await fs.writeFile(path.join(tempDir, "package.json"), packageJson, "utf-8");

      const deps = await ManifestParser.discoverAllDependencies(tempDir);

      const reactDeps = deps.filter((d) => d.name === "react");
      expect(reactDeps.length).toBe(1);
      expect(reactDeps[0].dependencyGroup).toBe("dependencies");

      const tsDep = deps.find((d) => d.name === "typescript");
      expect(tsDep?.dependencyGroup).toBe("devDependencies");

      const reactDomDep = deps.find((d) => d.name === "react-dom");
      expect(reactDomDep).toBeDefined();
      expect(reactDomDep?.dependencyGroup).toBe("peerDependencies");

      const fseventsDep = deps.find((d) => d.name === "fsevents");
      expect(fseventsDep).toBeDefined();
      expect(fseventsDep?.dependencyGroup).toBe("optionalDependencies");
    });

    it("should discover manifests recursively in monorepo subfolders", async () => {
      const backendDir = path.join(tempDir, "packages", "backend");
      const serviceDir = path.join(tempDir, "services", "api");
      await fs.mkdir(backendDir, { recursive: true });
      await fs.mkdir(serviceDir, { recursive: true });

      await fs.writeFile(
        path.join(backendDir, "package.json"),
        JSON.stringify({ dependencies: { express: "^4.19.2" } }),
        "utf-8"
      );

      await fs.writeFile(
        path.join(serviceDir, "requirements.txt"),
        "fastapi>=0.110.0\n",
        "utf-8"
      );

      const deps = await ManifestParser.discoverAllDependencies(tempDir);
      const expressDep = deps.find((d) => d.name === "express");
      const fastapiDep = deps.find((d) => d.name === "fastapi");

      expect(expressDep).toBeDefined();
      expect(expressDep?.manifestFile).toBe("packages/backend/package.json");
      expect(expressDep?.id).toBe("npm:packages/backend/package.json:express");
      expect(expressDep?.isRangeOnly).toBe(true);

      expect(fastapiDep).toBeDefined();
      expect(fastapiDep?.manifestFile).toBe("services/api/requirements.txt");
      expect(fastapiDep?.id).toBe("pypi:services/api/requirements.txt:fastapi");
      expect(fastapiDep?.isRangeOnly).toBe(true);
    });

    it("should resolve exact versions from pnpm-lock.yaml and yarn.lock", async () => {
      await fs.writeFile(
        path.join(tempDir, "package.json"),
        JSON.stringify({ dependencies: { lodash: "^4.17.0", react: "^18.0.0" } }),
        "utf-8"
      );

      const pnpmLock = `
lockfileVersion: '6.0'
packages:
  /lodash@4.17.21:
    resolution: {integrity: sha512-v2kDEe57lecTulaDIuNTPy3Ry4gLGJ6Z1O3vE1krgXZNrsQ+LFTGHVxVjcXPs17LhbZVGedAJv8XZ1tvj5FvSg==}
`;
      await fs.writeFile(path.join(tempDir, "pnpm-lock.yaml"), pnpmLock, "utf-8");

      const yarnLock = `
# yarn lockfile v1
react@^18.0.0:
  version "18.3.1"
  resolved "https://registry.yarnpkg.com/react/-/react-18.3.1.tgz"
`;
      await fs.writeFile(path.join(tempDir, "yarn.lock"), yarnLock, "utf-8");

      const deps = await ManifestParser.discoverAllDependencies(tempDir);
      const lodashDep = deps.find((d) => d.name === "lodash");
      const reactDep = deps.find((d) => d.name === "react");

      expect(lodashDep).toBeDefined();
      expect(lodashDep?.currentVersion).toBe("4.17.21");
      expect(lodashDep?.isLockfileResolved).toBe(true);
      expect(lodashDep?.isRangeOnly).toBe(false);

      expect(reactDep).toBeDefined();
      expect(reactDep?.currentVersion).toBe("18.3.1");
      expect(reactDep?.isLockfileResolved).toBe(true);
      expect(reactDep?.isRangeOnly).toBe(false);
    });

    it("should resolve exact versions from Pipfile.lock and Gemfile.lock", async () => {
      await fs.writeFile(
        path.join(tempDir, "Pipfile"),
        `[packages]\nrequests = "*"\n`,
        "utf-8"
      );

      const pipfileLock = JSON.stringify({
        default: {
          requests: {
            version: "==2.31.0"
          }
        }
      });
      await fs.writeFile(path.join(tempDir, "Pipfile.lock"), pipfileLock, "utf-8");

      await fs.writeFile(
        path.join(tempDir, "Gemfile"),
        `gem "rails", ">= 7.0"\n`,
        "utf-8"
      );

      const gemfileLock = `
GEM
  remote: https://rubygems.org/
  specs:
    rails (7.1.3)
      actioncable (= 7.1.3)
`;
      await fs.writeFile(path.join(tempDir, "Gemfile.lock"), gemfileLock, "utf-8");

      const deps = await ManifestParser.discoverAllDependencies(tempDir);
      const requestsDep = deps.find((d) => d.name === "requests");
      const railsDep = deps.find((d) => d.name === "rails");

      expect(requestsDep).toBeDefined();
      expect(requestsDep?.currentVersion).toBe("2.31.0");
      expect(requestsDep?.isLockfileResolved).toBe(true);

      expect(railsDep).toBeDefined();
      expect(railsDep?.currentVersion).toBe("7.1.3");
      expect(railsDep?.isLockfileResolved).toBe(true);
    });

    it("should prevent duplicate package collision by assigning unique IDs across manifests", async () => {
      await fs.writeFile(
        path.join(tempDir, "package.json"),
        JSON.stringify({ dependencies: { lodash: "^4.17.0" } }),
        "utf-8"
      );

      const subDir = path.join(tempDir, "packages", "client");
      await fs.mkdir(subDir, { recursive: true });
      await fs.writeFile(
        path.join(subDir, "package.json"),
        JSON.stringify({ dependencies: { lodash: "^4.17.21" } }),
        "utf-8"
      );

      const deps = await ManifestParser.discoverAllDependencies(tempDir);
      const lodashDeps = deps.filter((d) => d.name === "lodash");

      expect(lodashDeps.length).toBe(2);
      expect(lodashDeps[0].id).not.toBe(lodashDeps[1].id);
      expect(lodashDeps.map((d) => d.id)).toContain("npm:package.json:lodash");
      expect(lodashDeps.map((d) => d.id)).toContain("npm:packages/client/package.json:lodash");
    });

    it("should isolate lockfiles per workspace so packages do not inherit versions from sibling workspaces", async () => {
      const appADir = path.join(tempDir, "packages", "appA");
      const appBDir = path.join(tempDir, "packages", "appB");
      const appCDir = path.join(tempDir, "packages", "appC");
      await fs.mkdir(appADir, { recursive: true });
      await fs.mkdir(appBDir, { recursive: true });
      await fs.mkdir(appCDir, { recursive: true });

      await fs.writeFile(
        path.join(appADir, "package.json"),
        JSON.stringify({ dependencies: { axios: "^1.2.0" } }),
        "utf-8"
      );
      await fs.writeFile(
        path.join(appADir, "package-lock.json"),
        JSON.stringify({
          name: "appA",
          packages: {
            "node_modules/axios": { version: "1.2.4" }
          }
        }),
        "utf-8"
      );

      await fs.writeFile(
        path.join(appBDir, "package.json"),
        JSON.stringify({ dependencies: { axios: "^0.27.0" } }),
        "utf-8"
      );
      await fs.writeFile(
        path.join(appBDir, "package-lock.json"),
        JSON.stringify({
          name: "appB",
          packages: {
            "node_modules/axios": { version: "0.27.2" }
          }
        }),
        "utf-8"
      );

      await fs.writeFile(
        path.join(appCDir, "package.json"),
        JSON.stringify({ dependencies: { axios: "^1.0.0" } }),
        "utf-8"
      );

      const deps = await ManifestParser.discoverAllDependencies(tempDir);
      const appADep = deps.find((d) => d.manifestFile.startsWith("packages/appA"));
      const appBDep = deps.find((d) => d.manifestFile.startsWith("packages/appB"));
      const appCDep = deps.find((d) => d.manifestFile.startsWith("packages/appC"));

      expect(appADep?.currentVersion).toBe("1.2.4");
      expect(appADep?.isLockfileResolved).toBe(true);

      expect(appBDep?.currentVersion).toBe("0.27.2");
      expect(appBDep?.isLockfileResolved).toBe(true);

      expect(appCDep?.currentVersion).toBe("unknown");
      expect(appCDep?.isLockfileResolved).toBe(false);
      expect(appCDep?.isRangeOnly).toBe(true);
    });
  });

  describe("MultiLangUsageScanner", () => {
    it("should identify Python call sites and imports", async () => {
      const pyCode = `
import requests

def send_alert(url):
    res = requests.get(url)
    return res.json()
`;
      await fs.writeFile(path.join(tempDir, "service.py"), pyCode, "utf-8");

      const usages = await MultiLangUsageScanner.scanPackageUsages(tempDir, "requests", "pypi");
      expect(usages.length).toBeGreaterThanOrEqual(1);

      const callUsage = usages.find((u) => u.isCallExpression);
      expect(callUsage).toBeDefined();
      expect(callUsage?.identifierName).toBe("get");
      expect(callUsage?.filePath).toBe("service.py");
    });

    it("should identify Python aliased imports and directly imported functions", async () => {
      const pyCode = `
import requests as req
from fastapi import FastAPI, Depends

app = FastAPI()

def check():
    r = req.post("https://example.com")
    return r.status_code
`;
      await fs.writeFile(path.join(tempDir, "app.py"), pyCode, "utf-8");

      const reqUsages = await MultiLangUsageScanner.scanPackageUsages(tempDir, "requests", "pypi");
      const postCall = reqUsages.find((u) => u.identifierName === "post");
      expect(postCall).toBeDefined();
      expect(postCall?.isCallExpression).toBe(true);

      const fastapiUsages = await MultiLangUsageScanner.scanPackageUsages(tempDir, "fastapi", "pypi");
      const appCall = fastapiUsages.find((u) => u.identifierName === "FastAPI");
      expect(appCall).toBeDefined();
      expect(appCall?.isCallExpression).toBe(true);
    });

    it("should identify Rust use statements and function invocations", async () => {
      const rsCode = `
use serde_json::to_string;

pub fn serialize_data() {
    let payload = serde_json::to_string(&data);
}
`;
      await fs.writeFile(path.join(tempDir, "lib.rs"), rsCode, "utf-8");

      const usages = await MultiLangUsageScanner.scanPackageUsages(tempDir, "serde-json", "cargo");
      expect(usages.length).toBeGreaterThanOrEqual(1);

      const callUsage = usages.find((u) => u.isCallExpression);
      expect(callUsage).toBeDefined();
      expect(callUsage?.identifierName).toBe("to_string");
    });

    it("should identify Go package usage and function calls", async () => {
      const goCode = `
package main

import (
\t"github.com/gin-gonic/gin"
)

func main() {
\tr := gin.Default()
\tr.Run()
}
`;
      await fs.writeFile(path.join(tempDir, "main.go"), goCode, "utf-8");

      const usages = await MultiLangUsageScanner.scanPackageUsages(
        tempDir,
        "github.com/gin-gonic/gin",
        "go"
      );
      expect(usages.length).toBeGreaterThanOrEqual(1);

      const callUsage = usages.find((u) => u.isCallExpression);
      expect(callUsage).toBeDefined();
      expect(callUsage?.identifierName).toBe("Default");
    });
  });

  describe("MultiLangRegistryClient Cache Management", () => {
    it("should allow clearCache and evict without throwing", () => {
      expect(() => MultiLangRegistryClient.clearCache()).not.toThrow();
      expect(() => MultiLangRegistryClient.evict("some-pkg", "npm")).not.toThrow();
    });
  });
});

