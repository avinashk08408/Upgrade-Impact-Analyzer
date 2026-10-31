import React, { useState, useEffect } from "react";
import Header from "./components/Header.jsx";
import PackageTableView from "./components/PackageTableView.jsx";

async function apiFetch(endpoint, options = {}) {
  // 1. Try relative URL first
  try {
    const res = await fetch(endpoint, options);
    if (res.ok) return res;
    if (res.status !== 404) return res;
  } catch {
    // Relative fetch failed (e.g. file:// or port mismatch)
  }

  // 2. Fallbacks for dev server / CLI server ports
  const candidateOrigins = [
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3456",
    "http://localhost:3000",
    "http://localhost:3456"
  ];

  for (const origin of candidateOrigins) {
    if (typeof window !== "undefined" && window.location.origin === origin) {
      continue;
    }
    try {
      const res = await fetch(`${origin}${endpoint}`, options);
      if (res.ok || (res.status >= 200 && res.status < 500)) return res;
    } catch {
      // Continue trying next origin
    }
  }

  throw new Error("Failed to fetch");
}

export default function App() {
  // Project and package status
  const [projectData, setProjectData] = useState({
    projectName: "",
    projectPath: "",
    languages: [],
    totalPackages: 0,
    outdatedCount: 0,
    packages: []
  });
  const [loadingPackages, setLoadingPackages] = useState(true);

  // Analysis state for packages
  const [analysisResults, setAnalysisResults] = useState({});
  const [analyzingPackage, setAnalyzingPackage] = useState(null);
  const [fixedItems, setFixedItems] = useState({});

  const [globalError, setGlobalError] = useState(null);

  const loadData = () => {
    setLoadingPackages(true);
    setGlobalError(null);

    apiFetch("/api/status")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setProjectData({
          projectName: data.projectName || "Current Project",
          projectPath: data.projectPath || "",
          languages: data.languages || ["General Repository"],
          totalPackages: data.totalPackages || 0,
          outdatedCount: data.outdatedCount || 0,
          packages: data.packages || []
        });
      })
      .catch((err) => {
        setGlobalError(err.message || "Failed to fetch");
      })
      .finally(() => setLoadingPackages(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAnalyzePackage = async (packageName, targetVersion, currentVersion, ecosystem, packageKey = packageName) => {
    setAnalyzingPackage(packageKey);
    try {
      const res = await apiFetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageName,
          targetVersion,
          fromVersion: currentVersion,
          ecosystem: ecosystem || "npm"
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const summary = await res.json();
      setAnalysisResults((prev) => ({
        ...prev,
        [packageKey]: summary,
        [packageName]: summary
      }));
    } catch (err) {
      setAnalysisResults((prev) => ({
        ...prev,
        [packageKey]: { error: err.message || "Failed to fetch", packageName },
        [packageName]: { error: err.message || "Failed to fetch", packageName }
      }));
    } finally {
      setAnalyzingPackage(null);
    }
  };

  const handleApplyFix = async (item, id) => {
    try {
      const res = await apiFetch("/api/fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item })
      });

      const result = await res.json().catch(() => ({}));
      if (res.ok && result.success) {
        setFixedItems((prev) => ({ ...prev, [id]: true }));
      } else {
        alert(`Could not apply fix: ${result.message || "Operation failed."}`);
      }
    } catch (err) {
      alert(`Fix error: ${err.message}`);
    }
  };

  const handleUndoFix = async (item, id) => {
    try {
      const res = await apiFetch("/api/undo-fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath: item.usage.filePath })
      });

      const result = await res.json().catch(() => ({}));
      if (res.ok && result.success) {
        setFixedItems((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      } else {
        alert(`Could not undo fix: ${result.message || "Backup missing."}`);
      }
    } catch (err) {
      alert(`Undo error: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900 font-sans">
      <Header />

      <main className="max-w-7xl mx-auto w-full px-6 py-6 flex-1">
        {globalError && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded text-xs text-red-900 font-medium flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
            <div>
              <div className="font-bold mb-0.5 text-sm">Failed to scan project dependencies: {globalError}</div>
              <div className="text-slate-600 font-normal">
                Could not connect to the API. If running standalone, start the server using <code className="bg-red-100/80 text-red-950 px-1 py-0.5 rounded font-mono font-semibold">npm run dev</code> or <code className="bg-red-100/80 text-red-950 px-1 py-0.5 rounded font-mono font-semibold">node ./bin/breakcheck.js --ui</code>.
              </div>
            </div>
            <button
              type="button"
              onClick={loadData}
              className="bg-red-900 hover:bg-red-800 text-white font-semibold px-4 py-2 rounded text-xs whitespace-nowrap transition-colors self-start md:self-auto shadow-sm"
            >
              Retry Connection
            </button>
          </div>
        )}

        <PackageTableView
          packages={projectData.packages}
          loadingPackages={loadingPackages}
          onAnalyzePackage={handleAnalyzePackage}
          analyzingPackage={analyzingPackage}
          analysisResults={analysisResults}
          onApplyFix={handleApplyFix}
          onUndoFix={handleUndoFix}
          fixedItems={fixedItems}
        />
      </main>

      <footer className="border-t border-slate-200 py-3 px-6 text-center text-xs text-slate-500 bg-white">
        Upgrade Impact Analyzer
      </footer>
    </div>
  );
}
