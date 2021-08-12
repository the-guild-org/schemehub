import * as Y from "yjs";
import * as error from "lib0/error";
import { createMutex, mutex } from "lib0/mutex";
import type * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import type { Awareness } from "y-protocols/awareness";
import { getFontColorForBackgroundColor } from "./getFontColorForBackgroundColor";
import { transparentize } from "polished";

const isWindows =
  typeof window !== "undefined" &&
  window.navigator.platform.toUpperCase().indexOf("WIN") > -1;

class RelativeSelection {
  start: Y.RelativePosition;
  end: Y.RelativePosition;
  direction: monaco.SelectionDirection;

  constructor(
    start: Y.RelativePosition,
    end: Y.RelativePosition,
    direction: monaco.SelectionDirection
  ) {
    this.start = start;
    this.end = end;
    this.direction = direction;
  }
}

const createRelativeSelection = (
  editor: monaco.editor.IStandaloneCodeEditor,
  monacoModel: monaco.editor.ITextModel,
  type: Y.Text
): null | RelativeSelection => {
  const sel = editor.getSelection();
  if (sel !== null) {
    const startPos = sel.getStartPosition();
    const endPos = sel.getEndPosition();
    const start = Y.createRelativePositionFromTypeIndex(
      type,
      monacoModel.getOffsetAt(startPos)
    );
    const end = Y.createRelativePositionFromTypeIndex(
      type,
      monacoModel.getOffsetAt(endPos)
    );
    return new RelativeSelection(start, end, sel.getDirection());
  }
  return null;
};

const createMonacoSelectionFromRelativeSelection = (
  editor: monaco.editor.IEditor,
  type: Y.Text,
  relSel: RelativeSelection,
  doc: Y.Doc,
  api: typeof monaco
): null | monaco.Selection => {
  const start = Y.createAbsolutePositionFromRelativePosition(relSel.start, doc);
  const end = Y.createAbsolutePositionFromRelativePosition(relSel.end, doc);
  if (
    start !== null &&
    end !== null &&
    start.type === type &&
    end.type === type
  ) {
    const model = editor.getModel() as monaco.editor.ITextModel;
    const startPos = model.getPositionAt(start.index);
    const endPos = model.getPositionAt(end.index);
    return api.Selection.createWithDirection(
      startPos.lineNumber,
      startPos.column,
      endPos.lineNumber,
      endPos.column,
      relSel.direction
    );
  }
  return null;
};

class RemoteCursorWidget implements monaco.editor.IContentWidget {
  id: string;
  tooltip: HTMLElement;
  position: monaco.editor.IContentWidgetPosition;

  constructor(
    id: string,
    lineHeight: number,
    name: string,
    color: string,
    position: monaco.editor.IContentWidgetPosition
  ) {
    this.id = id;

    const tooltip = (this.tooltip = document.createElement("div"));
    tooltip.className = "monaco-remote-cursor";
    tooltip.style.background = color;
    tooltip.style.color = getFontColorForBackgroundColor(color);
    tooltip.style.height = `${lineHeight}px`;
    // uncomment this to show names next to cursor
    tooltip.style.display = "none";
    tooltip.innerHTML = name;
    this.position = position;
  }

  getId() {
    return this.id;
  }

  getDomNode() {
    return this.tooltip;
  }

  getPosition() {
    return this.position;
  }
}

export class MonacoBinding {
  api: typeof monaco;
  doc: Y.Doc;
  ytext: Y.Text;
  monacoModel: monaco.editor.ITextModel;
  editors: Set<monaco.editor.IStandaloneCodeEditor>;
  mux: mutex;
  awareness?: Awareness;

  private _savedSelections: Map<
    monaco.editor.IStandaloneCodeEditor,
    RelativeSelection
  >;
  private _beforeTransaction: () => void;
  private _decorations: Map<monaco.editor.IStandaloneCodeEditor, Array<string>>;

  private _collaboratorTooltips: Map<
    monaco.editor.IStandaloneCodeEditor,
    Array<monaco.editor.IContentWidget>
  >;

  private _rerenderDecorations: () => void;
  private _monacoChangeHandler: monaco.IDisposable;
  private _ytextObserver: any;

  constructor(
    api: typeof monaco,
    ytext: Y.Text,
    monacoModel: monaco.editor.ITextModel,
    editors: Set<monaco.editor.IStandaloneCodeEditor> = new Set(),
    awareness: Awareness
  ) {
    this.api = api;
    this.doc = ytext.doc!;
    this.ytext = ytext;
    this.monacoModel = monacoModel;
    this.editors = editors;
    this.mux = createMutex();
    /**
     * @type {Map<monaco.editor.IStandaloneCodeEditor, RelativeSelection>}
     */
    this._savedSelections = new Map();
    this._beforeTransaction = () => {
      this.mux(() => {
        this._savedSelections = new Map();
        editors.forEach((editor) => {
          if (editor.getModel() === monacoModel) {
            const rsel = createRelativeSelection(editor, monacoModel, ytext);
            if (rsel !== null) {
              this._savedSelections.set(editor, rsel);
            }
          }
        });
      });
    };

    this.doc.on("beforeAllTransactions", this._beforeTransaction);
    this._decorations = new Map();
    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    window.document.head.append(styleSheet);

    let lastCacheCursorCache = ``;
    this._rerenderDecorations = () => {
      const cursorInformation = new Map<number, string>();
      editors.forEach((editor) => {
        if (awareness && editor.getModel() === monacoModel) {
          this._collaboratorTooltips.get(editor)?.forEach((item) => {
            editor.removeContentWidget(item);
          });

          const lineHeight = editor.getOption(
            this.api.editor.EditorOption.lineHeight
          );

          // render decorations
          const currentDecorations = this._decorations.get(editor) || [];
          const newDecorations: Array<monaco.editor.IModelDeltaDecoration> = [];
          const tooltips: Array<monaco.editor.IContentWidget> = [];

          awareness.getStates().forEach((state, clientID) => {
            if (
              clientID !== this.doc.clientID &&
              state.selection != null &&
              state.selection.anchor != null &&
              state.selection.head != null
            ) {
              const anchorAbs = Y.createAbsolutePositionFromRelativePosition(
                state.selection.anchor,
                this.doc
              );
              const headAbs = Y.createAbsolutePositionFromRelativePosition(
                state.selection.head,
                this.doc
              );
              if (
                anchorAbs !== null &&
                headAbs !== null &&
                anchorAbs.type === ytext &&
                headAbs.type === ytext
              ) {
                let start, end, afterContentClassName, beforeContentClassName;
                if (anchorAbs.index < headAbs.index) {
                  start = monacoModel.getPositionAt(anchorAbs.index);
                  end = monacoModel.getPositionAt(headAbs.index);
                  afterContentClassName = `yRemoteSelectionHead yRemoteSelectionHead-${clientID}`;
                  beforeContentClassName = null;
                } else {
                  start = monacoModel.getPositionAt(headAbs.index);
                  end = monacoModel.getPositionAt(anchorAbs.index);
                  afterContentClassName = null;
                  beforeContentClassName = `yRemoteSelectionHead yRemoteSelectionHead-${clientID}`;
                }
                const range = new this.api.Range(
                  start.lineNumber,
                  start.column,
                  end.lineNumber,
                  end.column
                );
                newDecorations.push({
                  range,
                  options: {
                    className: `yRemoteSelection yRemoteSelection-${clientID}`,
                    afterContentClassName,
                    beforeContentClassName,
                  },
                });
                cursorInformation.set(clientID, state?.collaborator?.color);
                const tooltipWidget = new RemoteCursorWidget(
                  String(clientID),
                  lineHeight,
                  state.collaborator?.name ?? "Ano Nym",
                  state.collaborator?.color ?? "#fff",
                  {
                    position: null,
                    range,
                    preference: [
                      this.api.editor.ContentWidgetPositionPreference.ABOVE,
                    ],
                  }
                );

                tooltips.push(tooltipWidget);
                editor.addContentWidget(tooltipWidget);
              }
            }
          });

          const cacheKey = Array.from(cursorInformation.keys())
            .sort((a, b) => a - b)
            .join("_");

          if (cacheKey !== lastCacheCursorCache) {
            for (const child of styleSheet.childNodes) {
              styleSheet.removeChild(child);
            }

            let cursorStyles = "";

            for (const [clientId, color] of cursorInformation) {
              cursorStyles += `
.yRemoteSelectionHead-${clientId}::after { border-color: ${color}; }
.yRemoteSelectionHead-${clientId} { border-color: ${color}; }
.yRemoteSelection-${clientId} { background-color: ${transparentize(
                0.7,
                color
              )}; }
            `;
            }

            styleSheet.append(document.createTextNode(cursorStyles));
            lastCacheCursorCache = cacheKey;
          }

          this._decorations.set(
            editor,
            editor.deltaDecorations(currentDecorations, newDecorations)
          );

          this._collaboratorTooltips.set(editor, tooltips);
        } else {
          // ignore decorations
          this._decorations.delete(editor);
        }
      });
    };
    this._ytextObserver = (event: any) => {
      this.mux(() => {
        // ensure we are always operating on the same line endings
        // https://github.com/yjs/y-monaco/issues/6#issuecomment-872951039
        monacoModel.setEOL(this.api.editor.EndOfLineSequence.LF);

        let index = 0;
        event.delta.forEach((op: any) => {
          if (op.retain !== undefined) {
            index += op.retain;
          } else if (op.insert !== undefined) {
            const pos = monacoModel.getPositionAt(index);
            const range = new this.api.Selection(
              pos.lineNumber,
              pos.column,
              pos.lineNumber,
              pos.column
            );
            monacoModel.applyEdits([{ range, text: op.insert }]);
            index += op.insert.length;
          } else if (op.delete !== undefined) {
            const pos = monacoModel.getPositionAt(index);
            const endPos = monacoModel.getPositionAt(index + op.delete);
            const range = new this.api.Selection(
              pos.lineNumber,
              pos.column,
              endPos.lineNumber,
              endPos.column
            );
            monacoModel.applyEdits([{ range, text: "" }]);
          } else {
            throw error.unexpectedCase();
          }
        });
        this._savedSelections.forEach((rsel, editor) => {
          const sel = createMonacoSelectionFromRelativeSelection(
            editor,
            ytext,
            rsel,
            this.doc,
            this.api
          );
          if (sel !== null) {
            editor.setSelection(sel);
          }
        });
      });
      this._rerenderDecorations();
    };
    ytext.observe(this._ytextObserver);
    const value = monacoModel.getValue();

    if (value !== ytext.toString()) {
      monacoModel.setValue(ytext.toString());
    }

    this._monacoChangeHandler = monacoModel.onDidChangeContent((event) => {
      // apply changes from right to left
      this.mux(() => {
        this.doc.transact(() => {
          event.changes
            .sort(
              (change1, change2) => change2.rangeOffset - change1.rangeOffset
            )
            .forEach((change) => {
              ytext.delete(change.rangeOffset, change.rangeLength);
              ytext.insert(change.rangeOffset, change.text);
            });
        }, this);
      });
    });
    monacoModel.onWillDispose(() => {
      this.destroy();
    });
    this._collaboratorTooltips = new Map();

    editors.forEach((editor) => {
      editor.onDidChangeCursorSelection(() => {
        if (editor.getModel() === monacoModel) {
          const sel = editor.getSelection();
          if (sel === null) {
            return;
          }
          const startPosition = sel.getStartPosition();
          const endPosition = sel.getEndPosition();
          let anchor =
            monacoModel.getOffsetAt(startPosition) +
            (!isWindows ? 0 : startPosition.lineNumber - 1);
          let head =
            monacoModel.getOffsetAt(endPosition) -
            (!isWindows
              ? endPosition.lineNumber - startPosition.lineNumber
              : 0);
          if (sel.getDirection() === this.api.SelectionDirection.RTL) {
            const tmp = anchor;
            anchor = head;
            head = tmp;
          }
          awareness.setLocalStateField("selection", {
            anchor: Y.createRelativePositionFromTypeIndex(ytext, anchor),
            head: Y.createRelativePositionFromTypeIndex(ytext, head),
          });
        }
      });
      awareness.on("change", this._rerenderDecorations);
    });
    this.awareness = awareness;
  }

  destroy() {
    this._monacoChangeHandler.dispose();
    this.ytext.unobserve(this._ytextObserver);
    this.doc.off("beforeAllTransactions", this._beforeTransaction);
    if (this.awareness != null) {
      this.awareness.off("change", this._rerenderDecorations);
    }
  }
}
