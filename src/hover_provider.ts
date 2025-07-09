import { CancellationToken, commands, Hover, HoverProvider, MarkdownString, Position, TextDocument } from 'vscode';
import * as Docs from './docs_parsing';
import { DocsData } from './xml_cache';

export class GodotXMLHoverProvider implements HoverProvider {
    isQuerying = false;

    constructor(public findXML: (classname: string) => Promise<DocsData | undefined>) {}

    async provideHover(document: TextDocument, position: Position, token: CancellationToken): Promise<Hover | null | undefined> {
        if (this.isQuerying) {
            return;
        }
        this.isQuerying = true;
        const hovers = await commands.executeCommand<Hover[]>("vscode.executeHoverProvider", document.uri, position);
        this.isQuerying = false;

        // Check hovers for a method like `TypeA TypeB::methodname(...)`.
        const contents: MarkdownString[] = [];
        for (const hover of hovers) {
            for (const content of hover.contents) {
                let value: string;
                if (typeof content === 'object') {
                    value = content.value;
                } else {
                    value = content;
                }

                const toTryList = ["detectClass", "detectMethod", "detectProperty"] as const;
                for (const toTry of toTryList) {
                    const result = await this[toTry](value);
                    if (result !== undefined) {
                        contents.push(new MarkdownString(result));
                        break;
                    }
                }
                break;
            }
        }
        return { contents };
    }

    // TODO: These regexes do not handle pointers well yet! Since they use spaces AND attach an * to the classname

    async detectClass(text: string): Promise<string | undefined> {
        const classRegex = /^```cpp\s+class\s(\S+?)\s+```$/s;
        const match = classRegex.exec(text);
        if (!match) {
            return undefined;
        }
        const docs = await this.findXML(match[1]);
        if (!docs?.class) {
            return undefined;
        }
        return Docs.getClassDescription(docs);
    }

    async detectMethod(text: string): Promise<string | undefined> {
        const methodRegex = /^```cpp.+?(\S+?)::(?:Data::)?(\S+?)\(/s;
        const match = methodRegex.exec(text);
        if (!match) {
            return undefined;
        }
        const docs = await this.findXML(match[1]);
        if (!docs?.class) {
            return undefined;
        }
        return Docs.getMethodDescription(docs, match[2]);
    }

    async detectProperty(text: string): Promise<string | undefined> {
        const propertyRegex = /^```cpp.+?(\S+?)::(?:Data::)?(\S+?)\s+```$/s;
        const match = propertyRegex.exec(text);
        if (!match) {
            return undefined;
        }
        const docs = await this.findXML(match[1]);
        if (!docs?.class) {
            return undefined;
        }
        return Docs.getPropertyDescription(docs, match[2]);
    }
}
