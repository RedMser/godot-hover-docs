import { Uri, workspace } from "vscode";
import { XMLParser } from "fast-xml-parser";
import { TextDecoder } from "util";

export class GodotXMLCache {
    /** `true` if file exists, `false` if file is deleted, docs data otherwise. `undefined` means we don't know about this file. */
    private _cache: Record<string, boolean | DocsData> = {};

    async findXML(classname: string): Promise<DocsData | undefined> {
        classname = "/" + classname.toLowerCase() + ".xml";
        for (const key in this._cache) {
            if (key.toLowerCase().endsWith(classname)) {
                const result = await this.getXML(Uri.parse(key));
                if (result !== undefined) {
                    return result;
                }
            }
        }
        return undefined;
    }

    async getXML(file: Uri): Promise<DocsData | undefined> {
        if (this._cache[file.toString()] === true) {
            // Parse XML
            const contents = await workspace.fs.readFile(file);
            const xml = new XMLParser({
                ignoreAttributes: false,
                attributeNamePrefix: "",
                textNodeName: "elementText",
            }).parse(new TextDecoder().decode(contents));
            this._cache[file.toString()] = xml;
        } else if (typeof this._cache[file.toString()] !== "object") {
            // Deleted (false) or unknown file (undefined)
            return undefined;
        }
        return this._cache[file.toString()];
    }

    updateXML(file: Uri, exists: boolean) {
        // Hello cache
        this._cache[file.toString()] = exists;
    }
}

export type DocsData = any;
