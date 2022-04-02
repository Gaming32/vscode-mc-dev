import { ExtensionContext, commands, window, env, Uri } from 'vscode';
import { newFabricProject } from './fabric';

export function activate(context: ExtensionContext) {
    context.subscriptions.push(commands.registerCommand('vscode-mc-dev.createMinecraftMod', async () => {
        const projectType = await window.showQuickPick(
            [
                {
                    label: "Fabric",
                    description: "Fabric is a lightweight modding toolchain for Minecraft.",
                    action: newFabricProject
                }
            ],
            {
                ignoreFocusOut: true,
                placeHolder: "Select the mod platform"
            }
        );
        try {
            projectType?.action(context);
        } catch (error) {
            console.error(error);
            if (await window.showErrorMessage(`Internal error!\n${error}`, "Send bug report") === "Send bug report") {
                env.openExternal(Uri.parse("https://github.com/Gaming32/vscode-mc-dev/issues"));
            }
        }
    }));
}

export function deactivate() {
}
