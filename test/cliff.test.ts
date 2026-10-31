import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { CliffScanner, sanitizeSecretValues } from "../src/cliff/scanner.js";

describe("CliffScanner (Free-Tier Operational Boundaries)", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cliff-test-"));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  it("should detect Supabase 7-day inactivity pause rule via package.json with conditional confidence", async () => {
    const pkgJson = {
      name: "my-app",
      dependencies: {
        "@supabase/supabase-js": "^2.39.0"
      }
    };
    await fs.writeFile(path.join(tempDir, "package.json"), JSON.stringify(pkgJson), "utf-8");

    const scanner = new CliffScanner(tempDir);
    const summary = await scanner.scan();

    expect(summary.findingsCount).toBeGreaterThanOrEqual(1);
    const supabaseFinding = summary.findings.find((f) => f.rule.id === "supabase-7day-pause");
    expect(supabaseFinding).toBeDefined();
    expect(supabaseFinding?.rule.provider).toBe("Supabase");
    expect(supabaseFinding?.confidence).toBe("CONDITIONAL_ON_FREE_TIER");
    expect(supabaseFinding?.confidenceLabel).toContain("Conditional");
    expect(supabaseFinding?.confidenceLabel).toContain("Possible - Please Confirm");
    expect(supabaseFinding?.isConfirmed).toBe(false);
    expect(supabaseFinding?.rule.applicabilityNote).toContain("Supabase Free Tier");
  });

  it("should detect Render 15-minute spin-down via render.yaml", async () => {
    await fs.writeFile(
      path.join(tempDir, "render.yaml"),
      "services:\n  - type: web\n    name: api\n    plan: free",
      "utf-8"
    );

    const scanner = new CliffScanner(tempDir);
    const summary = await scanner.scan();

    const renderFinding = summary.findings.find((f) => f.rule.id === "render-15min-spindown");
    expect(renderFinding).toBeDefined();
    expect(renderFinding?.rule.provider).toBe("Render");
    expect(renderFinding?.confidence).toBe("CONFIRMED_FREE_CONFIG");
    expect(renderFinding?.isConfirmed).toBe(true);
    expect(renderFinding?.rule.timeToFailure).toContain("15 minutes");
  });

  it("should ignore free-tier spin down if render.yaml explicitly configures a paid plan", async () => {
    await fs.writeFile(
      path.join(tempDir, "render.yaml"),
      "services:\n  - type: web\n    plan: starter\n    name: api",
      "utf-8"
    );

    const scanner = new CliffScanner(tempDir);
    const summary = await scanner.scan();

    const renderFinding = summary.findings.find((f) => f.rule.id === "render-15min-spindown");
    expect(renderFinding).toBeUndefined();
  });

  it("should not allow negative pattern in unrelated file to suppress render.yaml free plan", async () => {
    await fs.writeFile(
      path.join(tempDir, "render.yaml"),
      "services:\n  - type: web\n    plan: free\n    name: api",
      "utf-8"
    );
    // Unrelated file containing 'plan: starter'
    await fs.writeFile(
      path.join(tempDir, ".env.example"),
      "DATABASE_URL=postgres://...\n# Note: plan: starter is recommended for production",
      "utf-8"
    );

    const scanner = new CliffScanner(tempDir);
    const summary = await scanner.scan();

    const renderFinding = summary.findings.find((f) => f.rule.id === "render-15min-spindown");
    expect(renderFinding).toBeDefined();
    expect(renderFinding?.confidence).toBe("CONFIRMED_FREE_CONFIG");
    expect(renderFinding?.isConfirmed).toBe(true);
  });

  it("should scan next.config.js and detect Vercel timeout rule", async () => {
    await fs.writeFile(path.join(tempDir, "next.config.js"), "module.exports = { vercel: true };", "utf-8");

    const scanner = new CliffScanner(tempDir);
    const summary = await scanner.scan();

    const vercelFinding = summary.findings.find((f) => f.rule.id === "vercel-10s-timeout");
    expect(vercelFinding).toBeDefined();
    expect(vercelFinding?.matchedEvidence.file).toBe("next.config.js");
  });

  it("should supply alternative platforms and automated protections on detected rules", async () => {
    const pkgJson = {
      dependencies: {
        "@supabase/supabase-js": "^2.39.0"
      }
    };
    await fs.writeFile(path.join(tempDir, "package.json"), JSON.stringify(pkgJson), "utf-8");

    const scanner = new CliffScanner(tempDir);
    const summary = await scanner.scan();

    const supabaseFinding = summary.findings.find((f) => f.rule.id === "supabase-7day-pause");
    expect(supabaseFinding).toBeDefined();

    // Verify alternative platforms (e.g. Neon, Turso)
    expect(supabaseFinding?.rule.alternativePlatforms?.length).toBeGreaterThanOrEqual(1);
    const tursoAlt = supabaseFinding?.rule.alternativePlatforms?.find((a) => a.name.includes("Turso"));
    expect(tursoAlt).toBeDefined();
    expect(tursoAlt?.dateVerified).toContain("2026");
    expect(tursoAlt?.migrationEffort).toBe("CODE_OR_DIALECT_MIGRATION");

    // Verify automated protections (Keep-Alive, Automated Backup)
    expect(supabaseFinding?.rule.automatedProtections?.length).toBeGreaterThanOrEqual(2);
    const backupProt = supabaseFinding?.rule.automatedProtections?.find((p) => p.type === "AUTOMATED_BACKUP");
    expect(backupProt).toBeDefined();
    expect(backupProt?.status).toBe("COPYABLE_TEMPLATE");
    expect(backupProt?.statusNotice).toContain("Not active");
    expect(backupProt?.actionableSnippet).toContain("pg_dump");
  });

  it("should scan config files inside nested monorepo subfolders while skipping node_modules", async () => {
    // Subfolder structure: services/api/render.yaml
    const nestedDir = path.join(tempDir, "services", "api");
    await fs.mkdir(nestedDir, { recursive: true });
    await fs.writeFile(
      path.join(nestedDir, "render.yaml"),
      "services:\n  - type: web\n    name: api\n    plan: free",
      "utf-8"
    );

    // Ignored folder structure: node_modules/ignored-lib/render.yaml
    const ignoredDir = path.join(tempDir, "node_modules", "ignored-lib");
    await fs.mkdir(ignoredDir, { recursive: true });
    await fs.writeFile(
      path.join(ignoredDir, "render.yaml"),
      "services:\n  - type: web\n    plan: free",
      "utf-8"
    );

    const scanner = new CliffScanner(tempDir);
    const summary = await scanner.scan();

    const renderFinding = summary.findings.find((f) => f.rule.id === "render-15min-spindown");
    expect(renderFinding).toBeDefined();
    expect(renderFinding?.matchedEvidence.file).toBe("services/api/render.yaml");
    expect(summary.filesScanned).toContain("services/api/render.yaml");
    expect(summary.filesScanned.some((f) => f.includes("node_modules"))).toBe(false);
  });

  it("should detect dependencies declared in nested Python requirements.txt", async () => {
    const pythonDir = path.join(tempDir, "backend");
    await fs.mkdir(pythonDir, { recursive: true });
    await fs.writeFile(
      path.join(pythonDir, "requirements.txt"),
      "fastapi==0.110.0\nsupabase>=2.3.0\nuvicorn==0.28.0",
      "utf-8"
    );

    const scanner = new CliffScanner(tempDir);
    const summary = await scanner.scan();

    const supabaseFinding = summary.findings.find((f) => f.rule.id === "supabase-7day-pause");
    expect(supabaseFinding).toBeDefined();
    expect(supabaseFinding?.matchedEvidence.file).toBe("backend/requirements.txt");
    expect(supabaseFinding?.confidence).toBe("CONDITIONAL_ON_FREE_TIER");
  });

  it("should NEVER expose secret values, passwords, or JWT tokens in findings or evidence", async () => {
    const secretJwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.supersecretpayload.signaturehash12345";
    const secretDbPassword = "super_secret_production_password_xyz987!";
    const envContent = [
      `SUPABASE_URL=https://mysecretproject.supabase.co`,
      `SUPABASE_KEY=${secretJwt}`,
      `DATABASE_URL=postgres://postgres:${secretDbPassword}@db.mysecretproject.supabase.co:5432/postgres`
    ].join("\n");

    await fs.writeFile(path.join(tempDir, ".env"), envContent, "utf-8");

    const scanner = new CliffScanner(tempDir);
    const summary = await scanner.scan();

    // Serialize entire summary to JSON
    const summaryJson = JSON.stringify(summary);

    // Verify secret values are strictly absent
    expect(summaryJson).not.toContain(secretJwt);
    expect(summaryJson).not.toContain(secretDbPassword);

    // Check sanitizeSecretValues helper directly
    const sanitized = sanitizeSecretValues(`DATABASE_URL=postgres://admin:${secretDbPassword}@host:5432/db`);
    expect(sanitized).not.toContain(secretDbPassword);
    expect(sanitized).toContain("postgres://admin:***@host:5432/db");
  });

  it("should distinguish sleeping web servers, pausing databases, and scale-to-zero databases", async () => {
    // 1. Render sleeping web server
    await fs.writeFile(
      path.join(tempDir, "render.yaml"),
      "services:\n  - type: web\n    plan: free",
      "utf-8"
    );
    // 2. Supabase pausing database
    await fs.writeFile(
      path.join(tempDir, "package.json"),
      JSON.stringify({ dependencies: { "@supabase/supabase-js": "^2.0.0" } }),
      "utf-8"
    );
    // 3. Neon scale-to-zero database
    await fs.writeFile(
      path.join(tempDir, ".env"),
      "NEON_DATABASE_URL=postgres://***@ep-cool-pooler.neon.tech/neondb",
      "utf-8"
    );

    const scanner = new CliffScanner(tempDir);
    const summary = await scanner.scan();

    const renderFinding = summary.findings.find((f) => f.rule.id === "render-15min-spindown");
    const supabaseFinding = summary.findings.find((f) => f.rule.id === "supabase-7day-pause");
    const neonFinding = summary.findings.find((f) => f.rule.id === "neon-compute-suspend");

    // Render: Sleeping website server, wakes automatically on next request, first request delay 50+ seconds
    expect(renderFinding?.rule.wakeBehavior.mechanismType).toBe("SLEEPING_WEB_SERVER");
    expect(renderFinding?.rule.wakeBehavior.wakesOnNextRequest).toBe(true);
    expect(renderFinding?.rule.wakeBehavior.requiresManualResumption).toBe(false);

    // Supabase: Pausing database, does NOT wake on next request, requires manual unpause
    expect(supabaseFinding?.rule.wakeBehavior.mechanismType).toBe("PAUSING_DATABASE");
    expect(supabaseFinding?.rule.wakeBehavior.wakesOnNextRequest).toBe(false);
    expect(supabaseFinding?.rule.wakeBehavior.requiresManualResumption).toBe(true);

    // Neon: Scale to zero database, wakes automatically on next query
    expect(neonFinding?.rule.wakeBehavior.mechanismType).toBe("SCALE_TO_ZERO_DATABASE");
    expect(neonFinding?.rule.wakeBehavior.wakesOnNextRequest).toBe(true);
    expect(neonFinding?.rule.wakeBehavior.requiresManualResumption).toBe(false);
  });

  it("should provide specific backup specifications detailing what is and what is not backed up", async () => {
    await fs.writeFile(
      path.join(tempDir, "package.json"),
      JSON.stringify({ dependencies: { "@supabase/supabase-js": "^2.0.0" } }),
      "utf-8"
    );

    const scanner = new CliffScanner(tempDir);
    const summary = await scanner.scan();

    const supabaseFinding = summary.findings.find((f) => f.rule.id === "supabase-7day-pause");
    const backup = supabaseFinding?.rule.backupSpecification;

    expect(backup).toBeDefined();
    expect(backup?.whatIsBackedUp).toContain("pg_dump");
    expect(backup?.whatIsNotBackedUp).toContain("Storage");
    expect(backup?.restoreInstructions).toContain("psql");
    expect(backup?.cacheDisclaimer).toContain("disposable");
  });

  it("should throw an error on non-existent project directory to prevent masking scan failures", async () => {
    const invalidPath = path.join(tempDir, "non_existent_sub_directory_12345");
    const scanner = new CliffScanner(invalidPath);

    await expect(scanner.scan()).rejects.toThrow(/not accessible/i);
  });
});
