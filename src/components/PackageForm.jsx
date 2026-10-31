import React from "react";

export default function PackageForm({
  packageName,
  setPackageName,
  targetVersion,
  setTargetVersion,
  fromVersion,
  setFromVersion,
  installedPackages,
  loading,
  onSubmit
}) {
  const handleSelectPackageSuggestion = (pkg) => {
    setPackageName(pkg.name);
    if (pkg.version) {
      setFromVersion(pkg.version);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 mb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600">
          Analyze Dependency Upgrade
        </h2>

        {installedPackages && installedPackages.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-400">Quick select from project:</span>
            {installedPackages.slice(0, 5).map((pkg) => (
              <button
                key={pkg.name}
                type="button"
                onClick={() => handleSelectPackageSuggestion(pkg)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded border border-slate-200 transition-colors font-mono text-[11px]"
              >
                {pkg.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Package Name (any npm package)
          </label>
          <input
            type="text"
            list="installed-packages-list"
            value={packageName}
            onChange={(e) => setPackageName(e.target.value)}
            placeholder="e.g. axios, lodash, express"
            className="w-full text-sm border border-slate-300 rounded px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
            required
          />
          <datalist id="installed-packages-list">
            {installedPackages.map((pkg) => (
              <option key={pkg.name} value={pkg.name}>
                {pkg.name} (v{pkg.version || "installed"})
              </option>
            ))}
          </datalist>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Current Version (Optional)
          </label>
          <input
            type="text"
            value={fromVersion}
            onChange={(e) => setFromVersion(e.target.value)}
            placeholder="Auto-detect from node_modules"
            className="w-full text-sm border border-slate-300 rounded px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Target Upgrade Version
          </label>
          <input
            type="text"
            value={targetVersion}
            onChange={(e) => setTargetVersion(e.target.value)}
            placeholder="e.g. 1.7.0 or latest"
            className="w-full text-sm border border-slate-300 rounded px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
            required
          />
        </div>

        <div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm px-4 py-2 rounded transition-colors disabled:opacity-50"
          >
            {loading ? "Scanning..." : "Check Impact"}
          </button>
        </div>
      </form>
    </div>
  );
}
