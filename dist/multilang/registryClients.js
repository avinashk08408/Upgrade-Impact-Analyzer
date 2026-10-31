import pacote from "pacote";
const metadataCache = new Map();
export class MultiLangRegistryClient {
    static clearCache() {
        metadataCache.clear();
    }
    static evict(name, ecosystem) {
        metadataCache.delete(`${ecosystem}:${name}`);
    }
    static async getPackageMetadata(name, ecosystem) {
        const cacheKey = `${ecosystem}:${name}`;
        if (metadataCache.has(cacheKey)) {
            return metadataCache.get(cacheKey);
        }
        let result = { latestVersion: "latest", releaseDate: "Unknown" };
        let fetchSuccessful = false;
        try {
            switch (ecosystem) {
                case "npm":
                    result = await this.fetchNpmMetadata(name);
                    fetchSuccessful = true;
                    break;
                case "pypi":
                    result = await this.fetchPyPiMetadata(name);
                    fetchSuccessful = true;
                    break;
                case "cargo":
                    result = await this.fetchCargoMetadata(name);
                    fetchSuccessful = true;
                    break;
                case "go":
                    result = await this.fetchGoMetadata(name);
                    fetchSuccessful = true;
                    break;
                case "composer":
                    result = await this.fetchComposerMetadata(name);
                    fetchSuccessful = true;
                    break;
                case "rubygems":
                    result = await this.fetchRubyGemsMetadata(name);
                    fetchSuccessful = true;
                    break;
            }
        }
        catch {
            // Graceful fallback on network error
            fetchSuccessful = false;
        }
        // Only cache successful lookups so network errors or missing entries can be retried
        if (fetchSuccessful && result.latestVersion !== "latest" && result.latestVersion !== "unknown") {
            metadataCache.set(cacheKey, result);
        }
        return result;
    }
    static async fetchNpmMetadata(name) {
        const packument = await pacote.packument(name);
        const latestVersion = packument["dist-tags"]?.latest || "latest";
        const packumentAny = packument;
        const releaseTimeRaw = packumentAny.time?.[latestVersion] || packumentAny.time?.modified || "";
        let releaseDate = "Unknown";
        if (releaseTimeRaw) {
            const d = new Date(releaseTimeRaw);
            releaseDate = d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
        }
        return { latestVersion, releaseDate };
    }
    static async fetchPyPiMetadata(name) {
        const res = await fetch(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`, {
            headers: { Accept: "application/json" }
        });
        if (!res.ok)
            throw new Error("PyPI 404");
        const data = await res.json();
        const latestVersion = data.info?.version || "latest";
        const releases = data.releases?.[latestVersion];
        let releaseDate = "Unknown";
        if (releases && releases.length > 0 && releases[0].upload_time) {
            const d = new Date(releases[0].upload_time);
            releaseDate = d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
        }
        return { latestVersion, releaseDate };
    }
    static async fetchCargoMetadata(name) {
        const res = await fetch(`https://crates.io/api/v1/crates/${encodeURIComponent(name)}`, {
            headers: { "User-Agent": "breakcheck-inspector (https://github.com/breakcheck)" }
        });
        if (!res.ok)
            throw new Error("Crates.io 404");
        const data = await res.json();
        const latestVersion = data.crate?.max_version || data.crate?.newest_version || "latest";
        const updatedAt = data.crate?.updated_at;
        let releaseDate = "Unknown";
        if (updatedAt) {
            const d = new Date(updatedAt);
            releaseDate = d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
        }
        return { latestVersion, releaseDate };
    }
    static async fetchGoMetadata(name) {
        // Go module proxy: proxy.golang.org/<module-escaped>/@latest
        const escaped = name
            .replace(/[A-Z]/g, (m) => `!${m.toLowerCase()}`);
        const res = await fetch(`https://proxy.golang.org/${escaped}/@latest`);
        if (!res.ok)
            throw new Error("Go Proxy 404");
        const data = await res.json();
        const latestVersion = (data.Version || "latest").replace(/^v/, "");
        let releaseDate = "Unknown";
        if (data.Time) {
            const d = new Date(data.Time);
            releaseDate = d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
        }
        return { latestVersion, releaseDate };
    }
    static async fetchComposerMetadata(name) {
        const res = await fetch(`https://repo.packagist.org/p2/${name}.json`);
        if (!res.ok)
            throw new Error("Packagist 404");
        const data = await res.json();
        const packages = data.packages?.[name];
        if (packages && packages.length > 0) {
            const latestObj = packages[0];
            const latestVersion = (latestObj.version_normalized || latestObj.version || "latest").replace(/^v/, "");
            let releaseDate = "Unknown";
            if (latestObj.time) {
                const d = new Date(latestObj.time);
                releaseDate = d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
            }
            return { latestVersion, releaseDate };
        }
        return { latestVersion: "latest", releaseDate: "Unknown" };
    }
    static async fetchRubyGemsMetadata(name) {
        const res = await fetch(`https://rubygems.org/api/v1/gems/${encodeURIComponent(name)}.json`, {
            headers: { Accept: "application/json" }
        });
        if (!res.ok)
            throw new Error("RubyGems 404");
        const data = await res.json();
        const latestVersion = data.version || "latest";
        let releaseDate = "Unknown";
        if (data.version_created_at) {
            const d = new Date(data.version_created_at);
            releaseDate = d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
        }
        return { latestVersion, releaseDate };
    }
}
//# sourceMappingURL=registryClients.js.map