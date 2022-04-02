import { commands, ExtensionContext, ProgressLocation, Uri, window, workspace } from "vscode";
import fetch from "node-fetch";
import { getApi, FileDownloader } from "@microsoft/vscode-file-downloader-api";
import { existsSync } from "fs";
import extract = require("extract-zip");
import mv = require("mv");
import { lstat, mkdir, readdir, readFile, rename, writeFile } from "fs/promises";
import { sleep } from "./util";

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
        ignoreFocusOut: true,
        validateInput: value =>
            /^[a-z][a-z0-9_-]*$/i.test(value) ? null
                : "Must match the regex ^[a-z][a-z0-9_-]*$"
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
                    newProgress = downloaded / total * 70;
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

        prog.report({message: "Extracting template...", increment: 70 - totalProgress});
        await extract(downloadedZip, {dir: projectDir});
        await readdir(projectDir).then(files => moveDir(`${projectDir}/${files[0]}`, projectDir));

        prog.report({message: "Requesting additional data...", increment: 10});
        var yarnVersion: FabricYarnVersion[] = [];
        var loaderVersion: FabricLoaderVersion[] = [];
        try {
            var response = await fetch(FABRIC_YARN_VERSIONS_API + versionItself.version);
            var jsonVersions = await response.json();
            yarnVersion.push(...jsonVersions);

            response = await fetch(FABRIC_LOADER_VERSIONS_API + versionItself.version);
            jsonVersions = await response.json();
            loaderVersion.push(...jsonVersions);
        } catch (error) {
            window.showErrorMessage("Failed to request additional data");
            console.error(error);
            return;
        }

        prog.report({message: "Finalizing template...", increment: 10});
        const templateExpansions: {[key: string]: string} = {};
        if (/1\.[1-9][0-9]*(\.[1-9][0-9]*)?/.test(versionItself.version)) {
            const dotIndex = versionItself.version.indexOf(".");
            const secondDotIndex = versionItself.version.indexOf(".", dotIndex + 1);
            var majorVersion: number;
            if (secondDotIndex !== -1) {
                majorVersion = +versionItself.version.slice(dotIndex + 1, secondDotIndex);
            } else {
                majorVersion = +versionItself.version.slice(dotIndex + 1);
            }
            if (majorVersion < 17) {
                templateExpansions.minJavaVersion = "1.8";
            } else if (majorVersion < 18) {
                templateExpansions.minJavaVersion = "16";
            } else {
                templateExpansions.minJavaVersion = "17";
            }
        } else if (/[0-9]{2}w[0-9]{2}[a-z]/.test(versionItself.version)) {
            const wIndex = versionItself.version.indexOf("w");
            const year = +versionItself.version.slice(0, wIndex);
            const week = +versionItself.version.slice(wIndex + 1, versionItself.version.length - 1);
            if (year < 21 || (year === 21 && week < 19)) {
                templateExpansions.minJavaVersion = "1.8";
            } else if (year === 21 && week < 44) {
                templateExpansions.minJavaVersion = "16";
            } else {
                templateExpansions.minJavaVersion = "17";
            }
        } else {
            // Well oof, this isn't a full version *or* a snapshot.
            // Just yolo and say Java 17. That can't go wrong, right?
            templateExpansions.minJavaVersion = "17";
        }
        templateExpansions.minJavaVersionIdentifier = templateExpansions.minJavaVersion.replaceAll(".", "_");
        templateExpansions.mcVersion = versionItself.version;
        templateExpansions.yarnVersion = yarnVersion[0].version;
        templateExpansions.fabricLoaderVersion = loaderVersion[0].loader.version;
        templateExpansions.modVersion = "0.0.1";
        templateExpansions.modGroupId = groupId;
        templateExpansions.modid = modid;
        templateExpansions.fabricApiVersion = "0.48.0+1.18.2 # This is hardcoded, use https://fabricmc.net/develop/ to get the version you want.";
        templateExpansions.modPackage = `${groupId}.${modid.replaceAll("-", "")}`;
        await finalizeTemplate(projectDir, templateExpansions, ["gradle-wrapper.jar", "gradlew", "gradlew.bat"]);
        const oldPackageDir = `${projectDir}/src/main/java/hardcodedRename`,
              newPackageDir = `${projectDir}/src/main/java/${templateExpansions.modPackage.replaceAll(".", "/")}`;
        await mkdir(newPackageDir, {recursive: true});
        moveDir(oldPackageDir, newPackageDir);
    }).then(async () => {
        const choice = await window.showInformationMessage(`Project created at ${projectDir}.\nWould you like to open it now?`, "Open");
        if (choice === "Open") {
            await commands.executeCommand("vscode.openFolder", Uri.file(projectDir), {forceNewWindow: !!workspace.workspaceFolders});
        }
    });
}

var fileOpenCount = 0;

async function finalizeTemplate(baseDir: string, templateExpansions: {[key: string]: string}, skipFileNames: string[]) {
    const files = await readdir(baseDir);
    const promises: Promise<void>[] = [];
    for (var file of files) {
        if (skipFileNames.indexOf(file) !== -1) {
            continue;
        }
        const newName = expandTemplate(file, templateExpansions);
        var fullPath = `${baseDir}/${file}`;
        if (newName !== file) {
            const wasDir = await lstat(fullPath).then(stat => stat.isDirectory());
            const newFullPath = `${baseDir}/${newName}`;
            if (wasDir && !existsSync(newFullPath)) {
                await mkdir(newFullPath);
                moveDir(fullPath, newFullPath);
            } else {
                await rename(fullPath, newFullPath);
            }
            file = newName;
            fullPath = newFullPath;
        }
        if (await lstat(fullPath).then(stat => stat.isDirectory())) {
            promises.push(finalizeTemplate(fullPath, templateExpansions, skipFileNames));
            continue;
        }
        promises.push(applyTemplate(fullPath, templateExpansions));
    }
    await Promise.all(promises);
}

async function applyTemplate(filePath: string, templateExpansions: {[key: string]: string}) {
    while (fileOpenCount > MAX_FILES_OPEN) {
        await sleep(0);
    }
    fileOpenCount++;
    var body = await readFile(filePath, {encoding: "utf-8"});
    body = expandTemplate(body, templateExpansions);
    await writeFile(filePath, body, {encoding: "utf-8"});
    fileOpenCount--;
}

function expandTemplate(data: string, expansions: {[key: string]: string}) {
    for (const key in expansions) {
        const value = expansions[key];
        data = data.replaceAll(`%${key}%`, value);
    }
    return data;
}

function moveDir(source: string, dest: string) {
    mv(source, dest, {clobber: false}, err => {
        if (err) {
            window.showErrorMessage(err);
            console.log(err);
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

interface FabricYarnVersion {
    gameVersion: string,
    separator: string,
    build: number,
    maven: string,
    version: string,
    stable: boolean,
}

interface FabricLoaderVersion {
    loader: {
        separator: string,
        build: number,
        maven: string,
        version: string,
        stable: boolean
    },
    intermediary: {
        maven: string,
        version: string,
        stable: boolean
    },
    launcherMeta: {
        version: number,
        libraries: {
            client: {
                name: string,
                url: string
            }[],
            common: {
                name: string,
                url: string
            }[],
            server: {
                name: string,
                url: string
            }[]
        },
        mainClass: {
            client: string,
            server: string
        }
    }
}

export const TEMPLATE_URI = Uri.parse("https://github.com/Gaming32/fabric-vscode-mc-dev/archive/refs/heads/1.18.zip");
const MAX_FILES_OPEN = 32;
const FABRIC_VERSIONS_API = "https://meta.fabricmc.net/v2/versions/game";
const FABRIC_YARN_VERSIONS_API = "https://meta.fabricmc.net/v2/versions/yarn/";
const FABRIC_LOADER_VERSIONS_API = "https://meta.fabricmc.net/v2/versions/loader/";
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
