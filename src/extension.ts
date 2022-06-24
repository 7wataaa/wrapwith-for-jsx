import { parse } from '@babel/parser';
import { default as traverse, Node, NodePath } from '@babel/traverse';
import * as vscode from 'vscode';

const BALANCE_OUT_COMMAND = 'editor.emmet.action.balanceOut';
const WRAP_WITH_TAG_COMMAND = 'wrapwith-for-jsx.wrapWithTag';

export function activate(context: vscode.ExtensionContext) {
  console.log(
    'Congratulations, your extension "wrapwith-for-jsx" is now active!',
    new Date(Date.now()).toLocaleDateString()
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(WRAP_WITH_TAG_COMMAND, () => {
      vscode.commands.executeCommand(BALANCE_OUT_COMMAND);
    })
  );

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      ['javascriptreact', 'typescriptreact'],
      new TagWraper()
    )
  );
}

class TagWraper implements vscode.CodeActionProvider {
  static alreadyActivateCheckPosition: vscode.Position;

  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
  ];

  public provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range
  ): vscode.CodeAction[] | null {
    if (!['typescriptreact', 'javascriptreact'].includes(document.languageId)) {
      return null;
    }

    const parseResult = this.tryParse(document.getText());

    if (!parseResult) {
      return null;
    }

    const positions = this.findAllJSXElement(parseResult);

    if (!positions || positions.length === 0) {
      return null;
    }

    const wrapWithFix = new vscode.CodeAction(
      'Wrap with ...',
      vscode.CodeActionKind.QuickFix
    );

    wrapWithFix.command = {
      title: 'WRAP_WITH_TAG_COMMAND',
      command: WRAP_WITH_TAG_COMMAND,
    };

    return [wrapWithFix];
  }

  private tryParse(srcText: string) {
    try {
      const ast = parse(srcText, {
        plugins: ['typescript', 'jsx', 'throwExpressions'],
        sourceType: 'unambiguous',
      });

      return ast;
    } catch (e) {
      console.error(e);

      return null;
    }
  }

  private findAllJSXElement(
    programAST: Node | Node[] | null | undefined
  ): { start: number; end: number; path: NodePath }[] {
    if (programAST === null || programAST === undefined) {
      console.error('programASTが空');

      return [];
    }

    const result: { start: number; end: number; path: NodePath }[] = [];

    try {
      traverse(programAST, {
        enter: (path) => {
          if (path.isJSXElement() || path.isJSXFragment()) {
            result.push({
              start: path.node.start ?? -1,
              end: path.node.end ?? -1,
              path: path,
            });
          }
        },
      });
    } catch (e) {
      console.error(e);
    }

    result.sort((prev, next) => {
      const prevCharCount = prev.end - prev.start;
      const nextCharCount = next.end - next.start;
      return prevCharCount - nextCharCount;
    });

    return result;
  }
}
