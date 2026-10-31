import React, { useState } from "react";

const SAMPLE_CLIFF_REPORT = {
  projectPath: "c:/Will this upgrade break MY code",
  filesScanned: ["package.json", ".env.example", "render.yaml"],
  findingsCount: 2,
  findings: [
    {
      rule: {
        id: "supabase-7day-pause",
        provider: "Supabase",
        service: "PostgreSQL Database",
        plan: "Free Tier",
        triggerCondition: "7 consecutive days of zero database reads, writes, or API queries.",
        timeToFailure: "After 7 days without queries",
        impactDescription:
          "The database is automatically paused. All subsequent client requests will fail with connection refused or 503 errors until the project is manually unpaused in the Supabase management console.",
        applicabilityNote:
          "Applies strictly to projects hosted on Supabase Free Tier. Does not apply to Supabase Pro ($25/mo), Team, Enterprise, or self-hosted Docker instances.",
        recommendedFix: {
          summary: "If hosting on Supabase Free Tier, add a weekly automated ping via GitHub Actions, or upgrade to Supabase Pro ($25/month) to disable automatic pausing.",
          actionableSnippet: `name: Keep Supabase Awake
on:
  schedule:
    - cron: '0 0 */3 * *' # Pings database every 3 days
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: curl -s "\${{ secrets.SUPABASE_URL }}/rest/v1/" -H "apikey: \${{ secrets.SUPABASE_ANON_KEY }}"`,
          documentationUrl: "https://supabase.com/docs/guides/platform/pausing"
        }
      },
      confidence: "CONDITIONAL_ON_FREE_TIER",
      confidenceLabel: "Conditional: Applies only if using Supabase Free Tier",
      matchedEvidence: {
        file: "package.json",
        matchedPattern: "@supabase/supabase-js",
        details: "Found dependency '@supabase/supabase-js' (^2.39.0). Applies if this project uses the free tier."
      }
    },
    {
      rule: {
        id: "render-15min-spindown",
        provider: "Render",
        service: "Web Service",
        plan: "Free Instance",
        triggerCondition: "15 minutes of zero inbound HTTP traffic.",
        timeToFailure: "After 15 minutes of inactivity",
        impactDescription:
          "The web service instance spins down to zero. The next incoming user HTTP request will trigger a cold start delay of 50+ seconds while the container reboots, causing users to perceive the website as offline.",
        applicabilityNote:
          "Applies only to Render services running on plan: free. Does not apply to Starter ($7/mo), Standard, or Pro paid instances.",
        recommendedFix: {
          summary: "If deployed on Render Free Web Service, configure an external heartbeat ping (e.g. UptimeRobot) every 10 minutes or upgrade the service to Starter.",
          actionableSnippet: "// In server health check endpoint: GET /api/health returns 200 OK every 10 minutes",
          documentationUrl: "https://render.com/docs/free#spinning-down-on-idle"
        }
      },
      confidence: "CONFIRMED_FREE_CONFIG",
      confidenceLabel: "Confirmed Free-Tier Configuration",
      matchedEvidence: {
        file: "render.yaml",
        matchedPattern: "render.yaml",
        details: "Configuration file 'render.yaml' detected in repository with plan: free."
      }
    }
  ],
  timestamp: new Date().toISOString()
};

export default function CliffScannerView() {
  const [loading, setLoading] = useState(false);
  const [cliffReport, setCliffReport] = useState(null);
  const [isSampleData, setIsSampleData] = useState(false);
  const [error, setError] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);

  const handleScan = async () => {
    // Clear previous report and errors immediately so old data cannot persist under an error
    setCliffReport(null);
    setIsSampleData(false);
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/cliff/scan");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server responded with HTTP ${res.status}`);
      }
      const data = await res.json();
      setCliffReport(data);
      setIsSampleData(false);
    } catch (err) {
      setCliffReport(null);
      setError(`Cannot scan project: ${err.message}. Ensure the development server is active, or click 'Load Sample Report' below to preview.`);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSample = () => {
    setError(null);
    setCliffReport(SAMPLE_CLIFF_REPORT);
    setIsSampleData(true);
  };

  const handleCopySnippet = (snippet, index) => {
    navigator.clipboard.writeText(snippet);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Intro Box */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 mb-1">
            Free-Tier Cliff Scanner
          </h2>
          <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
            Free cloud hosting plans contain hidden operational boundaries: databases pause after 7 days of inactivity,
            containers sleep after 15 minutes, and serverless functions abort after 10 seconds.
            This scanner inspects your repository configs, dependencies, and environment files to flag free-tier traps before deployment.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleScan}
            disabled={loading}
            className="text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {loading ? "Scanning Project..." : "Scan Repository"}
          </button>
          <button
            onClick={handleLoadSample}
            className="text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-3 py-2.5 rounded transition-colors whitespace-nowrap"
          >
            Load Sample Report
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded text-xs text-red-800 space-y-2">
          <div className="font-semibold">Scan Notice</div>
          <div className="leading-relaxed">{error}</div>
          <div>
            <button
              type="button"
              onClick={handleLoadSample}
              className="text-xs font-semibold bg-white border border-red-300 text-red-900 px-3 py-1 rounded hover:bg-red-100"
            >
              Load Sample Report Instead
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="text-center py-16 bg-white rounded-lg border border-slate-200">
          <div className="text-sm font-semibold text-slate-700 animate-pulse mb-1">
            Scanning configuration files and dependencies for free-tier boundaries...
          </div>
          <div className="text-xs text-slate-400">
            Checking Render, Supabase, Neon, Vercel, Railway, and MongoDB Atlas rules.
          </div>
        </div>
      )}

      {/* Results View */}
      {cliffReport && !loading && (
        <div className="space-y-6">
          {/* Sample Data Disclaimer Banner */}
          {isSampleData && (
            <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded text-xs text-blue-900 font-medium">
              SAMPLE DATA PREVIEW: This report displays mock demonstration data to illustrate free-tier cliffs. Click "Scan Repository" to inspect this codebase.
            </div>
          )}

          {/* Summary Banner */}
          <div className={`p-6 rounded-lg border shadow-sm ${
            cliffReport.findingsCount === 0
              ? "bg-emerald-50 border-emerald-200"
              : "bg-amber-50 border-amber-200"
          }`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                  cliffReport.findingsCount === 0
                    ? "bg-emerald-200 text-emerald-900"
                    : "bg-amber-200 text-amber-900"
                }`}>
                  {cliffReport.findingsCount === 0 ? "NO FREE-TIER CLIFFS DETECTED" : "POTENTIAL FREE-TIER CLIFFS DETECTED"}
                </span>
                <div className="text-base font-bold text-slate-900 mt-2">
                  {cliffReport.findingsCount === 0
                    ? "No free-tier sleep, pause, or timeout triggers were found in scanned files."
                    : `${cliffReport.findingsCount} service configurations in your repository are subject to automatic pause or sleep limits.`}
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs font-semibold text-slate-500 uppercase">
                  Files Inspected
                </div>
                <div className="text-xl font-bold text-slate-800">
                  {cliffReport.filesScanned.length} files
                </div>
              </div>
            </div>
          </div>

          {/* Findings Cards */}
          {cliffReport.findings.length > 0 && (
            <div className="space-y-6">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600">
                Identified Service Limitations ({cliffReport.findings.length})
              </h3>

              {cliffReport.findings.map((item, idx) => (
                <div key={idx} className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                  {/* Card Header */}
                  <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-200">
                        {item.rule.provider}
                      </span>
                      <span className="text-xs font-semibold text-slate-700">
                        {item.rule.service} ({item.rule.plan})
                      </span>
                      <span className="text-xs text-slate-400">|</span>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium border ${
                        item.confidence === "CONFIRMED_FREE_CONFIG"
                          ? "bg-red-50 text-red-800 border-red-200 font-semibold"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}>
                        {item.confidenceLabel}
                      </span>
                    </div>

                    <span className="text-xs font-mono text-slate-500">
                      Trigger: {item.rule.timeToFailure}
                    </span>
                  </div>

                  {/* Card Content */}
                  <div className="p-6 space-y-4">
                    {/* Applicability Note */}
                    <div className="text-xs bg-slate-50 p-2.5 rounded border border-slate-200 text-slate-600">
                      <span className="font-semibold text-slate-700">Hosting Scope: </span>
                      {item.rule.applicabilityNote}
                    </div>

                    {/* Trigger Condition */}
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                        When this break occurs
                      </div>
                      <div className="text-sm text-slate-800 bg-slate-50 p-3 rounded border border-slate-200">
                        {item.rule.triggerCondition}
                      </div>
                    </div>

                    {/* Impact */}
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                        What will break in production
                      </div>
                      <div className="text-sm text-red-900 bg-red-50 p-3 rounded border border-red-200">
                        {item.rule.impactDescription}
                      </div>
                    </div>

                    {/* Detection Evidence */}
                    <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-200">
                      <span className="font-semibold text-slate-700">Matched in repository: </span>
                      {item.matchedEvidence.details}
                    </div>

                    {/* Actionable Fix */}
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                        Recommended Solution
                      </div>
                      <div className="text-sm text-slate-800 mb-2">
                        {item.rule.recommendedFix.summary}
                      </div>

                      {item.rule.recommendedFix.actionableSnippet && (
                        <div className="relative">
                          <pre className="text-xs font-mono text-slate-800 bg-slate-900 text-slate-100 p-3 rounded overflow-x-auto">
                            {item.rule.recommendedFix.actionableSnippet}
                          </pre>
                          <button
                            type="button"
                            onClick={() => handleCopySnippet(item.rule.recommendedFix.actionableSnippet, idx)}
                            className="absolute top-2 right-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-1 rounded border border-slate-700"
                          >
                            {copiedIndex === idx ? "Copied" : "Copy Snippet"}
                          </button>
                        </div>
                      )}

                      <div className="mt-2 text-xs">
                        <a
                          href={item.rule.recommendedFix.documentationUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          Verify official documentation on {item.rule.provider} limits
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
