// @ts-nocheck
const vscode = require('vscode');
const path = require('path');
const generate = require('./generate');

function activate(context) {
    let panel;

    const disposable = vscode.commands.registerCommand('codeeasy.generateCode', () => {
        if (!panel) {
            panel = vscode.window.createWebviewPanel(
                'codeGenerator',
                'Code Generator',
                vscode.ViewColumn.Beside, // Always open beside the editor
                {
                    enableScripts: true,
                    retainContextWhenHidden: true, // Keeps the panel open
                    localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media'))]
                }
            );

            const htmlPath = path.join(context.extensionPath, 'media', 'pannel.html');
            panel.webview.html = require('fs').readFileSync(htmlPath, 'utf8');

            panel.webview.onDidReceiveMessage(async (message) => {
                if (message.command === 'generate') {
                    let editor = vscode.window.activeTextEditor;

                    // Ensure an active editor is available
                    if (!editor) {
                        const visibleEditors = vscode.window.visibleTextEditors;
                        if (visibleEditors.length > 0) {
                            editor = visibleEditors[0];
                            await vscode.window.showTextDocument(editor.document, vscode.ViewColumn.One);
                        }
                    }

                    if (!editor) {
                        vscode.window.showErrorMessage('No active editor! Please open a file and try again.');
                        return;
                    }

                    const generatedCode = await generate.handleCodeGeneration(message.text, editor);

                    if (generatedCode) {
                        await generate.insertGeneratedCode(editor, generatedCode);
                        panel.webview.postMessage({ command: 'generated' });
                    }
                }
            });

            panel.onDidDispose(() => panel = null, null, context.subscriptions);
        } else {
            panel.reveal(vscode.ViewColumn.Beside);
        }
    });

    context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = { activate, deactivate };
