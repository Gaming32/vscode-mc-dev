import { commands, ExtensionContext, ProgressLocation, Uri, window, workspace } from "vscode";
import fetch from "node-fetch";
import { getApi, FileDownloader } from "@microsoft/vscode-file-downloader-api";
import { existsSync } from "fs";
import extract = require("extract-zip");
import mv = require("mv");
import { readdir } from "fs/promises";

export async function newFabricProject(context: ExtensionContext) {
    await downloadFabricGameVersions();
    const versionListing = [{label: "Snapshots", version: <FabricGameVersion | null>null}].concat(
        MC_VERSIONS.flatMap(version =>
            version.stable ? [{label: version.version, version: version}] : []
        )
    );

    const mcVersion = await window.showQuickPick(
        versionListing,
        {
            ignoreFocusOut: true,
            placeHolder: "Select Minecraft version"
        }
    );
    if (!mcVersion) {
        return;
    }
    var versionItself: FabricGameVersion;
    if (!mcVersion.version) {
        const snapshotVersionListing = MC_VERSIONS.map(version => {
                return {label: version.version, version: version};
            }
        );
        const snapshotVersion = await window.showQuickPick(
            snapshotVersionListing,
            {
                ignoreFocusOut: true,
                placeHolder: "Select Minecraft version"
            }
        );
        if (!snapshotVersion) {
            return;
        }
        versionItself = snapshotVersion.version;
    } else {
        versionItself = mcVersion.version;
    }

    const groupId = await window.showInputBox({
        title: "Enter your Group ID",
        value: "com.example",
        placeHolder: "Group ID",
        ignoreFocusOut: true,
        // Java package name, in accordance with https://maven.apache.org/guides/mini/guide-naming-conventions.html
        validateInput: value =>
            /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+[0-9a-z_]$/i.test(value) ? null
                : "Must follow Java package naming rules"
    });
    if (!groupId) {
        return;
    }

    const modid = await window.showInputBox({
        title: "Enter your mod's ID",
        value: "modid",
        placeHolder: "Mod ID",
        ignoreFocusOut: true
    });
    if (!modid) {
        return;
    }

    var projectParentDir = await window.showOpenDialog({
        openLabel: "Select folder",
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        title: "Select parent folder for project"
    });
    if (!projectParentDir) {
        window.showInformationMessage("Project creation cancelled");
        return;
    }
    const projectDir = `${projectParentDir[0].fsPath}/${modid}`;

    if (existsSync(projectDir)) {
        window.showErrorMessage("Destination folder already exists");
        return;
    }

    const fileDownloader: FileDownloader = await getApi();
    window.withProgress({location: ProgressLocation.Notification, title: "Setting up project", cancellable: true}, async (prog, cancel) => {
        var totalProgress = 0;
        prog.report({message: "Downloading template...", increment: 0});
        const downloadedZip = await fileDownloader.downloadFile(
            TEMPLATE_URI,
            "fabric-template.zip",
            context,
            cancel,
            (downloaded, total) => {
                var message = `Downloading template... ${Math.floor(downloaded / 1024)}KB`;
                if (total) {
                    message += `/${Math.floor(total / 1024)}KB`;
                }
                var newProgress: number;
                if (total) {
                    newProgress = downloaded / total * 90;
                } else {
                    newProgress = 0;
                }
                prog.report({
                    message: message,
                    increment: newProgress - totalProgress
                });
                totalProgress = newProgress;
            }
        ).then(uri => uri.fsPath);
        if (cancel.isCancellationRequested) {
            return;
        }
        prog.report({message: "Extracting template...", increment: 90 - totalProgress});
        await extract(downloadedZip, {dir: projectDir});
        await readdir(projectDir).then(files => {
            mv(`${projectDir}/${files[0]}`, projectDir, {clobber: false}, err => {
                if (err) {
                    window.showErrorMessage(err);
                    console.log(err);
                }
            });
        });
    }).then(async () => {
        const choice = await window.showInformationMessage(`Project created at ${projectDir}.\nWould you like to open it now?`, "Open");
        if (choice === "Open") {
            await commands.executeCommand("vscode.openFolder", Uri.file(projectDir), {forceNewWindow: !!workspace.workspaceFolders});
        }
    });
}

async function downloadFabricGameVersions() {
    if (mcVersionsDefault) {
        try {
            const response = await fetch(FABRIC_VERSIONS_API);
            const jsonVersions = await response.json();
            MC_VERSIONS.splice(0, MC_VERSIONS.length, ...jsonVersions as FabricGameVersion[]);
            mcVersionsDefault = false;
            console.log("Downloaded Fabric game versions");
        } catch (error) {
            console.error("Failed to download Fabric game versions, using defaults");
            console.error(error);
        }
    }
}

interface FabricGameVersion {
    version: string,
    stable: boolean,
}

export const TEMPLATE_URI = Uri.parse("https://github.com/Gaming32/fabric-vscode-mc-dev/archive/refs/heads/1.18.zip");
const FABRIC_VERSIONS_API = "https://meta.fabricmc.net/v2/versions/game";
const MC_VERSIONS: FabricGameVersion[] = [
    {version: "1.18.2", stable: true},
    {version: "1.18.1", stable: true},
    {version: "1.18", stable: true},
    {version: "1.17.1", stable: true},
    {version: "1.17", stable: true},
    {version: "1.16.5", stable: true},
    {version: "1.16.4", stable: true},
    {version: "1.16.3", stable: true},
    {version: "1.16.2", stable: true},
    {version: "1.16.1", stable: true},
    {version: "1.16", stable: true},
];
var mcVersionsDefault = true;
