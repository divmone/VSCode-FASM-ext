import * as vscode from 'vscode';
import regExp from "./regExpStrings"

function completitionProviderString() {
    const completionItems = [
        ...regExp.fasmInstructions.map(instruction => 
            new vscode.CompletionItem(instruction, vscode.CompletionItemKind.Keyword)),
        ...regExp.fasmRegisters.map(register => 
            new vscode.CompletionItem(register, vscode.CompletionItemKind.Variable)),
        ...regExp.fasmMacros.map(macro => 
            new vscode.CompletionItem(macro, vscode.CompletionItemKind.Function))
    ];

    const procCompletion = new vscode.CompletionItem('proc', vscode.CompletionItemKind.Keyword);
    procCompletion.insertText = new vscode.SnippetString('proc ${1:name} uses ${2:registers}\n\t${3}\n\tret\nendp');

    completionItems.push(procCompletion);

    return completionItems;
}

function completionProvider() {
    // for buttons switch
    vscode.commands.executeCommand('setContext', 'fasm.mode.run', true);
    vscode.commands.executeCommand('setContext', 'fasm.mode.debug', false);

    // register regular expressions
    return vscode.languages.registerCompletionItemProvider('fasm', { provideCompletionItems() { return completitionProviderString() } });    
}

export default completionProvider