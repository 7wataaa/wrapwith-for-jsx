import { parse } from '@babel/parser';
import { default as traverse, Node, NodePath } from '@babel/traverse';
import { isJSXElement, isJSXFragment } from '@babel/types';
import * as vscode from 'vscode';

const WRAP_WITH_TAG_COMMAND = 'wrapwith-for-jsx.wrapWithTag';

const snippetStr = (targetJSXStr: string) => `<$1$0>\n  ${targetJSXStr}\n</$1>`;

export function activate(context: vscode.ExtensionContext) {
  console.log(
    'Congratulations, your extension "wrapwith-for-jsx" is now active!!!',
    `${new Date(Date.now()).getMinutes()}:${new Date(Date.now()).getSeconds()}`
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(WRAP_WITH_TAG_COMMAND, (...args) => {
      const nodePath = args[0];

      if (isJSXFragment(nodePath) || isJSXElement(nodePath)) {
        const editor = vscode.window.activeTextEditor;

        if (!editor) {
          return;
        }

        const loc = (nodePath as any).node.loc;

        if (!loc) {
          return;
        }

        // ターゲットのJSXを削除し､(それを含める)新しいスニペットを作成･起動する

        editor
          .edit(
            (editBuilder) => {
              const deleteRange = new vscode.Range(
                new vscode.Position(loc.start.line - 1, loc.start.column),
                new vscode.Position(loc.end.line - 1, loc.end.column)
              );

              editBuilder.delete(deleteRange);
            },
            {
              undoStopBefore: true,
              undoStopAfter: false,
            }
          )
          .then(
            () => {
              const wrapWithTagSnippet = new vscode.SnippetString(
                snippetStr(`${nodePath}`)
              );

              editor.insertSnippet(wrapWithTagSnippet, undefined, {
                undoStopBefore: false,
                undoStopAfter: true,
              });
            },
            (reason) => {
              console.error(reason);
            }
          );
      }
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
      console.warn(`languageId not supported. (${document.languageId})`);
      return null;
    }

    const parseResult = this.tryParse(document.getText());

    if (!parseResult) {
      return null;
    }

    const jsxPositions = this.findAllJSXElement(parseResult);

    if (!jsxPositions || jsxPositions.length === 0) {
      return null;
    }

    let targetJSX = this.findTargetJSX(jsxPositions);

    if (!targetJSX) {
      return null;
    }

    const wrapWithFix = new vscode.CodeAction(
      'Wrap with ...',
      vscode.CodeActionKind.QuickFix
    );

    wrapWithFix.command = {
      title: 'WRAP_WITH_TAG_COMMAND',
      command: WRAP_WITH_TAG_COMMAND,
      arguments: [targetJSX],
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
  ): { start: vscode.Position; end: vscode.Position; path: NodePath }[] {
    if (programAST === null || programAST === undefined) {
      console.error('programASTが空');

      return [];
    }

    const result: {
      start: vscode.Position;
      end: vscode.Position;
      path: NodePath;
    }[] = [];

    try {
      traverse(programAST, {
        enter: (path) => {
          if (path.isJSXElement()) {
            result.push({
              start: new vscode.Position(
                path.node.loc?.start.line ?? -1,
                path.node.loc?.start.column ?? -1
              ),
              end: new vscode.Position(
                path.node.loc?.end.line ?? -1,
                path.node.loc?.end.column ?? -1
              ),
              path: path,
            });
          } else if (path.isJSXFragment()) {
            result.push({
              start: new vscode.Position(
                path.node.loc?.start.line ?? -1,
                path.node.loc?.start.column ?? -1
              ),
              end: new vscode.Position(
                path.node.loc?.end.line ?? -1,
                path.node.loc?.end.column ?? -1
              ),
              path: path,
            });
          }
        },
      });
    } catch (e) {
      console.error(e);
    }

    result.sort((prev, next) => {
      const prevCharCount = prev.end.character - prev.start.character;
      const nextCharCount = next.end.character - next.start.character;
      return prevCharCount - nextCharCount;
    });

    return result;
  }

  private findTargetJSX(
    positions: {
      start: vscode.Position;
      end: vscode.Position;
      path: NodePath;
    }[]
  ) {
    const editor = vscode.window.activeTextEditor;

    if (editor && editor.selection.isEmpty) {
      const cursorPosition = editor.selection.active;

      // 囲む対象のJSXを指定する
      const targetJSX =
        positions.find((e) => {
          const startLineValid =
            e.start.line === cursorPosition.line + 1 &&
            e.start.character <= cursorPosition.character;

          const endLineValid =
            e.end.line === cursorPosition.line + 1 &&
            cursorPosition.character <= e.end.character;

          return startLineValid || endLineValid;
        })?.path ?? null;

      if (
        targetJSX &&
        (targetJSX.isJSXElement() || targetJSX.isJSXFragment())
      ) {
        return targetJSX;
      }
    }

    return null;
  }
}
