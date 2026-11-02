'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { remountSidebar, registerRecovery } = require('./extension');

const REMOVE_VIEW = 'chatgpt.sidebarSecondaryView.removeView';
const OPEN_SIDEBAR = 'chatgpt.openSidebar';

function commandRegistry(available = [REMOVE_VIEW, OPEN_SIDEBAR], failOn) {
  const calls = [];
  return {
    calls,
    async getCommands(includeInternal) {
      assert.equal(includeInternal, true);
      return available;
    },
    async executeCommand(command) {
      calls.push(command);
      if (command === failOn) throw new Error(`failed: ${command}`);
    },
  };
}

test('remount removes the retained webview before reopening it', async () => {
  const commands = commandRegistry();
  await remountSidebar(commands);
  assert.deepEqual(commands.calls, [REMOVE_VIEW, OPEN_SIDEBAR]);
});

test('missing internal Codex commands cause a diagnostic without mutation', async () => {
  const commands = commandRegistry([OPEN_SIDEBAR]);
  await assert.rejects(remountSidebar(commands), /does not expose required command.*removeView/);
  assert.deepEqual(commands.calls, []);
});

test('a failed removal does not open another view', async () => {
  const commands = commandRegistry(undefined, REMOVE_VIEW);
  await assert.rejects(remountSidebar(commands), /failed:.*removeView/);
  assert.deepEqual(commands.calls, [REMOVE_VIEW]);
});

test('opening errors are surfaced to the caller', async () => {
  const commands = commandRegistry(undefined, OPEN_SIDEBAR);
  await assert.rejects(remountSidebar(commands), /failed:.*openSidebar/);
  assert.deepEqual(commands.calls, [REMOVE_VIEW, OPEN_SIDEBAR]);
});

test('registration reports command success as a request, not verified renderer readiness', async () => {
  const messages = [];
  const lines = [];
  const commands = commandRegistry();
  const subscriptions = [];
  const vscode = {
    commands: {
      ...commands,
      registerCommand(name, handler) {
        assert.equal(name, 'codexWebviewRecovery.retrySidebar');
        this.handler = handler;
        return { dispose() {} };
      },
    },
    window: {
      createOutputChannel() {
        return { appendLine: (line) => lines.push(line), show() {}, dispose() {} };
      },
      async showInformationMessage(message) { messages.push(message); },
      async showErrorMessage(message) { messages.push(message); },
    },
  };
  registerRecovery(vscode, { subscriptions });
  assert.equal(subscriptions.length, 2);
  await vscode.commands.handler();
  assert.equal(commands.calls.length, 2);
  assert.match(lines.at(-1), /NOT been verified/);
  assert.match(messages.at(-1), /remount requested/);
});

test('registration provides an error and logs when recovery fails', async () => {
  const messages = [];
  const lines = [];
  let outputShown = false;
  const commands = commandRegistry([OPEN_SIDEBAR]);
  const vscode = {
    commands: {
      ...commands,
      registerCommand(_name, handler) {
        this.handler = handler;
        return { dispose() {} };
      },
    },
    window: {
      createOutputChannel() {
        return { appendLine: (line) => lines.push(line), show() { outputShown = true; }, dispose() {} };
      },
      async showInformationMessage(message) { messages.push(message); },
      async showErrorMessage(message) { messages.push(message); },
    },
  };
  registerRecovery(vscode, { subscriptions: [] });
  await vscode.commands.handler();
  assert.equal(outputShown, true);
  assert.match(lines.at(-1), /does not expose required command/);
  assert.match(messages.at(-1), /retry failed/);
});
