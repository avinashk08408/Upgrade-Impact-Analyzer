import vscode from "vscode";

let serverInstance = null;

export function activate(context) {
  // 1. Status Bar Item in VS Code: Clicking launches the web dashboard directly
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = "breakcheck.openDashboard";
  statusBarItem.text = "$(shield) Upgrade Impact Analyzer";
  statusBarItem.tooltip = "Open Upgrade Impact Analyzer Dashboard";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // 2. Command: Open Webview Panel inside VS Code (Primary Action)
  const openDashboardCommand = vscode.commands.registerCommand("breakcheck.openDashboard", async () => {
    const { startWebServer } = await import("./dist/server/index.js");
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage("Upgrade Impact Analyzer: Open a project folder in VS Code first.");
      return;
    }

    const projectPath = workspaceFolders[0].uri.fsPath;
    const port = 3456;

    if (!serverInstance) {
      try {
        serverInstance = startWebServer({
          port,
          projectPath,
          autoOpen: false
        });
      } catch {
        // Server may already be active on port
      }
    }

    const panel = vscode.window.createWebviewPanel(
      "breakcheckDashboard",
      "Upgrade Impact Analyzer",
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    panel.webview.html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src http://127.0.0.1:* http://localhost:*; script-src 'unsafe-inline' http://127.0.0.1:*; style-src 'unsafe-inline';">
        <style>
          body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; }
          .top-bar { height: 34px; background: #1e293b; display: flex; align-items: center; justify-content: space-between; padding: 0 12px; font-size: 11px; border-bottom: 1px solid #334155; }
          .top-bar a { color: #38bdf8; text-decoration: none; font-weight: 600; }
          .top-bar a:hover { text-decoration: underline; }
          iframe { width: 100%; height: calc(100% - 34px); border: none; }
        </style>
      </head>
      <body>
        <div class="top-bar">
          <span>Upgrade Impact Analyzer (Port ${port})</span>
        </div>
        <iframe src="http://127.0.0.1:${port}" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
      </body>
      </html>
    `;
  });

  // 3. Command: Run in an Integrated Terminal
  const runTerminalCommand = vscode.commands.registerCommand("breakcheck.runInTerminal", () => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const projectPath = workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0].uri.fsPath : process.cwd();
    const cliScript = context.asAbsolutePath("bin/breakcheck.js");

    const terminal = vscode.window.createTerminal({
      name: "Upgrade Impact Analyzer",
      cwd: projectPath
    });
    terminal.show(true);
    terminal.sendText(`node "${cliScript}" -p "${projectPath}"`);
  });

  context.subscriptions.push(openDashboardCommand, runTerminalCommand);
}

export function deactivate() {
  if (serverInstance) {
    serverInstance.close();
    serverInstance = null;
  }
}

