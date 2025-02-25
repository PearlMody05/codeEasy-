// @ts-nocheck
const vscode = require('vscode');
const path = require('path');
const generate = require('./generate');
//const Parser = require("tree-sitter");
// const parser = new Parser();
// const Javascript = require('tree-sitter-javascript');
// const C = require("tree-sitter-c");
// const Python = require("tree-sitter-python");
const fs = require("fs");
const geminis = require('./GeminiService')
// const languageMap = {
//     javascript: Javascript,
//     c: C,
//     python: Python,
// };


// function setLang(editor) {
//     if (!editor) return;
//     const languageId = editor.document.languageId;
//     const lang = languageMap[languageId];
//     if (lang) {
//         parser.setLanguage(lang);
//         console.log(`Language set to: ${languageId}`);
//     } else {
//         console.error(`Unsupported language: ${languageId}`);
//     }
// }

// //tree create
// function parseCode(editor) {
//     if (!editor) return;
//     const code = editor.document.getText();
//     const tree = parser.parse(code);
//     console.log("Syntax Tree:", tree.rootNode.toString());
// }


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

                //setLang(editor);
                //parseCode(editor);

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

    //command to edit code based on selection
    const editCode = vscode.commands.registerCommand('codeeasy.editCode', async () => {
        console.log("edit");
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage("No active editor");
            return;
        }
    
        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);
    
        if (!selectedText) {
            vscode.window.showWarningMessage("No text selected");
            return;
        }
    
        const userPrompt = await vscode.window.showInputBox({
            placeHolder: "Prompt what you want to edit",
            prompt: "Describe how you want to edit the selected code",
        });
    
        if (!userPrompt) {
            vscode.window.showWarningMessage("No prompt provided");
            return;
        }
        
        // Create and configure the webview panel
        const panel = vscode.window.createWebviewPanel(
            "editCodePanel",
            "Edit Code",
            vscode.ViewColumn.Beside,
            { enableScripts: true }
        );
    
        const htmlPath = path.join(context.extensionPath, "editor", "editpanel.html");
        panel.webview.html = fs.readFileSync(htmlPath, "utf8");
    
        
        panel.webview.onDidReceiveMessage(async (message) => {
            if (message.command === "ready") {
                try {
                    const context = {
                        language: editor.document.languageId,
                        fileType: path.extname(editor.document.fileName),
                        currentFileContent: selectedText,
                    };
                    
                    let prompt = userPrompt + "\n" + selectedText;
                    const gemini = new geminis();
                    const response = await gemini.editCode(prompt, context);
                    
                
                    if (!response || !response.correct_code) {
                        vscode.window.showErrorMessage("Error: AI did not return a valid response.");
                        return;
                    }
    
                    panel.webview.postMessage({
                        command: "displayResponse",
                        correct_code: response.correct_code,
                        explanation: response.explanation,
                    });
                    
    
                } catch (error) {
                    vscode.window.showErrorMessage(`Error: ${error.message}`);
                    panel.webview.postMessage({ command: "error", message: error.message });
                }
            } 
            else if (message.command === "applyChanges") {
                editor.edit((editBuilder) => {
                    editBuilder.replace(editor.selection, message.correct_code);
                });
                panel.dispose();
            }
        });
    });

    //command fixes bugs directly
    const fixBugs = vscode.commands.registerCommand('codeeasy.fixbugs', async () => {
        console.log("edit");
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage("No active editor");
            return;
        }
    
        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);
    
        if (!selectedText) {
            vscode.window.showWarningMessage("No text selected");
            return;
        }
    
        
        // Create and configure the webview panel
        const panel = vscode.window.createWebviewPanel(
            "editCodePanel",
            "Edit Code",
            vscode.ViewColumn.Beside,
            { enableScripts: true }
        );
    
        const htmlPath = path.join(context.extensionPath, "editor", "editpanel.html");
        panel.webview.html = fs.readFileSync(htmlPath, "utf8");
    
        
        panel.webview.onDidReceiveMessage(async (message) => {
            if (message.command === "ready") {
                try {
                    const context = {
                        language: editor.document.languageId,
                        fileType: path.extname(editor.document.fileName),
                        currentFileContent: selectedText,
                    };
                    
                    let prompt = "Correct the following code" + "\n" + selectedText;
                    const gemini = new geminis();
                    const response = await gemini.editCode(prompt, context);
                    
                
                    if (!response || !response.correct_code) {
                        vscode.window.showErrorMessage("Error: AI did not return a valid response.");
                        return;
                    }
    
                    panel.webview.postMessage({
                        command: "displayResponse",
                        correct_code: response.correct_code,
                        explanation: response.explanation,
                    });
                    
    
                } catch (error) {
                    vscode.window.showErrorMessage(`Error: ${error.message}`);
                    panel.webview.postMessage({ command: "error", message: error.message });
                }
            } 
            else if (message.command === "applyChanges") {
                editor.edit((editBuilder) => {
                    editBuilder.replace(editor.selection, message.correct_code);
                });
                panel.dispose();
            }
        });
    });
        

    context.subscriptions.push(openSidebarCommand);
    context.subscriptions.push(editCode);
    context.subscriptions.push(fixBugs);
}

function deactivate() {}

module.exports = { activate, deactivate };
