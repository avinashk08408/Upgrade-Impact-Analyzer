import React from "react";
import type { ImpactReportItem } from "../../types.js";
import { DiffViewer } from "./DiffViewer.js";

interface ImpactCardProps {
  item: ImpactReportItem;
  isFixed: boolean;
  onApplyFix: () => void;
}

export function ImpactCard({ item, isFixed, onApplyFix }: ImpactCardProps) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold bg-red-100 text-red-800 px-2 py-0.5 rounded border border-red-200">
            {item.breakingChange.severity}
          </span>
          <span className="text-xs font-semibold text-slate-700">
            {item.breakingChange.category.replace(/_/g, " ")}
          </span>
          <span className="text-xs text-slate-400">|</span>
          <span className="text-xs font-mono text-slate-600">
            {item.usage.filePath}:{item.usage.line}
          </span>
        </div>

        {isFixed ? (
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
            FIX APPLIED TO FILE
          </span>
        ) : (
          <button
            onClick={onApplyFix}
            className="text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white px-3 py-1 rounded transition-colors"
          >
            Apply 1-Click Fix
          </button>
        )}
      </div>

      {/* Body */}
      <div className="p-6 space-y-4">
        {/* Upstream Rationale */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
            Why the library author made this change
          </div>
          <div className="text-sm text-slate-800 leading-relaxed bg-slate-50 p-3 rounded border border-slate-200">
            {item.upstreamRationale}
          </div>
        </div>

        {/* Runtime Risk */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
            What happens if you upgrade without fixing
          </div>
          <div className="text-sm text-red-900 bg-red-50 p-3 rounded border border-red-200">
            {item.runtimeRisk}
          </div>
        </div>

        {/* Diff Comparison */}
        <DiffViewer
          beforeCode={item.remediation.beforeCode}
          afterCode={item.remediation.afterCode}
          line={item.usage.line}
        />

        {/* Why Fix Works */}
        <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-200">
          <span className="font-semibold text-slate-700">Why this fix works: </span>
          {item.remediation.explanation}
        </div>
      </div>
    </div>
  );
}

