import * as vscode from 'vscode';
import { parse } from '@babel/parser';
import { default as traverse, NodePath, Node } from '@babel/traverse';
import type {
  JSXElement,
  JSXFragment,
  ArrowFunctionExpression,
  BlockStatement,
  ReturnStatement,
} from '@babel/types';
import {
  isJSXElement,
  isJSXFragment,
  isArrowFunctionExpression,
  isBlockStatement,
  isReturnStatement,
} from '@babel/types';

const BALANCE_OUT_COMMAND = 'editor.emmet.action.balanceOut';
const WRAP_WITH_TAG_COMMAND = 'wrapwith-for-jsx.wrapWithTag';

export function activate(context: vscode.ExtensionContext) {
  console.log(
    'Congratulations, your extension "wrapwith-for-jsx" is now active!',
    new Date(Date.now()).toLocaleDateString()
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(WRAP_WITH_TAG_COMMAND, () => {
      vscode.window.showInformationMessage('WRAP_WITH_TAG_COMMAND');
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
    if (!this.showQuickFix(document)) {
      return null;
    }

    // 何も選択されていない状態と選択されている状態とで処理を分ける

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

  private showQuickFix(document: vscode.TextDocument): boolean {
    const isTypeScriptReact = document.languageId === 'typescriptreact';
    const isJavaScriptReact = document.languageId === 'javascriptreact';

    if (!isTypeScriptReact && !isJavaScriptReact) {
      return false;
    }

    const parseResult = this.tryParse(document.getText());

    if (!parseResult) {
      return false;
    }

    const positions = this.findAllJSXElementPosition(
      parseResult,
      new SearchQue()
    );

    console.log('positions: ', positions);

    return true;
  }

  private tryParse(srcText: string) {
    try {
      const ast = parse(srcText, {
        plugins: ['typescript', 'jsx', 'throwExpressions'],
        sourceType: 'unambiguous',
      });

      return ast;
    } catch (e) {
      console.log('=========ERROR=========');
      console.error(e);

      return null;
    }
  }

  private findAllJSXElementPosition(
    programAST: Node | Node[] | null | undefined,
    que: SearchQue
  ): { start: number; end: number }[] {
    if (programAST === null || programAST === undefined) {
      console.error('programASTが空');

      return [];
    }

    try {
      traverse(programAST, {
        enter: (path) => {
          if (
            path.isJSXElement() ||
            path.isJSXFragment() ||
            path.isArrowFunctionExpression() ||
            path.isBlockStatement() ||
            path.isReturnStatement()
            // TODO classへの対応
          ) {
            que.push(path);
          }
        },
      });
    } catch (e) {
      console.error(e);
    }

    console.log('que: ', que.length());

    const result: { start: number; end: number; path: NodePath }[] = [];

    while (que.length() > 0) {
      const e = que.pop();

      if (e.isJSXElement() || e.isJSXFragment()) {
        result.push({
          start: e.node.start ?? -1,
          end: e.node.end ?? -1,
          path: e,
        });
      } else if (isArrowFunctionExpression(e)) {
      } else if (isBlockStatement(e)) {
      }
    }

    return result;
  }
}

class SearchQue {
  private data: (
    | NodePath<JSXElement>
    | NodePath<JSXFragment>
    | NodePath<ArrowFunctionExpression>
    | NodePath<BlockStatement>
    | NodePath<ReturnStatement>
  )[] = [];

  public length() {
    return this.data.length;
  }

  public push(
    item:
      | NodePath<JSXElement>
      | NodePath<JSXFragment>
      | NodePath<ArrowFunctionExpression>
      | NodePath<BlockStatement>
      | NodePath<ReturnStatement>
  ) {
    this.data.push(item);
  }

  public pop() {
    const front = this.data.shift();

    if (!front) {
      throw new Error('Queueが空です');
    }

    return front;
  }
}
