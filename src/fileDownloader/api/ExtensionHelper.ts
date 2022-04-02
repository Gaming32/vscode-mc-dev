// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { FileDownloader } from "./index";
import { activate as activateEmbedded } from "../Extension";
import OutputLogger from "../../logging/OutputLogger";

export default class ExtensionHelper {
    private _extension: FileDownloader | undefined;

    public async getApi(logger: OutputLogger): Promise<FileDownloader> {
        if (!this._extension) {
            this._extension = activateEmbedded(logger);
        }
        return this._extension;
    }
}
