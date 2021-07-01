import * as Y from "yjs";
import type * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import { WebrtcProvider } from "y-webrtc";
import { useToast, Box } from "@chakra-ui/react";
import SchemaEditor from "../components/schema-viewer";
import { useRouter } from "next/dist/client/router";
import React from "react";
import { Page } from "../components/common";
import { EnrichedLanguageService } from "@theguild/editor";
import { buildSchema, GraphQLSchema } from "graphql";
import { MonacoBinding } from "../lib/yMonaco";
import { saveSchema } from "../lib/saveSchema";
import { fetchSchema } from "../lib/getSchema";
import { randomHash } from "../lib/randomHash";
import { randomName } from "../lib/randomName";
import { generateRandomHslColor } from "../lib/generateHSLAColors";

const DEFAULT_SCHEMA = `# Start creating your schema!
type Query {
  ping: Int!
}
`;

const URL_PREFIX = "/#/code/";

export default function Home() {
  const [schemaId, setSchemaId] = React.useState<null | string>(null);
  const [initialEditorSchema, setInitialSchema] = React.useState<string | null>(
    null
  );
  const [schema, setSchema] = React.useState<GraphQLSchema | null>(null);
  const toast = useToast();
  const route = useRouter();

  const languageService = React.useMemo(() => {
    const service = new EnrichedLanguageService({
      schemaString: initialEditorSchema ?? "",
      schemaConfig: {
        buildSchemaOptions: {
          assumeValid: true,
          assumeValidSDL: true,
        },
      },
    });

    const originalTry = service.trySchema;

    service.trySchema = async (schema) => {
      originalTry.call(service, schema);
      return service.getSchema().then((schema) => {
        if (schema) {
          setSchema(schema);
        }
        return schema;
      });
    };

    return service;
  }, []);

  React.useEffect(() => {
    if (route.asPath && route.asPath.startsWith(URL_PREFIX)) {
      const schemaId = route.asPath.replace(URL_PREFIX, "");
      const value = schemaId;
      if (value == null) {
        return;
      }
      fetchSchema(value).then((res) => {
        if ("error" in res) {
          console.error(res.error);
          return;
        }

        setSchemaId(schemaId);
        setInitialSchema(res.data.sdl);
        setSchema(buildSchema(res.data.sdl));
      });
    } else {
      setInitialSchema(DEFAULT_SCHEMA);
    }
  }, []);

  const latestSchemaId = React.useRef(schemaId);
  React.useEffect(() => {
    latestSchemaId.current = schemaId;
  });

  const editorInterface = React.useRef<null | {
    editor: monaco.editor.IStandaloneCodeEditor;
    api: typeof monaco;
  }>(null);

  const connect = (
    api: typeof monaco,
    editor: monaco.editor.IStandaloneCodeEditor
  ) => {
    const ydocument = new Y.Doc();

    const provider = new WebrtcProvider(
      `session-${latestSchemaId.current}`,
      ydocument
    );

    const getCollaboratorName = () => {
      let name = window.localStorage.getItem("collaboratorName");
      if (name == null) {
        name = randomName();
        window.localStorage.setItem("collaboratorName", name);
      }
      return name;
    };
    provider.awareness.setLocalStateField("collaborator", {
      name: getCollaboratorName(),
      color: generateRandomHslColor(),
    });
    new MonacoBinding(
      api,
      ydocument.getText("monaco"),
      editor.getModel() as any,
      new Set([editor]),
      provider.awareness
    );
    console.log(editor.getValue());
  };

  return (
    <Page>
      <Box overflow={"hidden"}>
        {initialEditorSchema ? (
          <React.Suspense fallback={null}>
            <SchemaEditor
              editorProps={{
                height: "84vh",
                theme: "vs-dark",
                options: {
                  automaticLayout: true,
                  minimap: {
                    enabled: false,
                  },
                },
                sharedLanguageService: languageService,
              }}
              schema={initialEditorSchema}
              onUserSave={async (content) => {
                let id = latestSchemaId.current;
                if (id == null) {
                  id = randomHash();
                  setSchemaId(id);

                  const newURL = `${URL_PREFIX}${id}`;

                  window.history.replaceState({}, "", newURL);
                  latestSchemaId.current = id;
                  connect(
                    editorInterface.current!.api,
                    editorInterface.current!.editor
                  );
                }
                Promise.all([
                  saveSchema(id, content),
                  window.navigator.clipboard.writeText(
                    location.href.toString()
                  ),
                ]).then(
                  () => {
                    toast({
                      isClosable: true,
                      position: "bottom",
                      title: "Sharing link was copied to clipboard",
                      status: "info",
                    });
                  },
                  (e: any) => alert(e)
                );
              }}
              onEditor={(editor, api) => {
                editorInterface.current = {
                  editor,
                  api,
                };
                if (latestSchemaId.current) {
                  setTimeout(() => {
                    connect(api, editor);
                  });
                }
              }}
            />
          </React.Suspense>
        ) : null}
      </Box>
    </Page>
  );
}
