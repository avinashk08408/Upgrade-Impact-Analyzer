import React, { useState } from "react";

export default function CliffTableView({
  cliffReport,
  loading,
  error,
  onScan,
  onCopySnippet,
  copiedIndex
}) {
  const [expandedRow, setExpandedRow] = useState(null);

  const toggleRow = (idx) => {
    setExpandedRow(expandedRow === idx ? null : idx);
  };

  const getMechanismBadgeClass = (type) => {
    switch (type) {
      case "SLEEPING_WEB_SERVER":
        return "bg-amber-100 text-amber-900 border-amber-300";
      case "PAUSING_DATABASE":
        return "bg-red-100 text-red-900 border-red-300";
      case "SCALE_TO_ZERO_DATABASE":
        return "bg-blue-100 text-blue-900 border-blue-300";
      case "EXPIRING_SERVICE_OR_DATA":
        return "bg-purple-100 text-purple-900 border-purple-300";
      default:
        return "bg-slate-100 text-slate-800 border-slate-300";
    }
  };

  const getMigrationBadgeClass = (effort) => {
    switch (effort) {
      case "ZERO_CODE_CHANGE":
        return "bg-emerald-100 text-emerald-900 border-emerald-300";
      case "MINOR_CONFIG_CHANGE":
        return "bg-blue-100 text-blue-900 border-blue-300";
      case "CODE_OR_DIALECT_MIGRATION":
        return "bg-amber-100 text-amber-900 border-amber-300";
      default:
        return "bg-slate-100 text-slate-800 border-slate-300";
    }
  };

  const formatMigrationLabel = (effort) => {
    switch (effort) {
      case "ZERO_CODE_CHANGE":
        return "Zero Code Change (Drop-in)";
      case "MINOR_CONFIG_CHANGE":
        return "Minor Config Change";
      case "CODE_OR_DIALECT_MIGRATION":
        return "Code / Dialect Migration Required";
      default:
        return effort || "Unknown Effort";
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-lg border border-slate-200 shadow-sm text-xs">
        <div>
          <div className="font-bold text-slate-900 text-sm">
            Free-Tier Operational Boundaries & Cloud Detection
          </div>
          <div className="text-slate-500 text-xs mt-0.5">
            Identifies free hosting limitations before deployment: sleeping websites, pausing databases, scale-to-zero delays, and timeout limits. Inspects subfolders, protects credentials, and details backup and migration workflows.
          </div>
        </div>

        <button
          type="button"
          onClick={onScan}
          disabled={loading}
          className="bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2 rounded text-xs transition-colors disabled:opacity-50 whitespace-nowrap self-start md:self-auto shadow-sm"
        >
          {loading ? "Scanning Project..." : "Re-Scan Project Cloud Configs"}
        </button>
      </div>

      {/* Error Banner when scan fails */}
      {error && !loading && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded text-xs text-red-900 font-medium flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
          <div>
            <div className="font-bold mb-0.5 text-sm">Failed to scan free-tier limits: {error}</div>
            <div className="text-slate-600 font-normal">
              BreakCheck encountered an error while scanning deployment configs and manifests. Verify that the server is running and local files are accessible.
            </div>
          </div>
          <button
            type="button"
            onClick={onScan}
            className="bg-red-900 hover:bg-red-800 text-white font-semibold px-4 py-2 rounded text-xs whitespace-nowrap transition-colors self-start md:self-auto shadow-sm"
          >
            Retry Scan
          </button>
        </div>
      )}

      {/* Main Professional Data Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden text-xs">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[11px] tracking-wider">
              <th className="py-3 px-4">Service & Mechanism</th>
              <th className="py-3 px-4">Confidence & Evidence</th>
              <th className="py-3 px-4">Free Plan Disadvantage</th>
              <th className="py-3 px-4">Production Impact & Wake Behavior</th>
              <th className="py-3 px-4">Actionable Solution</th>
              <th className="py-3 px-4 text-right">Details & Protections</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500 italic">
                  Scanning repository across root and subfolders for cloud configurations, manifests, and database references...
                </td>
              </tr>
            )}

            {/* Error fallback row */}
            {error && !loading && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-red-800 bg-red-50/20">
                  <div className="max-w-md mx-auto space-y-2">
                    <div className="font-bold text-sm">Cloud Boundary Scan Error</div>
                    <div className="text-xs text-slate-600">{error}</div>
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={onScan}
                        className="bg-red-900 hover:bg-red-800 text-white font-semibold px-3 py-1.5 rounded text-xs transition-colors"
                      >
                        Retry Scan
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            )}

            {/* Empty state (only when NO error and NO findings) */}
            {!loading && !error && (!cliffReport || cliffReport.findings.length === 0) && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500">
                  No free-tier pause, sleep, or timeout limits were identified in scanned project files.
                </td>
              </tr>
            )}

            {!loading &&
              !error &&
              cliffReport &&
              cliffReport.findings.map((item, idx) => {
                const isExpanded = expandedRow === idx;
                const isConfirmed = item.isConfirmed || item.confidence === "CONFIRMED_FREE_CONFIG";
                const wake = item.rule.wakeBehavior;

                return (
                  <React.Fragment key={idx}>
                    <tr className={`hover:bg-slate-50/60 align-top transition-colors ${isExpanded ? "bg-slate-50" : ""}`}>
                      {/* Service & Mechanism */}
                      <td className="py-3.5 px-4 font-bold text-slate-900 max-w-[200px]">
                        <div className="text-sm">{item.rule.provider}</div>
                        <div className="text-[11px] font-normal text-slate-500 mb-1.5">{item.rule.service}</div>
                        <div className="space-y-1">
                          <span className="inline-block bg-slate-100 text-slate-700 border border-slate-300 px-1.5 py-0.5 rounded text-[10px] font-semibold mr-1">
                            {item.rule.plan}
                          </span>
                          {wake?.mechanismLabel && (
                            <span className={`inline-block border px-1.5 py-0.5 rounded text-[10px] font-semibold ${getMechanismBadgeClass(wake.mechanismType)}`}>
                              {wake.mechanismLabel}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Confidence & Evidence */}
                      <td className="py-3.5 px-4 text-xs max-w-[220px]">
                        <div className="mb-1.5">
                          {isConfirmed ? (
                            <span className="inline-block bg-red-100 text-red-900 border border-red-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                              Confirmed Free Config
                            </span>
                          ) : (
                            <span className="inline-block bg-amber-50 text-amber-800 border border-amber-300 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider">
                              Possible - Please Confirm
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-[11px] text-slate-900 font-semibold break-all">
                          {item.matchedEvidence.file}
                        </div>
                        <div className="font-mono text-[10px] text-slate-500 mt-0.5 truncate" title={item.matchedEvidence.matchedPattern}>
                          Pattern: {item.matchedEvidence.matchedPattern}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1 leading-tight">
                          {item.matchedEvidence.details}
                        </div>
                      </td>

                      {/* Free Plan Disadvantage */}
                      <td className="py-3.5 px-4 text-slate-800 leading-relaxed max-w-xs">
                        <span className="font-semibold text-red-900 block mb-0.5">
                          Trigger: {item.rule.timeToFailure}
                        </span>
                        <div className="text-[11px]">{item.rule.triggerCondition}</div>
                      </td>

                      {/* Production Impact & Wake Behavior */}
                      <td className="py-3.5 px-4 text-slate-800 leading-relaxed max-w-xs bg-slate-50/50">
                        <div className="text-red-950 font-medium mb-2 text-[11px]">
                          {item.rule.impactDescription}
                        </div>
                        {wake && (
                          <div className="border-t border-slate-200 pt-1.5 space-y-1 text-[10px]">
                            <div>
                              <span className="font-semibold text-slate-700">Wakes on next request: </span>
                              <span className={wake.wakesOnNextRequest ? "text-emerald-700 font-semibold" : "text-red-700 font-semibold"}>
                                {wake.wakesOnNextRequest ? "Yes (Automatic)" : "No (Manual resume required)"}
                              </span>
                            </div>
                            <div>
                              <span className="font-semibold text-slate-700">First-request delay: </span>
                              <span className="text-slate-900">{wake.firstRequestLatency}</span>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Actionable Solution */}
                      <td className="py-3.5 px-4 space-y-2 max-w-xs">
                        <div className="text-slate-800 text-[11px] leading-relaxed">
                          {item.rule.recommendedFix.summary}
                        </div>
                        <div className="text-[11px]">
                          <a
                            href={item.rule.recommendedFix.documentationUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline font-semibold"
                          >
                            Official {item.rule.provider} docs
                          </a>
                        </div>
                      </td>

                      {/* Action to Toggle Drawer */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => toggleRow(idx)}
                          className={`text-xs px-3 py-1 rounded font-semibold transition-colors ${
                            isExpanded
                              ? "bg-slate-800 text-white"
                              : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300"
                          }`}
                        >
                          {isExpanded ? "Close" : "Inspect Guides"}
                        </button>
                      </td>
                    </tr>

                    {/* Expandable Impact, Backup & Alternative Drawer */}
                    {isExpanded && (
                      <tr className="bg-slate-50/90 font-sans">
                        <td colSpan={6} className="p-5 border-b border-slate-200">
                          <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-6">

                            {/* Section 1: Detailed Wake Behavior & Failure Mechanism */}
                            {wake && (
                              <div className="bg-slate-50 border border-slate-200 rounded p-4 space-y-2">
                                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                  <div className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                                    Operational Mechanism: {wake.mechanismLabel}
                                  </div>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                                    wake.requiresManualResumption
                                      ? "bg-red-100 text-red-900 border-red-300"
                                      : "bg-emerald-100 text-emerald-900 border-emerald-300"
                                  }`}>
                                    {wake.requiresManualResumption ? "Manual Resumption Required" : "Automatic Wake-On-Request"}
                                  </span>
                                </div>
                                <p className="text-slate-700 text-xs leading-relaxed">
                                  {wake.explanation}
                                </p>
                                <div className="text-[11px] text-slate-500 italic bg-white p-2.5 rounded border border-slate-200">
                                  Notice: {wake.breakcheckDisclaimer}
                                </div>
                              </div>
                            )}

                            {/* Section 2: Automated Protections (Copyable Templates) */}
                            {item.rule.automatedProtections && item.rule.automatedProtections.length > 0 && (
                              <div>
                                <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                                  <div>
                                    <div className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                                      Automated Workflows for {item.rule.provider}
                                    </div>
                                    <div className="text-slate-500 text-[11px]">
                                      Copyable CI/CD templates. These workflows are not active until committed to your repository with secrets configured.
                                    </div>
                                  </div>
                                  <span className="bg-slate-100 text-slate-700 border border-slate-300 text-[10px] font-semibold px-2 py-0.5 rounded uppercase">
                                    Example Templates (Not Active)
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {item.rule.automatedProtections.map((prot, pIdx) => (
                                    <div key={pIdx} className="border border-slate-200 rounded p-3.5 bg-slate-50/70 space-y-2.5">
                                      <div className="flex items-center justify-between">
                                        <div className="font-bold text-slate-900 text-xs">
                                          {prot.title}
                                        </div>
                                        <span className="bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-semibold px-2 py-0.5 rounded uppercase">
                                          {prot.type.replace(/_/g, " ")}
                                        </span>
                                      </div>

                                      <div className="text-slate-600 text-[11px] leading-relaxed">
                                        {prot.description}
                                      </div>

                                      {prot.targetFilePath && (
                                        <div className="text-[11px] font-mono text-slate-700 bg-white px-2 py-1 rounded border border-slate-200">
                                          Target path: {prot.targetFilePath}
                                        </div>
                                      )}

                                      {prot.requiredConfiguration && Object.keys(prot.requiredConfiguration).length > 0 && (
                                        <div className="bg-amber-50/80 border border-amber-200 rounded p-2 text-[10px] text-amber-950 space-y-1">
                                          <div className="font-semibold uppercase tracking-wider text-[9px] text-amber-900">
                                            Required Secrets / Variables to Configure:
                                          </div>
                                          {Object.entries(prot.requiredConfiguration).map(([secKey, secDesc]) => (
                                            <div key={secKey}>
                                              <span className="font-mono font-bold text-amber-900">{secKey}</span>: {secDesc}
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                      <div className="relative">
                                        <pre className="font-mono text-[10px] bg-slate-900 text-slate-100 p-2.5 rounded overflow-x-auto max-h-48 leading-relaxed">
                                          {prot.actionableSnippet}
                                        </pre>
                                        <button
                                          type="button"
                                          onClick={() => onCopySnippet(prot.actionableSnippet, `prot-${idx}-${pIdx}`)}
                                          className="absolute top-1.5 right-1.5 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-0.5 rounded border border-slate-700 shadow-sm"
                                        >
                                          {copiedIndex === `prot-${idx}-${pIdx}` ? "Copied" : "Copy Snippet"}
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Section 3: Specific Database Backup Advice */}
                            {item.rule.backupSpecification && (
                              <div className="border border-slate-200 rounded p-4 bg-slate-50/60 space-y-3 text-xs">
                                <div className="font-bold text-slate-900 uppercase tracking-wider text-xs border-b border-slate-200 pb-2">
                                  Specific Backup Specification & Recovery Guide
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                                  <div className="bg-white p-3 rounded border border-slate-200 space-y-1">
                                    <span className="font-semibold text-emerald-900 block">What Gets Backed Up:</span>
                                    <p className="text-slate-700">{item.rule.backupSpecification.whatIsBackedUp}</p>
                                  </div>
                                  <div className="bg-white p-3 rounded border border-slate-200 space-y-1">
                                    <span className="font-semibold text-red-900 block">What is NOT Backed Up:</span>
                                    <p className="text-slate-700">{item.rule.backupSpecification.whatIsNotBackedUp}</p>
                                  </div>
                                  <div className="bg-white p-3 rounded border border-slate-200 space-y-1">
                                    <span className="font-semibold text-slate-800 block">Storage & Retention:</span>
                                    <p className="text-slate-700">Location: {item.rule.backupSpecification.storageLocation}</p>
                                    <p className="text-slate-500">Retention: {item.rule.backupSpecification.retentionPeriod}</p>
                                  </div>
                                  <div className="bg-white p-3 rounded border border-slate-200 space-y-1">
                                    <span className="font-semibold text-slate-800 block">How to Restore:</span>
                                    <p className="font-mono text-[10px] bg-slate-100 p-1.5 rounded text-slate-900 break-all">
                                      {item.rule.backupSpecification.restoreInstructions}
                                    </p>
                                  </div>
                                </div>
                                {item.rule.backupSpecification.cacheDisclaimer && (
                                  <div className="text-[11px] text-slate-600 bg-amber-50/60 p-2.5 rounded border border-amber-200">
                                    {item.rule.backupSpecification.cacheDisclaimer}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Section 4: Recommended Alternative Free Platforms */}
                            {item.rule.alternativePlatforms && item.rule.alternativePlatforms.length > 0 && (
                              <div>
                                <div className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-1">
                                  Recommended Alternative Free Platforms (Verified October 2026)
                                </div>
                                <div className="text-slate-500 text-[11px] mb-3">
                                  Evaluated against {item.rule.provider} free-tier constraints. Review migration requirements before switching:
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {item.rule.alternativePlatforms.map((alt, aIdx) => (
                                    <div key={aIdx} className="border border-emerald-200 bg-emerald-50/30 rounded p-3.5 space-y-2">
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <span className="font-bold text-emerald-950 text-xs mr-2">{alt.name}</span>
                                          <span className="text-[10px] font-normal text-slate-500">({alt.category})</span>
                                        </div>
                                        <a
                                          href={alt.officialSourceUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="text-[10px] text-emerald-800 hover:underline font-semibold"
                                        >
                                          Official Pricing
                                        </a>
                                      </div>

                                      <div className="text-[11px] font-mono text-emerald-900 font-semibold bg-emerald-100/50 px-2 py-1 rounded">
                                        Free Tier Limits: {alt.freeTierLimits}
                                      </div>

                                      <div className="text-[11px] text-slate-700 leading-relaxed">
                                        <span className="font-semibold text-slate-900">Advantage: </span>
                                        {alt.advantageOverCurrent}
                                      </div>

                                      <div className="pt-1 border-t border-emerald-100">
                                        <div className="flex items-center gap-1.5 mb-1">
                                          <span className="text-[10px] font-semibold text-slate-600">Migration:</span>
                                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getMigrationBadgeClass(alt.migrationEffort)}`}>
                                            {formatMigrationLabel(alt.migrationEffort)}
                                          </span>
                                        </div>
                                        <div className="text-[10px] text-slate-600 leading-normal">
                                          {alt.migrationDetails}
                                        </div>
                                        <div className="text-[9px] text-slate-400 mt-1">
                                          Verified against documentation: {alt.dateVerified}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
