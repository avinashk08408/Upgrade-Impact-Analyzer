import { describe, it, expect } from "vitest";
import { parseSemver, compareSemver, isVersionOutdated, checkUpgradeRangeRelation } from "../src/server/apiHandler.js";

describe("Semver Precedence & Outdated Engine", () => {
  describe("parseSemver", () => {
    it("should parse standard semantic versions", () => {
      const v = parseSemver("1.2.3");
      expect(v).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: []
      });
    });

    it("should parse prerelease identifiers", () => {
      const v = parseSemver("2.0.0-alpha.1");
      expect(v).toEqual({
        major: 2,
        minor: 0,
        patch: 0,
        prerelease: ["alpha", 1]
      });
    });

    it("should return null for unknown, latest, and range operators", () => {
      expect(parseSemver("unknown")).toBeNull();
      expect(parseSemver("latest")).toBeNull();
      expect(parseSemver("^1.2.0")).toBeNull();
      expect(parseSemver("~2.0.0")).toBeNull();
      expect(parseSemver("")).toBeNull();
    });
  });

  describe("compareSemver", () => {
    it("should compare standard major, minor, and patch versions", () => {
      expect(compareSemver("1.0.0", "2.0.0")).toBe(-1);
      expect(compareSemver("2.0.0", "1.0.0")).toBe(1);
      expect(compareSemver("1.2.0", "1.3.0")).toBe(-1);
      expect(compareSemver("1.2.3", "1.2.4")).toBe(-1);
      expect(compareSemver("1.2.3", "1.2.3")).toBe(0);
    });

    it("should correctly handle prereleases (prerelease is lower precedence than release)", () => {
      // 1.0.0-alpha.1 < 1.0.0
      expect(compareSemver("1.0.0-alpha.1", "1.0.0")).toBe(-1);
      expect(compareSemver("1.0.0", "1.0.0-alpha.1")).toBe(1);

      // 1.0.0-alpha < 1.0.0-alpha.1 < 1.0.0-beta.1 < 1.0.0-rc.1 < 1.0.0
      expect(compareSemver("1.0.0-alpha", "1.0.0-alpha.1")).toBe(-1);
      expect(compareSemver("1.0.0-alpha.1", "1.0.0-beta.1")).toBe(-1);
      expect(compareSemver("1.0.0-beta.1", "1.0.0-beta.2")).toBe(-1);
      expect(compareSemver("1.0.0-beta.2", "1.0.0-rc.1")).toBe(-1);
      expect(compareSemver("1.0.0-rc.1", "1.0.0")).toBe(-1);
    });

    it("should return null if either version cannot be parsed", () => {
      expect(compareSemver("unknown", "1.0.0")).toBeNull();
      expect(compareSemver("1.0.0", "latest")).toBeNull();
      expect(compareSemver("^1.0.0", "2.0.0")).toBeNull();
    });
  });

  describe("isVersionOutdated", () => {
    it("should return true when latest is higher than current", () => {
      expect(isVersionOutdated("1.0.0", "2.0.0")).toBe(true);
      expect(isVersionOutdated("1.2.0", "1.3.0")).toBe(true);
      expect(isVersionOutdated("1.2.3", "1.2.4")).toBe(true);
    });

    it("should return true when current is a prerelease and latest is the stable release", () => {
      expect(isVersionOutdated("1.0.0-alpha.1", "1.0.0")).toBe(true);
      expect(isVersionOutdated("2.0.0-rc.2", "2.0.0")).toBe(true);
    });

    it("should return false when current is up to date or newer", () => {
      expect(isVersionOutdated("1.0.0", "1.0.0")).toBe(false);
      expect(isVersionOutdated("2.0.0", "1.0.0")).toBe(false);
      expect(isVersionOutdated("1.0.0", "1.0.0-alpha.1")).toBe(false);
    });

    it("should return null when versions are unknown or unlocked ranges", () => {
      expect(isVersionOutdated("unknown", "1.0.0")).toBeNull();
      expect(isVersionOutdated("1.0.0", "unknown")).toBeNull();
      expect(isVersionOutdated("latest", "1.0.0")).toBeNull();
      expect(isVersionOutdated("1.0.0", "latest")).toBeNull();
      expect(isVersionOutdated("^1.0.0", "2.0.0")).toBeNull();
    });
  });

  describe("checkUpgradeRangeRelation", () => {
    it("should recognize in-range minor/patch upgrades for caret ranges", () => {
      expect(checkUpgradeRangeRelation("1.2.0", "1.5.0", "^1.2.0")).toBe("in_range");
      expect(checkUpgradeRangeRelation("1.2.0", "1.2.1", "^1.2.0")).toBe("in_range");
      expect(checkUpgradeRangeRelation("0.2.0", "0.2.8", "^0.2.0")).toBe("in_range");
    });

    it("should recognize out-of-range upgrades requiring manifest updates", () => {
      // Major bump outside caret range
      expect(checkUpgradeRangeRelation("1.2.0", "2.0.0", "^1.2.0")).toBe("out_of_range");
      // Minor bump outside zero-major caret range (^0.2.0 only allows 0.2.x)
      expect(checkUpgradeRangeRelation("0.2.0", "0.3.0", "^0.2.0")).toBe("out_of_range");
      // Minor bump outside tilde range (~1.2.0 only allows 1.2.x)
      expect(checkUpgradeRangeRelation("1.2.0", "1.3.0", "~1.2.0")).toBe("out_of_range");
      // Exact pin
      expect(checkUpgradeRangeRelation("1.2.0", "1.2.1", "1.2.0")).toBe("out_of_range");
      expect(checkUpgradeRangeRelation("1.2.0", "1.2.1", "==1.2.0")).toBe("out_of_range");
    });

    it("should return unknown for wildcard or unparseable ranges", () => {
      expect(checkUpgradeRangeRelation("1.0.0", "2.0.0", "*")).toBe("unknown");
      expect(checkUpgradeRangeRelation("1.0.0", "2.0.0", "latest")).toBe("unknown");
      expect(checkUpgradeRangeRelation("unknown", "2.0.0", undefined)).toBe("unknown");
    });
  });
});

