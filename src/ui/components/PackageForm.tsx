import React from "react";

interface InstalledPackage {
  name: string;
  version: string;
}

interface PackageFormProps {
  packageName: string;
  setPackageName: (name: string) => void;
  targetVersion: string;
  setTargetVersion: (ver: string) => void;
  fromVersion: string;
  setFromVersion: (ver: string) => void;
  installedPackages: InstalledPackage[];
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function PackageForm({
  packageName,
  setPackageName,
  targetVersion,
  setTargetVersion,
  fromVersion,
  setFromVersion,
  installedPackages,
  loading,
  onSubmit
}: PackageFormProps) {
  const handleSelectPackage = (name: string) => {
    setPackageName(name);
    const found = installedPackages.find((p) => p.name === name);
    if (found && found.version) {
      setFromVersion(found.version);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 mb-8">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600 mb-4">
        Analyze Dependency Upgrade
      </h2>

      <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Package Name
          </label>
          {installedPackages.length > 0 ? (
            <select
              value={packageName}
              onChange={(e) => handleSelectPackage(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              {installedPackages.map((pkg) => (
                <option key={pkg.name} value={pkg.name}>
                  {pkg.name} (currently {pkg.version || "installed"})
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={packageName}
              onChange={(e) => setPackageName(e.target.value)}
              placeholder="e.g. axios"
              className="w-full text-sm border border-slate-300 rounded px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
              required
            />
          )}
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
            placeholder="e.g. 1.7.0"
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

