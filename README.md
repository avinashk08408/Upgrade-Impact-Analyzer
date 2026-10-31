# Upgrade Impact Analyzer - VS Code Extension & Developer Tool

A VS Code extension and developer tool that scans your active project dependencies across multiple ecosystems to evaluate upgrade impact:
* **JavaScript / TypeScript (npm):** Full compiler-grade AST declaration diffing (`.d.ts`) to detect exact breaking API changes affecting your call sites.
* **Python, Rust, Go, PHP, Ruby:** Call-site usage location scanning to provide migration review assistance, highlighting where upgraded packages are called in your code.

---

## How It Works in VS Code

You can run Upgrade Impact Analyzer in VS Code in two different ways: as an interactive **Web Page Dashboard** or directly in the **Integrated Terminal**.

### Mode 1: Web Page Dashboard

The web page dashboard provides a visual, single-page interface with real-time filtering, expandable impact drawers, side-by-side AST comparison notes, and 1-click codemods.

* **From the VS Code UI:**
  - Click `$(shield) Upgrade Impact Analyzer` in the bottom status bar.
  - Or press `Ctrl+Shift+P` (`Cmd+Shift+P` on macOS) and run:
    ```
    Upgrade Impact Analyzer: Open Web Dashboard
    ```
  This opens the dashboard panel directly beside your editor.

* **From the Terminal (Command Line):**
  Open the VS Code terminal (`Ctrl+` `) and run:
  ```bash
  npm run ui
  ```
  *(Alternative commands: `npm run dev` or `node ./bin/breakcheck.js --ui`).*

  The local server automatically starts and listens securely on loopback (`127.0.0.1`), ensuring all project scans and analyses remain strictly local to your machine.

---

### Mode 2: Integrated Terminal UI

The terminal interface provides a keyboard-driven terminal dashboard (OpenCode style) directly inside your VS Code terminal window without opening a browser or webview.

* **From the VS Code UI:**
  - Press `Ctrl+Shift+P` (`Cmd+Shift+P` on macOS) and run:
    ```
    Upgrade Impact Analyzer: Launch in Terminal
    ```

* **From the Terminal (Command Line):**
  Open the VS Code terminal (`Ctrl+` `) and run:
  ```bash
  npm run cli
  ```
  *(Alternative command: `node ./bin/breakcheck.js`).*

  To run with live file-watching that updates analysis automatically when files change on disk:
  ```bash
  npm run watch
  ```

#### Terminal Keyboard Controls
* **Up / Down / j / k:** Navigate through the dependency list.
* **Enter:** Open impact inspection or usage review for the selected dependency.
* **/:** Real-time search/filter by package name or ecosystem (press `Enter` to lock, `Esc` to clear).
* **Esc / b:** Return from details view to list view.
* **f:** Apply verified codemod fix (with confirmation prompt and automatic backup).
* **r:** Refresh dependencies and re-query registries.
* **?:** Open keyboard help modal.
* **q / Ctrl+C:** Exit cleanly and restore terminal buffer.

---

## Core Capabilities

### Dependency Discovery & Status Evaluation
* Recursively scans project dependencies across root and monorepo workspaces (`packages/*`, `services/*`, `apps/*`), resolving exact installed versions from `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `Cargo.lock`, `composer.lock`, `poetry.lock`, `Pipfile.lock`, and `Gemfile.lock`.
* Displays a structured dependency table:
  - **Package Name** & manifest location
  - **Ecosystem / Language** (npm, PyPI, Cargo, Go, Composer, RubyGems)
  - **Installed / Requested Version** (distinguishing lockfile-resolved versions from declared ranges)
  - **Latest Available Version** queried from official registries
  - **Upgrade Status** (`Up to Date`, `Upgrade Available`, `Cannot Determine`, or `Check Failed`)

### Deep AST Diffing vs. Usage Review Assistance
* **JavaScript / TypeScript (npm) - Automated AST Breaking-Change Diffing:**
  Compares exported type declarations between your current and target package versions. Pinpoints the exact file and line, checks argument counts to avoid false positives, displays runtime hazards, and provides optional 1-click codemods with backup and undo. When 0 local usages are found, upstream declaration diffs verify whether the upstream library changed, clearly distinguishing zero call-site detections from unconditional "safe" claims.
* **Python, Rust, Go, PHP, Ruby - Call-Site Review Assistance:**
  Scans your source files for active invocations and imports of the package, providing an inventory of call sites for manual migration review. These results are designed to assist manual review against upstream release notes rather than serving as an automated breaking-change guarantee.

---

## Packaging and Publishing

This extension supports VS Code 1.100+ (native ESM extension support).

To package the extension into a `.vsix` file:
```bash
npm run package
```
*(Or `npx @vscode/vsce package`).*

Before publishing to the Visual Studio Marketplace:
1. Ensure you have registered your publisher account on the [Visual Studio Marketplace Management Portal](https://marketplace.visualstudio.com/manage).
2. If your publisher ID differs from `breakcheck`, update the `"publisher"` field in `package.json`.
3. Publish using `npx @vscode/vsce publish`.

---

## License

Licensed under the MIT License.
