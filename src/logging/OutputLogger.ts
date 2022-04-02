// Thanks to https://github.com/microsoft/vscode-file-downloader
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ExtensionContext, OutputChannel, window } from "vscode";
import ILogger from "./ILogger";

export default class OutputLogger implements ILogger {
    private readonly _outputChannel: OutputChannel;

    public constructor(extensionName: string, context: ExtensionContext) {
        this._outputChannel = window.createOutputChannel(extensionName);
        context.subscriptions.push(this._outputChannel);
    }

    public _log(message: any): void {
        this._outputChannel.appendLine(String(message));
    }

    public log(message: any): void {
        this._log(message);
        console.log(message);
    }

    public warn(message: any): void {
        this._log(`Warning: ${message}`);
        console.warn(message);
    }

    public error(message: any): void {
        this._log(`ERROR: ${message}`);
        console.error(message);
    }
}