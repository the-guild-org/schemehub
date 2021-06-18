import type * as monacoApi from "monaco-editor";
import { SchemaEditor, SchemaEditorProps } from "@theguild/editor";
import React from "react";
import { useMonaco } from "@monaco-editor/react";
import type * as monaco from "monaco-editor/esm/vs/editor/editor.api";

const Editor: React.FC<{
  schema: string;
  onUserSave?: (content: string) => void;
  editorProps?: SchemaEditorProps;
  onEditor: (
    editorModel: monacoApi.editor.IStandaloneCodeEditor,
    api: typeof monaco
  ) => void;
}> = ({ onUserSave, schema, editorProps = {}, onEditor }) => {
  const latestOnUserSave = React.useRef(onUserSave);
  React.useEffect(() => {
    latestOnUserSave.current = onUserSave;
  });

  const monaco = useMonaco();

  return (
    <SchemaEditor
      schema={schema}
      keyboardShortcuts={(editor, monaco) => {
        onEditor(editor, monaco);
        const shortcuts = [];

        shortcuts.push({
          id: "copy-clipboard",
          label: "Save",
          keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_S],
          contextMenuGroupId: "run",
          contextMenuOrder: 1.5,
          run: (editor: any) => {
            if (latestOnUserSave.current) {
              const content = editor.getModel()?.getValue() || "";
              if (content) {
                latestOnUserSave.current(content);
              }
            }
          },
        });

        return shortcuts;
      }}
      {...editorProps}
    />
  );
};

export default Editor;
