import { window } from "vscode";
import fetch from "node-fetch";

export async function newFabricProject() {
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
    window.showInformationMessage(`Using ${versionItself.version}`);
    console.log(versionItself);
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
