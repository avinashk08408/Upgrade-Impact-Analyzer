import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { Readable } from "node:stream";
import type http from "node:http";
import { validateExtractedFilePath } from "../src/utils/registry.js";
import { readBody, isAllowedOrigin, handleApiRequest } from "../src/server/apiHandler.js";

describe("Security Hardening & Validation", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "breakcheck-security-test-"));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  describe("validateExtractedFilePath", () => {
    it("should allow valid files within the package directory", async () => {
      const packageDir = path.join(tempDir, "pkg");
      await fs.mkdir(packageDir, { recursive: true });
      const dtsPath = path.join(packageDir, "index.d.ts");
      await fs.writeFile(dtsPath, "export declare const version: string;", "utf-8");

      const validated = await validateExtractedFilePath(packageDir, "index.d.ts");
      expect(validated).toBe(await fs.realpath(dtsPath));
    });

    it("should reject directory traversal paths attempting escape outside package dir", async () => {
      const packageDir = path.join(tempDir, "pkg");
      await fs.mkdir(packageDir, { recursive: true });

      await expect(
        validateExtractedFilePath(packageDir, "../../sensitive-config.json")
      ).rejects.toThrow("Security validation failed");
    });

    it("should reject symlinks that point outside the package directory", async () => {
      const packageDir = path.join(tempDir, "pkg");
      const outsideDir = path.join(tempDir, "outside");
      await fs.mkdir(packageDir, { recursive: true });
      await fs.mkdir(outsideDir, { recursive: true });

      const outsideFile = path.join(outsideDir, "secret.d.ts");
      await fs.writeFile(outsideFile, "export declare const secret: string;", "utf-8");

      const symlinkPath = path.join(packageDir, "escape.d.ts");
      try {
        await fs.symlink(outsideFile, symlinkPath, "file");
      } catch {
        // Windows unprivileged symlink fallback (junction or skip)
        return;
      }

      await expect(
        validateExtractedFilePath(packageDir, "escape.d.ts")
      ).rejects.toThrow("Security validation failed");
    });
  });

  describe("readBody Payload Limits", () => {
    it("should accept payloads within the size limit", async () => {
      const smallContent = JSON.stringify({ message: "hello" });
      const stream = Readable.from([Buffer.from(smallContent)]) as unknown as http.IncomingMessage;

      const body = await readBody(stream, 1024 * 1024);
      expect(body).toBe(smallContent);
    });

    it("should reject payloads exceeding the 1MB limit with HTTP 413 error", async () => {
      const largeChunk = Buffer.alloc(500 * 1024, "a");
      const stream = new Readable({
        read() {
          this.push(largeChunk);
          this.push(largeChunk);
          this.push(largeChunk); // Exceeds 1MB
          this.push(null);
        }
      }) as unknown as http.IncomingMessage;

      (stream as any).destroy = () => {};

      await expect(readBody(stream, 1024 * 1024)).rejects.toMatchObject({
        statusCode: 413,
        message: expect.stringContaining("Payload Too Large")
      });
    });
  });

  describe("Local Server Origin & CSRF Protection", () => {
    it("should allow loopback localhost and 127.0.0.1 origins", () => {
      const reqLocalhost = {
        headers: {
          origin: "http://localhost:3000"
        }
      } as unknown as http.IncomingMessage;

      const req127 = {
        headers: {
          origin: "http://127.0.0.1:3456"
        }
      } as unknown as http.IncomingMessage;

      expect(isAllowedOrigin(reqLocalhost)).toBe(true);
      expect(isAllowedOrigin(req127)).toBe(true);
    });

    it("should reject foreign cross-origin requests", () => {
      const reqEvil = {
        headers: {
          origin: "http://evil.com"
        }
      } as unknown as http.IncomingMessage;

      const reqCrossSite = {
        headers: {
          origin: "http://localhost:3000",
          "sec-fetch-site": "cross-site"
        }
      } as unknown as http.IncomingMessage;

      expect(isAllowedOrigin(reqEvil)).toBe(false);
      expect(isAllowedOrigin(reqCrossSite)).toBe(false);
    });

    it("should block cross-origin requests to /api/fix with HTTP 403", async () => {
      const req = {
        method: "POST",
        url: "/api/fix",
        headers: {
          origin: "https://malicious-website.com",
          "content-type": "application/json"
        }
      } as unknown as http.IncomingMessage;

      let responseCode = 0;
      let responseBody = "";

      const res = {
        set statusCode(code: number) {
          responseCode = code;
        },
        setHeader() {},
        end(data: string) {
          responseBody = data;
        }
      } as unknown as http.ServerResponse;

      const handled = await handleApiRequest(req, res, tempDir);
      expect(handled).toBe(true);
      expect(responseCode).toBe(403);
      expect(JSON.parse(responseBody).error).toContain("Cross-origin");
    });

    it("should reject non-JSON Content-Type to /api/fix with HTTP 415", async () => {
      const req = {
        method: "POST",
        url: "/api/fix",
        headers: {
          origin: "http://localhost:3456",
          "content-type": "text/plain"
        }
      } as unknown as http.IncomingMessage;

      let responseCode = 0;
      let responseBody = "";

      const res = {
        set statusCode(code: number) {
          responseCode = code;
        },
        setHeader() {},
        end(data: string) {
          responseBody = data;
        }
      } as unknown as http.ServerResponse;

      const handled = await handleApiRequest(req, res, tempDir);
      expect(handled).toBe(true);
      expect(responseCode).toBe(415);
      expect(JSON.parse(responseBody).error).toContain("Unsupported Media Type");
    });
  });
});

