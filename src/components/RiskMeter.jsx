import React from "react";

export default function RiskMeter({
  score,
  totalUpstreamChanges,
  affectedUsagesCount,
  packageName,
  currentVersion,
  targetVersion
}) {
  const isNoIssues = affectedUsagesCount === 0;
  const isHighRisk = score > 50;

  const statusLabel = isNoIssues
    ? "STATUS: NO ISSUES DETECTED IN ANALYZED CALL SITES"
    : isHighRisk
    ? "STATUS: HIGH UPGRADE RISK"
    : "STATUS: MODERATE UPGRADE RISK";

  const containerBg = isNoIssues
    ? "bg-emerald-50 border-emerald-200"
    : isHighRisk
    ? "bg-red-50 border-red-200"
    : "bg-amber-50 border-amber-200";

  const badgeBg = isNoIssues
    ? "bg-emerald-200 text-emerald-900"
    : isHighRisk
    ? "bg-red-200 text-red-900"
    : "bg-amber-200 text-amber-900";

  const scoreColor = isNoIssues
    ? "text-emerald-700"
    : isHighRisk
    ? "text-red-700"
    : "text-amber-700";

  return (
    <div className={`p-6 rounded-lg border ${containerBg} shadow-sm`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded ${badgeBg}`}>
              {statusLabel}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {packageName} ({currentVersion} to {targetVersion})
            </span>
          </div>

          <div className="text-base font-bold text-slate-900 mt-1">
            {isNoIssues
              ? `We inspected the ${totalUpstreamChanges} upstream changes in ${packageName}. None of your analyzed call sites intersect with changed signatures.`
              : `${totalUpstreamChanges} upstream changes detected in ${packageName}. Exactly ${affectedUsagesCount} intersect with your analyzed code.`}
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs font-semibold text-slate-500 uppercase">
            Upgrade Risk Index
          </div>
          <div className={`text-2xl font-black ${scoreColor}`}>
            {score} / 100
          </div>
        </div>
      </div>
    </div>
  );
}
