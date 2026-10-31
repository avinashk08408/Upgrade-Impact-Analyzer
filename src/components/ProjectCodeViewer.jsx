import React, { useState, useEffect, useRef } from "react";

export default function ProjectCodeViewer({
  initialFilePath,
  highlightLine,
  activeIssue,
  isFixed,
  onApplyFix,
  onUndoFix
}) {
  const [fileList, setFileList] = useState([]);
  const [selectedFile, setSelectedFile] = useState(initialFilePath || "");
  const [fileContent, setFileContent] = useState("");
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [error, setError] = useState(null);

  const highlightedLineRef = useRef(null);

  // 1. Fetch project file list
  useEffect(() => {
    setLoadingFiles(true);
    fetch("/api/files")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load file list");
        return res.json();
      })
      .then((data) => {
        if (data.files && data.files.length > 0) {
          setFileList(data.files);
          if (!selectedFile) {
            // Default to initialFilePath if provided, otherwise first file
            const initial = initialFilePath && data.files.includes(initialFilePath)
              ? initialFilePath
              : data.files[0];
            setSelectedFile(initial);
          }
        }
      })
      .catch((err) => {
        setError(`Unable to load project files: ${err.message}`);
      })
      .finally(() => setLoadingFiles(false));
  }, []);

  // Update selected file if initialFilePath prop changes
  useEffect(() => {
    if (initialFilePath) {
      setSelectedFile(initialFilePath);
    }
  }, [initialFilePath]);

  // 2. Fetch content of selected file
  useEffect(() => {
    if (!selectedFile) return;

    setLoadingContent(true);
    setError(null);

    fetch(`/api/file?path=${encodeURIComponent(selectedFile)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setFileContent(data.content || "");
      })
      .catch((err) => {
        setError(`Could not read '${selectedFile}': ${err.message}`);
        setFileContent("");
      })
      .finally(() => setLoadingContent(false));
  }, [selectedFile, isFixed]);

  // 3. Scroll to highlighted line when content loads
  useEffect(() => {
    if (highlightLine && highlightedLineRef.current) {
      highlightedLineRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [fileContent, highlightLine]);

  const filteredFiles = fileList.filter((f) =>
    f.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const lines = fileContent ? fileContent.split("\n") : [];

  return (
    <div className="bg-slate-950 text-slate-100 rounded-lg border border-slate-800 shadow-xl overflow-hidden flex flex-col h-[750px]">
      {/* Top Window Bar (IDE Style) */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-300">CODE EDITOR VIEW</span>
          <span className="text-slate-600">|</span>
          <span className="font-mono text-slate-400">
            {selectedFile || "No file selected"} {highlightLine ? `(Line ${highlightLine})` : ""}
          </span>
        </div>

        {highlightLine && activeIssue && (
          <span className="text-[11px] font-semibold bg-red-950 text-red-300 border border-red-800 px-2 py-0.5 rounded">
            TARGETED ISSUE AT LINE {highlightLine}
          </span>
        )}
      </div>

      {/* Main Split Layout: File Tree on left, Code on right */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar: File Explorer */}
        <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col text-xs select-none">
          <div className="p-3 border-b border-slate-800">
            <div className="font-semibold uppercase tracking-wider text-slate-400 text-[11px] mb-2">
              Project Explorer
            </div>
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter files..."
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-slate-500"
            />
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-0.5 font-mono text-[11px]">
            {loadingFiles && (
              <div className="p-2 text-slate-500 italic">Loading project files...</div>
            )}

            {!loadingFiles && filteredFiles.length === 0 && (
              <div className="p-2 text-slate-600">No matching files found.</div>
            )}

            {filteredFiles.map((file) => {
              const isCurrent = file === selectedFile;
              const hasIssueInThisFile = activeIssue && activeIssue.usage.filePath.endsWith(file);

              return (
                <button
                  key={file}
                  type="button"
                  onClick={() => setSelectedFile(file)}
                  className={`w-full text-left px-2 py-1.5 rounded transition-colors flex items-center justify-between ${
                    isCurrent
                      ? "bg-slate-800 text-white font-semibold"
                      : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                  }`}
                >
                  <span className="truncate">{file}</span>
                  {hasIssueInThisFile && (
                    <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" title="Contains targeted breaking change" />
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Right Editor Area */}
        <main className="flex-1 flex flex-col bg-slate-900 overflow-hidden">
          {/* File Tabs Bar */}
          <div className="bg-slate-950 border-b border-slate-800 px-2 flex items-center gap-1 overflow-x-auto text-xs">
            {selectedFile && (
              <div className="bg-slate-900 text-slate-200 px-3 py-1.5 border-t-2 border-blue-500 border-x border-slate-800 font-mono text-[11px] flex items-center gap-2">
                <span>{selectedFile.split("/").pop()}</span>
              </div>
            )}
          </div>

          {/* Editor Body */}
          <div className="flex-1 overflow-y-auto font-mono text-xs leading-relaxed">
            {error && (
              <div className="m-6 p-4 bg-red-950/80 border border-red-800 rounded text-red-300 text-xs">
                <div className="font-semibold mb-1">Editor File Access Error</div>
                <div>{error}</div>
              </div>
            )}

            {loadingContent && (
              <div className="p-6 text-slate-500 italic">Reading source file...</div>
            )}

            {!loadingContent && !error && lines.length === 0 && (
              <div className="p-6 text-slate-600 italic">Select a file from the explorer to view code.</div>
            )}

            {!loadingContent && !error && lines.length > 0 && (
              <div className="py-2">
                {lines.map((lineText, idx) => {
                  const lineNum = idx + 1;
                  const isTargetLine = highlightLine && lineNum === highlightLine &&
                    (activeIssue ? activeIssue.usage.filePath.endsWith(selectedFile) : true);

                  return (
                    <React.Fragment key={lineNum}>
                      <div
                        ref={isTargetLine ? highlightedLineRef : null}
                        className={`flex items-start px-4 py-0.5 transition-colors ${
                          isTargetLine
                            ? "bg-red-950/70 border-l-4 border-red-500 text-red-100"
                            : "hover:bg-slate-800/40 text-slate-300"
                        }`}
                      >
                        {/* Line number gutter */}
                        <span className={`w-12 flex-shrink-0 text-right pr-4 select-none font-mono text-[11px] ${
                          isTargetLine ? "text-red-400 font-bold" : "text-slate-600"
                        }`}>
                          {lineNum}
                        </span>

                        {/* Code line content */}
                        <pre className="flex-1 whitespace-pre-wrap break-all font-mono text-xs">
                          {lineText || " "}
                        </pre>
                      </div>

                      {/* Antigravity-Style In-Editor Diagnostic Banner right beneath the affected line */}
                      {isTargetLine && activeIssue && (
                        <div className="my-2 mx-12 bg-slate-950 border border-red-800/80 rounded-lg p-4 shadow-lg text-xs space-y-3">
                          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="bg-red-900 text-red-200 px-2 py-0.5 rounded font-bold text-[10px]">
                                {activeIssue.breakingChange.severity}
                              </span>
                              <span className="font-semibold text-slate-200">
                                {activeIssue.breakingChange.category.replace(/_/g, " ")}: {activeIssue.breakingChange.symbolName}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {isFixed ? (
                                <>
                                  <span className="text-emerald-400 text-[11px] font-semibold bg-emerald-950 border border-emerald-800 px-2 py-0.5 rounded">
                                    FIX APPLIED
                                  </span>
                                  {onUndoFix && (
                                    <button
                                      type="button"
                                      onClick={onUndoFix}
                                      className="text-slate-300 hover:text-white bg-slate-800 border border-slate-700 px-2 py-0.5 rounded text-[11px]"
                                    >
                                      Undo Fix
                                    </button>
                                  )}
                                </>
                              ) : (
                                activeIssue.remediation?.isAutoFixable !== false && onApplyFix && (
                                  <button
                                    type="button"
                                    onClick={onApplyFix}
                                    className="bg-red-600 hover:bg-red-700 text-white font-semibold px-3 py-1 rounded text-[11px] transition-colors"
                                  >
                                    Apply Fix to Line {lineNum}
                                  </button>
                                )
                              )}
                            </div>
                          </div>

                          <div className="text-slate-300 leading-relaxed text-[11px]">
                            <span className="text-slate-400 font-semibold block mb-0.5">Upstream Author Rationale:</span>
                            {activeIssue.upstreamRationale}
                          </div>

                          <div className="text-red-300 leading-relaxed text-[11px] bg-red-950/40 p-2 rounded border border-red-900">
                            <span className="text-red-400 font-semibold block mb-0.5">Runtime Hazard:</span>
                            {activeIssue.runtimeRisk}
                          </div>

                          {activeIssue.remediation && activeIssue.remediation.isAutoFixable !== false && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                              <div className="bg-slate-900 p-2 rounded border border-slate-800">
                                <span className="text-red-400 font-semibold block mb-1">Current Call:</span>
                                <pre className="text-slate-300 whitespace-pre-wrap">{activeIssue.remediation.beforeCode}</pre>
                              </div>
                              <div className="bg-slate-900 p-2 rounded border border-slate-800">
                                <span className="text-emerald-400 font-semibold block mb-1">Proposed Fix:</span>
                                <pre className="text-slate-300 whitespace-pre-wrap">{activeIssue.remediation.afterCode}</pre>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

