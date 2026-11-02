# Codex sidebar recovery (experimental helper)

A small **optional** VS Code extension that provides the Command Palette action
**Codex: Retry Sidebar (Remount)** for Codex IDE extension startup failures.

This targets a recoverability problem reported in
[openai/codex#56691](https://github.com/openai/codex/issues/56691):
the `OpenAI.chatgpt` sidebar can end at **“Codex could not start”**, often after a
30-second `renderer_ready_timeout` with `receivedWebviewMessage=false`.

## Scope and limitations

- **Not a fix for the underlying resource-loading regression.** The Codex
  extension webview and `CodexWebviewProvider` source are not in this repo.
- Calls two commands exposed by some installed versions of `OpenAI.chatgpt`,
  **sequentially**: `chatgpt.sidebarSecondaryView.removeView` and
  `chatgpt.openSidebar`. These are internal commands and may change or disappear.
- Does not clear cache, credentials, conversations, SQLite data, or `CODEX_HOME`.
- Does not change the renderer readiness timeout. A recovered view can still
  time out if the original conditions persist.
- A successful command invocation is **not** evidence that the renderer loaded.

## Run locally

1. Install and enable the official Codex IDE extension (`OpenAI.chatgpt`).
2. Run `code --extensionDevelopmentPath=PATH_TO_THIS_FOLDER` to open
   a VS Code extension-development host, or package this folder
   as a private VSIX using `npx @vscode/vsce package --no-dependencies` when
   the package tool is available. Do not publish it as an official Codex fix.
3. In the VS Code window running the helper, open the Command Palette and run
   **Codex: Retry Sidebar (Remount)** when the Codex sidebar is stuck.
4. If retry fails, inspect **Output > Codex Webview Recovery**, **Output > Codex**,
   and **Developer: Open Webview Developer Tools**. Avoid posting unredacted logs.

## Verify the helper

```bash
node --test extension.test.js
```

The tests use a stubbed VS Code command registry. They verify ordering, error
handling, and the absence of any claim that a view is ready; they are **not**
a VS Code integration test.

## Root-cause work remaining in the official extension

Reports in #56691, [#34103](https://github.com/openai/codex/issues/34103),
and [#58398](https://github.com/openai/codex/issues/58398) identify thousands
of JS module-preload requests (3,203 in inspected builds) and service-worker
resource failures in certain environments. The upstream webview build should
investigate bounding or removing **non-CSS** module preload hints while
preserving CSS loading and dynamic-import behavior. The provider should also
expose startup-stage diagnostics and a native retry action rather than a
terminal error page. This helper provides only user-initiated recovery until
those changes can be made in the extension's own source tree.
