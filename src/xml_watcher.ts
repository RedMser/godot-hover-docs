import { FileSystemWatcher, Uri, workspace } from "vscode";

export class GodotXMLWatcher {
    private readonly glob = "**/{doc_classes,doc/classes}/*.xml";

    watcher?: FileSystemWatcher;

    constructor(public updateFile: (file: Uri, exists: boolean) => void) {
        // Initialize the XML cache with currently found files.
        (async () => {
            for (const file of await workspace.findFiles(this.glob)) {
                this.updateFile(file, true);
            }
        })();
        this.recreateWatcher();
    }

    dispose() {
        this.watcher?.dispose();
        this.watcher = undefined;
    }

    recreateWatcher() {
        this.dispose();
        this.watcher = workspace.createFileSystemWatcher(this.glob);
        this.watcher.onDidChange((uri) => this.updateFile(uri, true));
        this.watcher.onDidCreate((uri) => this.updateFile(uri, true));
        this.watcher.onDidDelete((uri) => this.updateFile(uri, false));
    }
}
