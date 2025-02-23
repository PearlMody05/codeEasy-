// @ts-nocheck
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const GeminiService = require('./GeminiService');

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	// This line of code will only be executed once when your extension is activated
	console.log('Your extension "codeeasy" is now active!');


	const disposable = vscode.commands.registerCommand('codeeasy.generateCode', async function () {
		// The code you place here will be executed every time your command is executed
		try{
			vscode.window.showInformationMessage('Hello from codeEasy!');
		const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor!');
                return;
            }
			const prompt = await vscode.window.showInputBox({
                placeHolder: 'Describe the code you want to generate...',
                title: 'Code Generation'
            });
			if (!prompt) {
                return; 
            }
			await handleCodeGeneration(prompt, editor);
		
		}catch(error){
			vscode.window.showErrorMessage(`Error: ${error.message}`);
		}

	});

	context.subscriptions.push(disposable);
}

async function handleCodeGeneration(prompt, editor) {
	if (!editor || !editor.document) {
        vscode.window.showErrorMessage("No active text editor found.");
        return;
    }
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Generating code...",
        cancellable: true
    }, async (progress) => {
        try {
            
			const context = {
                language: editor.document.languageId || "plaintext",
                fileType: editor.document.fileName.split('.').pop() || "txt",
                currentFileContent: editor.document.getText() || ""
            };

            
            const geminiService = new GeminiService();
            
            
            const generatedCode = await geminiService.generateCode(prompt, context);
            
           
            await insertGeneratedCode(editor, generatedCode);
            
            vscode.window.showInformationMessage('Code generated successfully!');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to generate code: ${error.message}`);
        }
    });
}

async function insertGeneratedCode(editor, code) {
    try {
        await editor.edit(editBuilder => {
            const position = editor.selection.active;
            editBuilder.insert(position, code);
        });

        await vscode.commands.executeCommand('editor.action.formatDocument');
    } catch (error) {
        throw new Error(`Code insertion failed: ${error.message}`);
    }
}



// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
