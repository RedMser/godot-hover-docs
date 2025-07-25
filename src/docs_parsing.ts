import { SymbolKind } from "vscode";

export class DocsParser {
    validClassnames: string[] = [];

    asMarkdown(classname: string, bbcode: string, membername?: string): string {
        // Trim whitespace at start
        bbcode = bbcode.split(/\n/g).map(ln => ln.trimStart()).join("\n");
        bbcode = bbcode.replace(/\n/g, "\n\n");
        bbcode = bbcode.replace(/\[\/?b\]/g, "**");
        bbcode = bbcode.replace(/\[\/?i\]/g, "*");
        bbcode = bbcode.replace(/\[\/?u\]/g, "__");
        bbcode = bbcode.replace(/\[\/?s\]/g, "~~");
        bbcode = bbcode.replace(/\[url="?(.+?)"?\](.+?)\[\/url\]/g, "[$2]($1)");
        bbcode = bbcode.replace(/\[\/?(code|kbd)\]/g, "`");
        bbcode = bbcode.replace(/\[\/?codeblock\]/g, "```");
        // TODO: allow choosing to show only gdscript or only c# docs
        bbcode = bbcode.replace(/\[codeblocks\].+?\[\/codeblocks\]/g, "");
        // TODO some more BBCode tags are missing

        bbcode = bbcode.replace(/\[(constant|signal|method|param|enum|member) (.+?)\]/g, (_, kind, name) => {
            if (kind === 'param') {
                // Can't link to parameters in VSCode.
                if (membername) {
                    // Link to method instead.
                    return this.linkMember(classname, membername, SymbolKind.Method, name);
                } else {
                    // Fallback to the class I guess? This case shouldn't really happen.
                    return this.linkClass(classname, name);
                }
            } else if (kind === 'signal') {
                // Let's just link to bind methods.
                return this.linkMember(classname, '_bind_methods', SymbolKind.Method, name);
            } else {
                // Try finding a named constant/method/enum/member.
                let symbolKind = SymbolKind.Method;
                if (kind === 'constant') {
                    symbolKind = SymbolKind.Constant;
                } else if (kind === 'enum') {
                    symbolKind = SymbolKind.Enum;
                } else if (kind === 'member') {
                    // TODO: how to lookup properties?
                    symbolKind = SymbolKind.Property;
                }
                return this.linkMember(classname, name, symbolKind);
            }
        });

        bbcode = bbcode.replace(/\[(.+?)\]/g, (match, classname) => {
            if (this.validClassnames.includes(classname)) {
                return this.linkClass(classname);
            } else {
                // Treat as an unknown BBCode tag.
                return match;
            }
        });

        return bbcode;
    }

    linkMember(ownerClass: string, linkTarget: string, targetKind: SymbolKind, linkText?: string): string {
        if (linkTarget.startsWith('(') && linkTarget.endsWith(')')) {
            // Not a valid link.
            return linkTarget;
        }

        let symbol = linkTarget;
        if (!symbol.includes('.')) {
            // Points to the same class as owner.
            symbol = `${ownerClass}::${symbol}`;
        } else {
            // Points to another class.
            symbol = symbol.replace(/\./g, '::');
        }

        const args = { classname: ownerClass, symbol, kind: targetKind };
        const argString = encodeURIComponent(JSON.stringify(args));
        return `[${linkText ?? linkTarget}](command:godot-hover-docs.followLink?${argString})`;
    }

    linkClass(classname: string, linkText?: string): string {
        if (classname.startsWith('(') && classname.endsWith(')')) {
            // Not a valid class.
            return classname;
        }

        const args = { classname, symbol: `${classname}::${classname}`, kind: SymbolKind.Class };
        const argString = encodeURIComponent(JSON.stringify(args));
        return `[${linkText ?? classname}](command:godot-hover-docs.followLink?${argString})`;
    }

    code(text: string): string {
        return `\`${text}\``;
    }

    getClassDescription(classname: string, xml: any): string {
        return this.asMarkdown(classname, xml.class.brief_description || xml.class.description || "(No description)");
    }

    getMethodDescription(classname: string, xml: any, methodname: string): string {
        for (const method of xml.class.methods?.method ?? []) {
            if (method.name === methodname) {
                return this.asMarkdown(classname, method.description || "(No description)", methodname);
            }
        }

        // Check getter/setter of property
        let match = "";
        for (const property of xml.class.members?.member ?? []) {
            if (property.setter === methodname) {
                match = "Setter for ";
            } else if (property.getter === methodname) {
                match = "Getter for ";
            }

            if (match) {
                return match + this.linkMember(classname, property.name || "(unnamed)", SymbolKind.Property) +
                    "\n\n" + this.asMarkdown(classname, property.elementText || "(No description)", property.name);
            }
        }

        return "(Undocumented)";
    }

    getPropertyDescription(classname: string, xml: any, propertyname: string): string {
        for (const property of xml.class.members?.member ?? []) {
            if (property.name === propertyname) {
                return "Default value: " + this.code(property.default || "(unspecified)") +
                    "\n\n" + this.asMarkdown(classname, property.elementText || "(No description)", propertyname);
            }
        }

        // Find a getter/setter method
        let match = "";
        for (const method of xml.class.methods?.method ?? []) {
            if (method.name === "get_" + propertyname || method.name === "is_" + propertyname || method.name === "has_" + propertyname) {
                match = "Has getter ";
            } else if (method.name === "set_" + propertyname) {
                match = "Has setter ";
            }

            if (match) {
                return match + this.linkMember(classname, method.name || "(unnamed)", SymbolKind.Method) +
                    "\n\n" + this.asMarkdown(classname, method.description || "(No description)", method.name);
            }
        }

        return "(Undocumented)";
    }
}
