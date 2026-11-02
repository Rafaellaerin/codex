'use strict';

// These commands are currently provided by the installed Codex IDE extension.
// They are not a public API; detect their presence and fail with an actionable
// diagnostic instead of silently claiming that the webview restarted.
const REMOVE_VIEW = 'chatgpt.sidebarSecondaryView.removeView';
const OPEN_SIDEBAR = 'chatgpt.openSidebar';
const RETRY_COMMAND = 'codexWebviewRecovery.retrySidebar';

async function remountSidebar(commands) {
  const available = new Set(await commands.getCommands(true));
  const missing = [REMOVE_VIEW, OPEN_SIDEBAR].filter((command) => !available.has(command));
  if (missing.length) {
    throw new Error(
      `The installed Codex extension does not expose required command(s): ${missing.join(', ')}. ` +
        'Check that OpenAI.chatgpt is installed and enabled, then reload VS Code.',
    );
  }

  // Await removal before opening; doing this in parallel can retain the dead view.
  await commands.executeCommand(REMOVE_VIEW);
  await commands.executeCommand(OPEN_SIDEBAR);
}

function registerRecovery(vscode, context) {
  const output = vscode.window.createOutputChannel('Codex Webview Recovery');
  const subscription = vscode.commands.registerCommand(RETRY_COMMAND, async () => {
    output.appendLine('Requesting a fresh Codex sidebar view.');
    try {
      await remountSidebar(vscode.commands);
      output.appendLine('Remount requested. Renderer readiness has NOT been verified.');
      await vscode.window.showInformationMessage(
        'Codex sidebar remount requested. Check whether the interface loads; inspect Codex logs if it fails again.',
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      output.appendLine(`Recovery command failed: ${reason}`);
      output.show(true);
      await vscode.window.showErrorMessage('Codex sidebar retry failed. See the Codex Webview Recovery output.');
    }
  });
  context.subscriptions.push(subscription, output);
  return subscription;
}

function activate(context) {
  // Require VS Code only when activated, so the remount logic can be unit-tested
  // using a command registry stub without an IDE installation.
  registerRecovery(require('vscode'), context);
}

function deactivate() {}

module.exports = { activate, deactivate, remountSidebar, registerRecovery };
