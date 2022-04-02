// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import OutputLogger from "../../logging/OutputLogger";
import ExtensionHelper from "./ExtensionHelper";
import FileDownloaderInterface from "./FileDownloader";

type FileDownloader = FileDownloaderInterface;
const extensionHelper = new ExtensionHelper();
const getApi = (logger: OutputLogger) => extensionHelper.getApi(logger);

export { getApi, FileDownloader };