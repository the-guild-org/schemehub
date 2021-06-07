import { useToast } from "@chakra-ui/react";
import SchemaEditor from "../components/schema-viewer";
import {
  decompressFromEncodedURIComponent,
  compressToEncodedURIComponent,
} from "lz-string";
import { useRouter } from "next/dist/client/router";
import React from "react";

const DEFAULT_SCHEMA = `# Start creating your schema!
type Query {
  ping: Int!
}
`;

const URL_PREFIX = "/#/code/";

export default function Home() {
  const [initialEditorSchema, setInitialSchema] =
    React.useState(DEFAULT_SCHEMA);
  const toast = useToast();
  const route = useRouter();

  React.useEffect(() => {
    if (route.asPath && route.asPath.startsWith(URL_PREFIX)) {
      const compressedHash = route.asPath.replace(URL_PREFIX, "");
      const value = decompressFromEncodedURIComponent(compressedHash);

      if (value) {
        setInitialSchema(value);
      }
    }
  }, []);

  return (
    <SchemaEditor
      editorProps={{
        height: "100vh",
        theme: "vs-dark",
      }}
      schema={initialEditorSchema}
      onUserSave={(content) => {
        const newURL = `${URL_PREFIX}${compressToEncodedURIComponent(
          content.trim()
        )}`;

        window.history.replaceState({}, "", newURL);
        window.navigator.clipboard.writeText(location.href.toString()).then(
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
    />
  );
}
