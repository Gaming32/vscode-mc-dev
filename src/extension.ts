import { ExtensionContext, commands, window } from 'vscode';
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
        projectType?.action();
    }));
}

export function deactivate() {
}
