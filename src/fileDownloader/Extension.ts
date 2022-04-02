// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import FileDownloader from "./FileDownloader";
import HttpRequestHandler from "./networking/HttpRequestHandler";
import IFileDownloader from "./IFileDownloader";
import OutputLogger from "../logging/OutputLogger";

// Called when the extension is activated
export function activate(logger: OutputLogger): IFileDownloader {
    logger.log(`File Downloader extension now active.`);

    const requestHandler = new HttpRequestHandler(logger);

    return new FileDownloader(requestHandler, logger);
}
