import React from "react";

export default function ScanLimits({ scanScope }) {
  if (!scanScope) return null;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600 space-y-2">
      <div className="flex items-center justify-between font-semibold text-slate-800">
        <span>Scan Scope & Verification Limits</span>
        <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
          {scanScope.checkedVersions.base} to {scanScope.checkedVersions.target}
        </span>
      </div>

      <p className="leading-relaxed">
        {scanScope.disclaimer}
      </p>

      <div>
        <span className="font-semibold text-slate-700">What could not be statically inspected:</span>
        <ul className="list-disc list-inside mt-1 space-y-0.5 text-slate-500">
          {scanScope.uninspectedPatterns.map((pattern, idx) => (
            <li key={idx}>{pattern}</li>
          ))}
        </ul>
      </div>

      <div className="text-slate-400 pt-1 border-t border-slate-200">
        Total local project files statically inspected: {scanScope.inspectedFileCount}
      </div>
    </div>
  );
}

