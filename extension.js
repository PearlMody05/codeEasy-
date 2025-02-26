
// @ts-nocheck
const vscode = require('vscode');
const path = require('path');
const generate = require('./generate');
const geminis = require('./GeminiService');
const { exec } = require('child_process');
const fs = require('fs');

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

    const provider = new CodeGeneratorViewProvider(context);
    

    // Command to open the sidebar
    const openSidebarCommand = vscode.commands.registerCommand('codeeasy.openSidebar', () => {
        vscode.commands.executeCommand("workbench.view.extension.codeGeneratorSidebar");
    });

    //command to edit code based on selection
    const editCode = vscode.commands.registerCommand('codeeasy.editCode', async () => {
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

    //command to fixes bugs 
    const fixBugs = vscode.commands.registerCommand('codeeasy.fixbugs', async () => {
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

    //command to generate test cases and test code automatically
    const generateTestCase = vscode.commands.registerCommand('codeeasy.generateTestCases', async () => {
        try{const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage("No active editor");
            return;
        }
        const document = editor.document;
        if (document.languageId !== "python") {
            vscode.window.showErrorMessage("This feature is only available for Python files.");
            return;
        }
        const fileContent = await document.getText(); 
        const context = {
            language: editor.document.languageId,
            fileType: path.extname(editor.document.fileName),
            currentFileContent:fileContent ,
        };
        const loc = editor.document.uri.fsPath;
        vscode.window.showInformationMessage("Test case generation started...");
        const gemini = new geminis(); //object of gemini service class
        let prompt = "file location is "+loc+" and code is \n"+fileContent;
        const success = await gemini.testCode(prompt,context);
        if(success==1){
            vscode.window.showInformationMessage("testing it..");
            let testFilePath = vscode.window.activeTextEditor.document.uri.fsPath;
            exec("pytest --version", (error, stdout, stderr) => {
                if (error) {
                    vscode.window.showWarningMessage("pytest not found. Installing pytest...");
                    exec("pip install pytest", (installErr, installOut, installErrOut) => {
                        if (installErr) {
                            vscode.window.showErrorMessage("Failed to install pytest.");
                            return;
                        }
                        vscode.window.showInformationMessage("pytest installed successfully.");
                        runPytest(testFilePath);
                    });
                } else {
                    runPytest(testFilePath);
                }
            });
        }
        if (success==0) {
            vscode.window.showErrorMessage("Test case generation failed.");
        }
        
}catch(err){
    console.log(err);
}
function runPytest(testFilePath) {
    const terminal = vscode.window.createTerminal("Pytest Terminal");
    terminal.show();
    terminal.sendText(`pytest "${testFilePath}"`);
}
        
    });
    
    context.subscriptions.push(openSidebarCommand);
    context.subscriptions.push(editCode);
    context.subscriptions.push(fixBugs);
    context.subscriptions.push(generateTestCase);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('codeGeneratorView', provider));
}

function deactivate() {}

module.exports = { activate, deactivate };
