import { SchemaEditor, SchemaEditorProps } from "@theguild/editor";
import React from "react";

const Editor: React.FC<{
  schema: string;
  onUserSave?: (content: string) => void;
  editorProps?: SchemaEditorProps;
}> = ({ onUserSave, schema, editorProps = {} }) => {
  return (
    <SchemaEditor
      schema={schema}
      keyboardShortcuts={(editor, monaco) => {
        const shortcuts = [];

        if (onUserSave) {
          shortcuts.push({
            id: "copy-clipboard",
            label: "Save",
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_S],
            contextMenuGroupId: "run",
            contextMenuOrder: 1.5,
            run: (editor: any) => {
              const content = editor.getModel()?.getValue() || "";
              if (content) {
                onUserSave(content);
              }
            },
          });
        }

        return shortcuts;
      }}
      {...editorProps}
    />
  );
};

export default Editor;
