import { CancellationToken, commands, Hover, HoverProvider, MarkdownString, Position, TextDocument } from 'vscode';
import { DocsData } from './xml_cache';
import { DocsParser } from './docs_parsing';

const sanitizeRegex = /\*|&|<[^<>]+>/g;
const classRegex = /^```cpp\s+class\s(\S+?)\s+```$/s;
const methodRegex = /^```cpp.+?(\S+?)::(?:Data::)?(\S+?)\(/s;
const propertyRegex = /^```cpp.+?(\S+?)::(?:Data::)?(\S+?)\s+```$/s;

export class GodotXMLHoverProvider implements HoverProvider {
    isQuerying = false;

    constructor(
        public docsParser: DocsParser,
        public findXML: (classname: string) => Promise<DocsData | undefined>,
    ) {}

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

                // Remove all pointers, references and generic types.
                // Since generic types can be recursive, we keep applying the regex until we reach
                // a stable value.
                value = this.sanitizeValue(value);

                const toTryList = ["detectClass", "detectMethod", "detectProperty"] as const;
                for (const toTry of toTryList) {
                    const result = await this[toTry](value);
                    if (result !== undefined) {
                        const md = new MarkdownString(result);
                        md.isTrusted = { enabledCommands: ['godot-hover-docs.followLink'] };
                        contents.push(md);
                        break;
                    }
                }
                break;
            }
        }
        return { contents };
    }

    sanitizeValue(text: string): string {
        while (true) {
            const newText = text.replace(sanitizeRegex, '');
            if (newText === text) {
                break;
            }
            text = newText;
        }
        return text;
    }

    async detectClass(text: string): Promise<string | undefined> {
        const match = classRegex.exec(text);
        if (!match) {
            return undefined;
        }
        const docs = await this.findXML(match[1]);
        if (!docs?.class) {
            return undefined;
        }
        return this.docsParser.getClassDescription(match[1], docs);
    }

    async detectMethod(text: string): Promise<string | undefined> {
        const match = methodRegex.exec(text);
        if (!match) {
            return undefined;
        }
        const docs = await this.findXML(match[1]);
        if (!docs?.class) {
            return undefined;
        }
        return this.docsParser.getMethodDescription(match[1], docs, match[2]);
    }

    async detectProperty(text: string): Promise<string | undefined> {
        const match = propertyRegex.exec(text);
        if (!match) {
            return undefined;
        }
        const docs = await this.findXML(match[1]);
        if (!docs?.class) {
            return undefined;
        }
        return this.docsParser.getPropertyDescription(match[1], docs, match[2]);
    }
}
