import { SchemaEditor, SchemaEditorProps } from "@theguild/editor";
import React from "react";

const Editor: React.FC<{
  schema: string;
  onUserSave?: (content: string) => void;
  editorProps?: SchemaEditorProps;
}> = ({ onUserSave, schema, editorProps = {} }) => {
  const latestOnUserSave = React.useRef(onUserSave);
  React.useEffect(() => {
    latestOnUserSave.current = onUserSave;
  });

  return (
    <SchemaEditor
      schema={schema}
      keyboardShortcuts={(editor, monaco) => {
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
