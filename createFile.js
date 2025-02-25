// @ts-nocheck
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

/**
 * Creates a new file in the specified directory (or workspace root if no directory is provided).
 * @param {string} fileName - The name of the file to create (e.g., "example.js").
 * @param {string} [directory] - The directory where the file should be created (optional).
 * @returns {Promise<string | undefined>} - The full path of the created file, or `undefined` if an error occurs.
 */
async function createNewFile(fileName, directory,code) {
    try {
        // Get the workspace root if no directory is provided
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder is open.');
            return undefined;
        }

        const workspacePath = workspaceFolders[0].uri.fsPath;
        const targetDirectory = directory ? path.join(workspacePath, directory) : workspacePath;
        const filePath = path.join(targetDirectory, fileName);

        // Create the file (empty file)
        if(code != null) fs.writeFileSync(filePath, code);
        else fs.writeFileSync(filePath, '');
        const document = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(document);

        vscode.window.showInformationMessage(`File "${fileName}" created successfully at "${filePath}".`);
        return filePath;
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create file "${fileName}": ${error.message}`);
        return undefined;
    }
}
module.exports=createNewFile;