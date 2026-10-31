import React, { useState } from "react";
import DiffViewer from "./DiffViewer.jsx";

export default function ImpactCard({ item, isFixed, onApplyFix, onUndoFix, onInspectInEditor }) {
  const [showEvidence, setShowEvidence] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const isAutoFixable = item.remediation?.isAutoFixable !== false &&
    item.remediation?.beforeCode !== item.remediation?.afterCode;

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

        <div className="flex items-center gap-2">
          {onInspectInEditor && (
            <button
              type="button"
              onClick={() => onInspectInEditor(item)}
              className="text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded transition-colors"
            >
              Inspect in Code Editor
            </button>
          )}

          {isFixed ? (
            <>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                FIX APPLIED (BACKUP SAVED)
              </span>
              <button
                onClick={onUndoFix}
                className="text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 px-2.5 py-1 rounded transition-colors"
              >
                Undo Fix
              </button>
            </>
          ) : isAutoFixable ? (
            confirming ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-600">Confirm file rewrite?</span>
                <button
                  onClick={() => {
                    setConfirming(false);
                    onApplyFix();
                  }}
                  className="text-xs font-semibold bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded transition-colors"
                >
                  Yes, Rewrite
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  className="text-xs text-slate-600 hover:text-slate-900 px-2 py-1"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirming(true)}
                className="text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white px-3 py-1 rounded transition-colors"
              >
                Review & Apply Fix
              </button>
            )
          ) : (
            <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
              Manual Migration Required
            </span>
          )}
        </div>
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

        {/* Diff Comparison or Guidance */}
        {isAutoFixable ? (
          <DiffViewer
            beforeCode={item.remediation.beforeCode}
            afterCode={item.remediation.afterCode}
            line={item.usage.line}
          />
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs text-slate-700">
            <span className="font-semibold block mb-1">Current Code (Line {item.usage.line}):</span>
            <pre className="font-mono bg-white p-2 rounded border border-slate-200 mb-2">
              {item.usage.sourceSnippet}
            </pre>
            <span className="text-slate-500">
              Notice: Automatic file modification is disabled for this issue because replacement requires application-specific refactoring.
            </span>
          </div>
        )}

        {/* Why Fix Works */}
        <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-200">
          <span className="font-semibold text-slate-700">Remediation Guidance: </span>
          {item.remediation.explanation}
        </div>

        {/* Verifiable Evidence Sources */}
        {item.evidence && item.evidence.length > 0 && (
          <div className="pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowEvidence(!showEvidence)}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
            >
              <span>{showEvidence ? "Hide verification sources" : "View verification sources and notes"}</span>
            </button>

            {showEvidence && (
              <div className="mt-2 space-y-1.5 text-xs bg-slate-50 p-3 rounded border border-slate-200">
                {item.evidence.map((ev, i) => (
                  <div key={i} className="flex flex-col">
                    <span className="font-semibold text-slate-700">{ev.title}</span>
                    {ev.notes && <span className="text-slate-500 font-mono text-[11px]">{ev.notes}</span>}
                    {ev.url && (
                      <a
                        href={ev.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline text-[11px]"
                      >
                        {ev.url}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
