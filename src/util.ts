export const sleep = async (ms: number) => new Promise(res => setTimeout(res, ms));

// see https://github.com/microsoft/vscode/blob/dddbfa61652de902c75436d250a50c71501da2d7/src/vs/workbench/contrib/tasks/browser/terminalTaskSystem.ts#L140
export const shellQuotes = {
    cmd: {
        strong: "\""
    },
    powershell: {
        escape: {
            escapeChar: "`",
            charsToEscape: " \"'()"
        },
        strong: "'",
        weak: "\""
    },
    bash: {
        escape: {
            escapeChar: "\\",
            charsToEscape: " \"'"
        },
        strong: "'",
        weak: "\""
    },
    zsh: {
        escape: {
            escapeChar: "\\",
            charsToEscape: " \"'"
        },
        strong: "'",
        weak: "\""
    }
};
