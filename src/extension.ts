import { commands, ExtensionContext, languages, SymbolInformation, SymbolKind, TextEditorRevealType, window, workspace } from 'vscode';
import { GodotXMLHoverProvider } from './hover_provider';
import { GodotXMLCache } from './xml_cache';
import { GodotXMLWatcher } from './xml_watcher';
import { DocsParser } from './docs_parsing';

export function activate(context: ExtensionContext) {
	const docsParser = new DocsParser();
	const xmlCache = new GodotXMLCache();
	const xmlWatcher = new GodotXMLWatcher((file, exists) => {
		xmlCache.updateXML(file, exists);
		// TODO: This line could be skipped when XMLWatcher initializes, to save redundant getClassnames() calls.
		docsParser.validClassnames = xmlCache.getClassnames();
	});
	context.subscriptions.push(xmlWatcher);

	commands.registerCommand('godot-hover-docs.followLink', async ({ classname, symbol, kind }) => {
		const symbols = (await commands.executeCommand<SymbolInformation[]>('vscode.executeWorkspaceSymbolProvider', symbol)) ?? [];

		const matchesKind = (filter: SymbolKind, actual: SymbolKind) => {
			// Normalize some symbol kinds.
			if (actual === SymbolKind.Function) {
				actual = SymbolKind.Method;
			} else if (actual === SymbolKind.Field) {
				actual = SymbolKind.Property;
			} else if (actual === SymbolKind.Constructor) {
				actual = SymbolKind.Class;
			}

			if (filter === SymbolKind.Class) {
				// We're going to show the constructor, which is a method.
				filter = SymbolKind.Method;
			}

			return filter === actual;
		};

		// TODO: Could be cool to include the getter/setter functions when we're following a link to a property.
		const candidates = symbols.filter(sym => {
			if (sym.containerName !== classname) { return false; }
			//if (sym.name.endsWith('(declaration)')) { return false; }
			if (!matchesKind(kind, sym.kind)) { return false; }

			// TODO: Try for exact matches as much as possible!
			let nameCheck = symbol;
			if (kind === SymbolKind.Method) {
				nameCheck += '(';
			}

			return sym.name.startsWith(nameCheck);
		});

		const errorMessage = `Could not find link target: ${symbol}`;
		if (candidates.length === 1) {
			// Change current location to the target.
			const location = candidates[0].location;
			const doc = await workspace.openTextDocument(location.uri);
			commands.executeCommand('editor.action.goToLocations', doc.uri, location.range.start, [], 'goto', '');
		} else {
			// Keep current document open but show alternative location choices.
			const ed = window.activeTextEditor;
			if (ed) {
				commands.executeCommand('editor.action.goToLocations', ed.document.uri, ed.selection.active, candidates.map(c => c.location), 'peek', errorMessage);
			} else {
				return window.showErrorMessage(`Could not follow link target ${symbol} because of no active text editor.`);
			}
		}
	});

	languages.registerHoverProvider([
		{ language: "cpp" }, { language: "h" }
	], new GodotXMLHoverProvider(
		docsParser,
		(name) => xmlCache.findXML(name)),
	);

	workspace.onDidChangeWorkspaceFolders(() => {
		xmlWatcher.recreateWatcher();
	});
}

export function deactivate() { }
