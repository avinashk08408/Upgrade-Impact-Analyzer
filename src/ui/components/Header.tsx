import React from "react";

export function Header() {
  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div>
          <div className="text-xl font-bold tracking-tight text-slate-900">
            BREAKCHECK
          </div>
          <div className="text-xs text-slate-500 font-medium">
            React Dependency Upgrade Impact Analyzer
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded border border-slate-300">
            REACT DASHBOARD
          </span>
        </div>
      </div>
    </header>
  );
}

