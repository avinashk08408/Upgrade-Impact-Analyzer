import React, { useState } from "react";

export default function PackageTableView({
  packages,
  loadingPackages,
  onAnalyzePackage,
  analyzingPackage,
  analysisResults,
  onApplyFix,
  onUndoFix,
  fixedItems
}) {
  const [filterOutdatedOnly, setFilterOutdatedOnly] = useState(false);
  const [filterEcosystem, setFilterEcosystem] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedPkg, setExpandedPkg] = useState(null);

  const filtered = packages.filter((pkg) => {
    if (filterOutdatedOnly && pkg.isOutdated !== true) return false;
    if (filterEcosystem !== "all" && pkg.ecosystem !== filterEcosystem) return false;
    if (searchQuery && !pkg.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const handleRowClick = (pkg) => {
    const pkgKey = pkg.id || `${pkg.manifestFile}:${pkg.name}`;
    if (expandedPkg === pkgKey) {
      setExpandedPkg(null);
    } else {
      setExpandedPkg(pkgKey);
      const existing = analysisResults[pkgKey] || analysisResults[pkg.name];
      if (!existing || existing.error) {
        onAnalyzePackage(pkg.name, pkg.latestVersion, pkg.currentVersion, pkg.ecosystem, pkgKey);
      }
    }
  };

  const getEcosystemBadgeClass = (eco) => {
    switch (eco) {
      case "pypi":
        return "bg-blue-50 text-blue-800 border-blue-200";
      case "cargo":
        return "bg-orange-50 text-orange-800 border-orange-200";
      case "go":
        return "bg-cyan-50 text-cyan-800 border-cyan-200";
      case "composer":
        return "bg-indigo-50 text-indigo-800 border-indigo-200";
      case "rubygems":
        return "bg-rose-50 text-rose-800 border-rose-200";
      case "npm":
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="space-y-4">
      {/* Table Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-lg border border-slate-200 shadow-sm text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by package name..."
            className="border border-slate-300 rounded px-3 py-1.5 w-56 text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />

          <select
            value={filterEcosystem}
            onChange={(e) => setFilterEcosystem(e.target.value)}
            className="border border-slate-300 rounded px-3 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-500 bg-white"
          >
            <option value="all">All Ecosystems</option>
            <option value="npm">npm (JavaScript / TypeScript)</option>
            <option value="pypi">PyPI (Python)</option>
            <option value="cargo">Cargo (Rust)</option>
            <option value="go">Go Modules (Golang)</option>
            <option value="composer">Composer (PHP)</option>
            <option value="rubygems">RubyGems (Ruby)</option>
          </select>

          <label className="flex items-center gap-2 text-slate-600 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={filterOutdatedOnly}
              onChange={(e) => setFilterOutdatedOnly(e.target.checked)}
              className="rounded border-slate-300 text-slate-900 focus:ring-slate-500"
            />
            <span>Show outdated only</span>
          </label>
        </div>

        <div className="text-slate-500 font-medium">
          Showing {filtered.length} of {packages.length} dependencies
        </div>
      </div>

      {/* Main Multi-Language Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden text-xs">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[11px] tracking-wider">
              <th className="py-3 px-4">Package</th>
              <th className="py-3 px-4">Ecosystem / Language</th>
              <th className="py-3 px-4">Installed / Requested Version</th>
              <th className="py-3 px-4">Latest Version</th>
              <th className="py-3 px-4">Upgrade Status</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {loadingPackages && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500 font-sans italic">
                  Discovering dependencies across Python, Rust, Go, PHP, and JavaScript files...
                </td>
              </tr>
            )}

            {!loadingPackages && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500 font-sans">
                  No packages match the selected ecosystem or filter.
                </td>
              </tr>
            )}

            {!loadingPackages &&
              filtered.map((pkg) => {
                const pkgKey = pkg.id || `${pkg.manifestFile}:${pkg.name}`;
                const isExpanded = expandedPkg === pkgKey;
                const result = analysisResults[pkgKey] || analysisResults[pkg.name];
                const isAnalyzing = analyzingPackage === pkgKey || analyzingPackage === pkg.name;

                const isRegistryError = pkg.latestVersion === "latest" && pkg.releaseDate === "Unknown";

                return (
                  <React.Fragment key={pkgKey}>
                    <tr
                      onClick={() => handleRowClick(pkg)}
                      className={`hover:bg-slate-50/80 cursor-pointer transition-colors ${
                        isExpanded ? "bg-slate-50 font-semibold" : ""
                      }`}
                    >
                      <td className="py-3.5 px-4 font-bold text-slate-900 font-sans">
                        <div>{pkg.name}</div>
                        <div className="text-[10px] font-normal text-slate-400 font-mono">from {pkg.manifestFile}</div>
                      </td>
                      <td className="py-3.5 px-4 font-sans">
                        <span className={`inline-block border px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${getEcosystemBadgeClass(pkg.ecosystem)}`}>
                          {pkg.ecosystem}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {pkg.isLockfileResolved ? (
                          <div>
                            <div className="font-semibold text-slate-900">{pkg.currentVersion}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1 py-0.2 rounded font-sans uppercase">
                                Lockfile
                              </span>
                              {pkg.requestedRange && (
                                <span className="text-[10px] text-slate-400 font-mono">req: {pkg.requestedRange}</span>
                              )}
                            </div>
                          </div>
                        ) : pkg.isRangeOnly || pkg.currentVersion === "unknown" ? (
                          <div>
                            <div className="text-amber-800 font-medium">{pkg.requestedRange || pkg.currentVersion}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-1 py-0.2 rounded font-sans uppercase">
                                Unlocked Range
                              </span>
                              <span className="text-[10px] text-slate-400 font-sans">no lockfile found</span>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="font-semibold text-slate-800">{pkg.currentVersion}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[9px] bg-slate-100 text-slate-600 border border-slate-200 px-1 py-0.2 rounded font-sans uppercase">
                                Manifest Pin
                              </span>
                              <span className="text-[10px] text-slate-400 font-sans">no lockfile</span>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-900 font-semibold">
                        {pkg.latestVersion}
                      </td>
                      <td className="py-3.5 px-4 font-sans">
                        {pkg.latestVersion === "..." ? (
                          <span className="inline-block bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded text-[11px]">
                            Checking...
                          </span>
                        ) : isRegistryError ? (
                          <div>
                            <span className="inline-block bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded text-[11px] font-semibold">
                              Check Failed
                            </span>
                            <div className="text-[10px] text-slate-400 mt-0.5">registry unreachable</div>
                          </div>
                        ) : pkg.isOutdated === null ? (
                          <div>
                            <span className="inline-block bg-slate-100 text-slate-600 border border-slate-300 px-2 py-0.5 rounded text-[11px]">
                              Cannot Determine
                            </span>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {pkg.currentVersion === "unknown" ? "no lockfile or pin" : "unknown version"}
                            </div>
                          </div>
                        ) : pkg.isOutdated ? (
                          <div>
                            <span className="inline-block bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded text-[11px] font-semibold">
                              Upgrade Available
                            </span>
                            {pkg.upgradeRelation === "in_range" ? (
                              <div className="text-[10px] text-emerald-700 font-sans mt-0.5 font-medium">
                                Fits declared range ({pkg.requestedRange})
                              </div>
                            ) : pkg.upgradeRelation === "out_of_range" ? (
                              <div className="text-[10px] text-amber-700 font-sans mt-0.5 font-medium">
                                Requires manifest update (outside {pkg.requestedRange})
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div>
                            <span className="inline-block bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-[11px]">
                              Up to Date
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-sans">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(pkg);
                          }}
                          className={`text-xs px-3 py-1 rounded font-semibold transition-colors ${
                            isExpanded
                              ? "bg-slate-800 text-white"
                              : result?.error
                              ? "bg-red-50 hover:bg-red-100 text-red-700 border border-red-300"
                              : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300"
                          }`}
                        >
                          {isAnalyzing ? "Scanning..." : isExpanded ? "Close" : result?.error ? "Error (Retry)" : "Check Impact"}
                        </button>
                      </td>
                    </tr>

                    {/* Expandable Impact Details Drawer */}
                    {isExpanded && (
                      <tr className="bg-slate-50/60 font-sans">
                        <td colSpan={6} className="p-4 border-b border-slate-200">
                          {isAnalyzing && (
                            <div className="py-6 text-center text-slate-500 text-xs italic">
                              Analyzing usages and API changes for {pkg.name} ({pkg.currentVersion} to {pkg.latestVersion}) in your source files...
                            </div>
                          )}

                          {!isAnalyzing && result && (
                            result.error ? (
                              <div className="bg-red-50 border border-red-200 rounded-lg p-5 space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-red-100 pb-3">
                                  <div>
                                    <div className="font-bold text-red-900 text-sm">
                                      Could not analyze upgrade impact for {pkg.name}
                                    </div>
                                    <div className="text-red-700 text-xs mt-0.5 font-mono">
                                      {result.error}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onAnalyzePackage(pkg.name, pkg.latestVersion, pkg.currentVersion, pkg.ecosystem, pkgKey);
                                    }}
                                    className="bg-red-900 hover:bg-red-800 text-white font-semibold px-3 py-1.5 rounded text-xs transition-colors self-start sm:self-auto shadow-sm"
                                  >
                                    Retry Analysis
                                  </button>
                                </div>
                                <div className="text-slate-600 text-[11px] leading-relaxed">
                                  Possible causes: The local server or remote package registry is unreachable, network connection was interrupted, or package declarations could not be retrieved. Ensure the server is active and the registry is accessible.
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-4 bg-white p-5 rounded-lg border border-slate-200 shadow-sm text-xs">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                  <div>
                                    <div className="font-bold text-slate-900 text-sm">
                                      Impact Summary for {pkg.name} ({result.currentVersion} to {result.targetVersion})
                                    </div>
                                    <div className="text-slate-500 text-xs mt-0.5">
                                      {result.analysisType === "CALL_SITE_INVENTORY"
                                        ? `Call-site inventory: ${result.affectedUsagesCount} active invocation(s) found across your ${pkg.language} files.`
                                        : `Total upstream changes: ${result.totalUpstreamChanges} | Usages in your code affecting you: ${result.affectedUsagesCount}`}
                                    </div>
                                  </div>

                                  <span className={`px-2.5 py-1 rounded font-bold text-xs uppercase tracking-wider ${
                                    result.analysisType === "CALL_SITE_INVENTORY"
                                      ? result.affectedUsagesCount === 0
                                        ? "bg-slate-100 text-slate-700 border border-slate-300"
                                        : "bg-blue-50 text-blue-800 border border-blue-200"
                                      : result.affectedUsagesCount === 0
                                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                      : "bg-red-50 text-red-800 border border-red-200"
                                  }`}>
                                    {result.analysisType === "CALL_SITE_INVENTORY"
                                      ? result.affectedUsagesCount === 0
                                        ? "No Usages Detected in Scanned Code"
                                        : `${result.affectedUsagesCount} Call Site(s) for Manual Review`
                                      : result.affectedUsagesCount === 0
                                      ? "No Broken Call Sites Detected"
                                      : `${result.affectedUsagesCount} Call Site(s) Affected`}
                                  </span>
                                </div>

                              {result.scanScope?.disclaimer && (
                                <div className="bg-slate-100 p-2.5 rounded border border-slate-200 text-slate-700 text-[11px] leading-relaxed">
                                  <span className="font-semibold block text-slate-900">Analysis Methodology:</span>
                                  {result.scanScope.disclaimer}
                                </div>
                              )}

                              {/* Honest status summaries distinguishing automated AST diffing vs call-site inventory */}
                              {result.analysisType === "CALL_SITE_INVENTORY" ? (
                                result.affectedUsagesCount === 0 ? (
                                  <div className="text-slate-600 bg-slate-50 p-3 rounded border border-slate-200 leading-relaxed">
                                    <span className="font-semibold block text-slate-800">Call-site inventory note:</span>
                                    No explicit imports or invocations of <span className="font-mono font-semibold">{pkg.name}</span> were detected in scanned files.
                                    Important: This does not guarantee upgrade safety. Dynamic calls, reflection, or indirect dependencies are not checked. Review the official release notes for {result.targetVersion} before upgrading.
                                  </div>
                                ) : (
                                  <div className="text-slate-600 bg-blue-50/50 p-3 rounded border border-blue-200 leading-relaxed">
                                    <span className="font-semibold block text-blue-900">Manual review inventory:</span>
                                    Found {result.affectedUsagesCount} explicit invocation(s) in your {pkg.language} files. Deep AST declaration diffing is supported for TypeScript/npm; for {pkg.ecosystem.toUpperCase()}, review each call site below against the official {pkg.name}@{result.targetVersion} release notes before upgrading.
                                  </div>
                                )
                              ) : (
                                result.affectedUsagesCount === 0 ? (
                                  <div className="text-slate-600 bg-emerald-50/50 p-3 rounded border border-emerald-200 leading-relaxed">
                                    <span className="font-semibold block text-emerald-900">AST verification note:</span>
                                    None of the explicit call sites in your scanned files conflict with the new version's type definitions.
                                    Notice: Static type diffing does not guarantee 100% upgrade safety; dynamic calls, runtime behavioral changes, and polyfills are not verified.
                                  </div>
                                ) : (
                                  <div className="text-slate-600 bg-red-50/50 p-3 rounded border border-red-200 leading-relaxed">
                                    <span className="font-semibold block text-red-900">Breaking changes detected:</span>
                                    The upstream package changed signatures or removed exports that your code directly calls. Upgrading without updating the lines below may cause compiler errors or runtime failures.
                                  </div>
                                )
                              )}

                              {result.items && result.items.map((item, idx) => {
                                const fixKey = `${pkgKey}-${idx}`;
                                const isFixed = !!fixedItems[fixKey];
                                const isAudit = item.breakingChange.category === "USAGE_AUDIT";

                                return (
                                  <div key={idx} className="border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-50/50">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                                          {item.usage.filePath}:{item.usage.line}
                                        </span>
                                        <span className={isAudit ? "text-blue-800 font-semibold" : "text-red-700 font-semibold"}>
                                          [{item.breakingChange.severity}] {item.breakingChange.category.replace(/_/g, " ")}: {item.breakingChange.symbolName}
                                        </span>
                                      </div>

                                      <div>
                                        {isFixed ? (
                                          <div className="flex items-center gap-2">
                                            <span className="bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded text-[11px]">
                                              Fixed On Disk
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() => onUndoFix(item, fixKey)}
                                              className="text-slate-600 hover:text-slate-900 underline text-[11px]"
                                            >
                                              Undo
                                            </button>
                                          </div>
                                        ) : (
                                          item.remediation?.isAutoFixable !== false && (
                                            <button
                                              type="button"
                                              onClick={() => onApplyFix(item, fixKey)}
                                              className="bg-slate-900 hover:bg-slate-800 text-white font-semibold px-3 py-1 rounded text-xs transition-colors"
                                            >
                                              Apply Fix to Line {item.usage.line}
                                            </button>
                                          )
                                        )}
                                      </div>
                                    </div>

                                    <div className={`${isAudit ? "bg-blue-50 border-blue-200 text-blue-950" : "bg-red-50 border-red-200 text-red-950"} p-2.5 rounded border text-xs leading-relaxed`}>
                                      <span className={`font-bold ${isAudit ? "text-blue-900" : "text-red-900"} block mb-0.5`}>
                                        {isAudit ? "Migration risk to check before upgrading:" : "What happens if you upgrade without fixing:"}
                                      </span>
                                      {item.runtimeRisk}
                                    </div>

                                    <div className="text-slate-600 text-xs">
                                      <span className="font-semibold text-slate-800">{isAudit ? "Inventory note: " : "Why upstream made this change: "}</span>
                                      {item.upstreamRationale}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                                      <div className="bg-white p-2.5 rounded border border-slate-200">
                                        <span className="text-slate-500 font-semibold text-[11px] block mb-1">
                                          Your Current Code (Line {item.usage.line}):
                                        </span>
                                        <pre className="font-mono text-xs text-red-700 whitespace-pre-wrap break-all">
                                          {item.remediation.beforeCode}
                                        </pre>
                                      </div>

                                      <div className="bg-white p-2.5 rounded border border-slate-200">
                                        <span className="text-slate-500 font-semibold text-[11px] block mb-1">
                                          Remediation:
                                        </span>
                                        <pre className="font-mono text-xs text-emerald-700 whitespace-pre-wrap break-all">
                                          {item.remediation.afterCode}
                                        </pre>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
