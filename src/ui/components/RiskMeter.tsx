import React from "react";

interface RiskMeterProps {
  score: number;
  totalUpstreamChanges: number;
  affectedUsagesCount: number;
  packageName: string;
  currentVersion: string;
  targetVersion: string;
}

export function RiskMeter({
  score,
  totalUpstreamChanges,
  affectedUsagesCount,
  packageName,
  currentVersion,
  targetVersion
}: RiskMeterProps) {
  const isSafe = affectedUsagesCount === 0;
  const isHighRisk = score > 50;

  const statusLabel = isSafe
    ? "STATUS: SAFE TO UPGRADE"
    : isHighRisk
    ? "STATUS: HIGH RISK"
    : "STATUS: MODERATE RISK";

  const containerBg = isSafe
    ? "bg-emerald-50 border-emerald-200"
    : isHighRisk
    ? "bg-red-50 border-red-200"
    : "bg-amber-50 border-amber-200";

  const badgeBg = isSafe
    ? "bg-emerald-200 text-emerald-900"
    : isHighRisk
    ? "bg-red-200 text-red-900"
    : "bg-amber-200 text-amber-900";

  const scoreColor = isSafe
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
            {isSafe
              ? `All ${totalUpstreamChanges} upstream changes are safe. None affect your code.`
              : `${totalUpstreamChanges} total changes in ${packageName}, but only ${affectedUsagesCount} affect your code.`}
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

