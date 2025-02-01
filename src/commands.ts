import * as os from "os";
import * as path from 'path';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as unzipper from "unzipper";
import * as tar from "tar";
import * as https from "https";

function getFasmDownloadUrl(): { url: string; filename: string; isZip: boolean } {
    const platform = os.platform();
  
    if (platform === "win32") {
      return { url: "https://flatassembler.net/fasmw17332.zip", filename: "fasmw17332.zip", isZip: true };
    } else if (platform === "linux" || platform === "darwin") {
      return { url: "https://flatassembler.net/fasm-1.73.32.tgz", filename: "fasm-1.73.32.tgz", isZip: false };
    } else {
      throw new Error("Unsupported OS");
    }
}

async function unzipFile(zipPath: string, extractPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.createReadStream(zipPath)
        .pipe(unzipper.Extract({ path: extractPath }))
        .on("close", () => {
          console.log(`Unzipped to: ${extractPath}`);
          resolve();
        })
        .on("error", reject);
    });
}

async function untarFile(tarPath: string, extractPath: string): Promise<void> {
    return tar.x({
      file: tarPath,
      cwd: extractPath,
    }).then(() => {
      console.log(`Extracted to: ${extractPath}`);
    });
}

function downloadFile(url: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(outputPath);
      https.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: ${response.statusCode}`));
          return;
        }
        response.pipe(file);
        file.on("finish", () => {
          file.close();
          console.log(`Downloaded: ${outputPath}`);
          resolve();
        });
      }).on("error", (err) => {
        fs.unlink(outputPath, () => {}); 
        reject(err);
      });
    });
}

async function installFasm() {
    try {
        const { url, filename, isZip } = getFasmDownloadUrl();
        const outputPath = path.join(__dirname, filename);
        const parentDir = path.dirname(__dirname);
        const extractPath = path.join(parentDir, "bin", "fasm");
                
        vscode.window.showInformationMessage(`Downloading FASM for ${os.platform()}...`);
        await downloadFile(url, outputPath);
                
        vscode.window.showInformationMessage("Extracting...");
        if (isZip) {
            await unzipFile(outputPath, extractPath);
        } else {
            await untarFile(outputPath, extractPath);
        }
                
        const includePath = path.join(extractPath, "include");
        await vscode.workspace.getConfiguration().update('fasm.assemblerPath', extractPath, vscode.ConfigurationTarget.Global);
        await vscode.workspace.getConfiguration().update('fasm.includePath', includePath, vscode.ConfigurationTarget.Global);
                
        vscode.window.showInformationMessage(`FASM installed successfully at ${extractPath}`);
    } catch (error) {
        vscode.window.showErrorMessage(`Error`);
    }
}

function checkWorkspaceFolder() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder open!');
        return {code: 0, dir: null};
    }
            
    const vscodeDir = path.join(workspaceFolder, '.vscode');
    if (!fs.existsSync(vscodeDir)) {
        fs.mkdirSync(vscodeDir);
    }
    return {code: 1, dir: vscodeDir};
}

function workWithPath() {
    const activeFile = vscode.window.activeTextEditor?.document.fileName;
    if (!activeFile) {
        vscode.window.showErrorMessage('No active FASM file!');
        return {code: 0, file: null, exec: null};
    }

    const parsedPath = path.parse(activeFile);
    let outputExecutable = "";
    if (os.platform() === "win32") {
        outputExecutable = path.join(parsedPath.dir, parsedPath.name + ".exe");
    } else {
        outputExecutable = path.join(parsedPath.dir, parsedPath.name);
    }
    return {code: 1, file: activeFile, exec: outputExecutable};
}

function createJson(vscodeDir : string, activeFile : string, outputExecutable : string) {
    try {
        const tasksPath = path.join(vscodeDir, 'tasks.json');
            
        const tasksConfig = {
            version: "2.0.0",
            tasks: [
                {
                    label: "Build FASM",
                    type: "shell",
                    command: "fasm",
                    args: [
                        activeFile, 
                        outputExecutable
                    ],
                    group: "build",
                    problemMatcher: [],
                    options: {
                        env: {
                            FASM: "${config:fasm.assemblerPath}",
                            INCLUDE: "${config:fasm.includePath}"
                        }
                    }
                }
            ],
            activeFilePath: activeFile,
            executionFilePath: outputExecutable
        };
            
        fs.writeFileSync(tasksPath, JSON.stringify(tasksConfig, null, 2));
            
        vscode.window.showInformationMessage(`FASM configs created for: ${activeFile}`);
    } catch (error) {
        vscode.window.showErrorMessage(`Error creating configs: ${error}`);
    }
}

async function commandsRegister() {
    installFasm()
    
    const folderStruct = checkWorkspaceFolder()
    if (!folderStruct.code) return // if error code
    const vscodeDir = folderStruct.dir || "" // check for null string

    const pathStruct = workWithPath()
    if (!pathStruct.code) return // if error code
    const activeFile = pathStruct.file || "" // check for null string
    const outputExecutable = pathStruct.exec || "" // check for null string

    createJson(vscodeDir, activeFile, outputExecutable)
}

export default commandsRegister