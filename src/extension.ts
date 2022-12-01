import { ExtensionContext, languages, workspace } from 'vscode';
import { GodotXMLHoverProvider } from './hover_provider';
import { GodotXMLCache } from './xml_cache';
import { GodotXMLWatcher } from './xml_watcher';

export function activate(context: ExtensionContext) {
	const xmlCache = new GodotXMLCache();
	const xmlWatcher = new GodotXMLWatcher((file, exists) => xmlCache.updateXML(file, exists));
	context.subscriptions.push(xmlWatcher);

	languages.registerHoverProvider([
		{ language: "cpp" }, { language: "h" }
	], new GodotXMLHoverProvider((name) => xmlCache.findXML(name)));

	workspace.onDidChangeWorkspaceFolders(() => {
		xmlWatcher.recreateWatcher();
	});
}

export function deactivate() { }
