import React from "react";

export default function DiffViewer({ beforeCode, afterCode, line }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
        Code Comparison (Before vs. After)
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Before */}
        <div className="bg-red-50/60 border border-red-200 rounded p-3">
          <div className="text-xs font-semibold text-red-700 mb-1">
            Current Code (Line {line})
          </div>
          <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap break-all bg-white p-2.5 rounded border border-red-100">
            {beforeCode}
          </pre>
        </div>

        {/* After */}
        <div className="bg-emerald-50/60 border border-emerald-200 rounded p-3">
          <div className="text-xs font-semibold text-emerald-700 mb-1">
            Recommended Fix
          </div>
          <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap break-all bg-white p-2.5 rounded border border-emerald-100">
            {afterCode}
          </pre>
        </div>
      </div>
    </div>
  );
}

