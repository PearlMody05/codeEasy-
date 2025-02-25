const vscode = require('vscode');
const GeminiService = require('./GeminiService'); // Ensure correct path

async function handleCodeGeneration(prompt, editor) {
    try {
        const context = {
            language: editor.document.languageId || "plaintext",
            fileType: editor.document.fileName.split('.').pop() || "txt",
            currentFileContent: editor.document.getText() || ""
        };

        const geminiService = new GeminiService();
        const generatedCode = await geminiService.generateCode(prompt, context);

        return generatedCode;
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to generate code: ${error.message}`);
        return null;
    }
}

async function insertGeneratedCode(editor, code) {
    if (!editor) {
        vscode.window.showErrorMessage('No active editor found.');
        return;
    }
    
    await editor.edit(editBuilder => {
        const position = editor.selection.active;
        editBuilder.insert(position, code);
    });

    await vscode.commands.executeCommand('editor.action.formatDocument');
}

module.exports = { handleCodeGeneration, insertGeneratedCode };
