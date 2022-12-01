function asMarkdown(bbcode: string): string {
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

    bbcode = bbcode.replace(/\[(constant|signal|method|param|enum) (.+?)\]/g, link("$2"));
    //bbcode = bbcode.replace(/\[(.+?)\]/g, link("$1")); // Only do this for valid classes! otherwise should ignore unsupported bbcode
    return bbcode; // TODO some more are missing
}

function link(text: string): string {
    // TODO: make links work (probably needs custom command to find the correct member)
    return `[${text}](./${text})`;
}

function code(text: string): string {
    return `\`${text}\``;
}

export function getClassDescription(xml: any): string {
    return asMarkdown(xml.class.brief_description || xml.class.description || "(No description)");
}

export function getMethodDescription(xml: any, methodname: string): string {
    for (const method of xml.class.methods?.method ?? []) {
        if (method.name === methodname) {
            return asMarkdown(method.description || "(No description)");
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
            return match + link(property.name || "(unnamed)") +
                   "\n\n" + asMarkdown(property.elementText || "(No description)");
        }
    }

    return "(Undocumented)";
}

export function getPropertyDescription(xml: any, propertyname: string): string {
    for (const property of xml.class.members?.member ?? []) {
        if (property.name === propertyname) {
            return "Default value: " + code(property.default || "(unspecified)") +
                   "\n\n" + asMarkdown(property.elementText || "(No description)");
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
            return match + link(method.name || "(unnamed)") +
                   "\n\n" + asMarkdown(method.description || "(No description)");
        }
    }

    return "(Undocumented)";
}
