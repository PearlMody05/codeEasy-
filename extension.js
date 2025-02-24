// @ts-nocheck
const vscode = require('vscode');
const path = require('path');
const generate = require('./generate');
const Parser = require("tree-sitter");
const parser = new Parser();
const Javascript = require('tree-sitter-javascript');
const C = require("tree-sitter-c");
const Python = require("tree-sitter-python");

const languageMap = {
    javascript: Javascript,
    c: C,
    python: Python,
};


function setLang(editor) {
    if (!editor) return;
    const languageId = editor.document.languageId;
    const lang = languageMap[languageId];
    if (lang) {
        parser.setLanguage(lang);
        console.log(`Language set to: ${languageId}`);
    } else {
        console.error(`Unsupported language: ${languageId}`);
    }
}

//tree create
function parseCode(editor) {
    if (!editor) return;
    const code = editor.document.getText();
    const tree = parser.parse(code);
    console.log("Syntax Tree:", tree.rootNode.toString());
}


class CodeGeneratorViewProvider {
    constructor(context) {
        this.context = context;
    }

    resolveWebviewView(webviewView) {
        this.webviewView = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.file(path.join(this.context.extensionPath, 'media'))]
        };

        const htmlPath = path.join(this.context.extensionPath, 'media', 'pannel.html');
        webviewView.webview.html = require('fs').readFileSync(htmlPath, 'utf8');

        webviewView.webview.onDidReceiveMessage(async (message) => {
            if (message.command === 'generate') {
                let editor = vscode.window.activeTextEditor;
                if (!editor) {
                    vscode.window.showErrorMessage('No active editor! Open a file first.');
                    return;
                }

                setLang(editor);
                parseCode(editor);

                const generatedCode = await generate.handleCodeGeneration(message.text, editor);
                if (generatedCode) {
                    await generate.insertGeneratedCode(editor, generatedCode);
                    webviewView.webview.postMessage({ command: 'generated' });
                }
            }
        });
    }
}


function activate(context) {
    // Register the sidebar webview provider
    const provider = new CodeGeneratorViewProvider(context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('codeGeneratorView', provider)
    );

    // Command to open the sidebar
    const openSidebarCommand = vscode.commands.registerCommand('codeeasy.openSidebar', () => {
        vscode.commands.executeCommand("workbench.view.extension.codeGeneratorSidebar");
    });

    context.subscriptions.push(openSidebarCommand);
}

function deactivate() {}

module.exports = { activate, deactivate };
