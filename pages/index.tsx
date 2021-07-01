import * as Y from "yjs";
import type * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import { WebrtcProvider } from "y-webrtc";
import {
  useToast,
  Box,
  Input,
  InputGroup,
  InputLeftAddon,
  Flex,
  Button,
  HStack,
  Heading,
  Spinner,
  Text,
  Center,
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverCloseButton,
  PopoverHeader,
  PopoverBody,
  PopoverArrow,
  VStack,
  IconButton,
} from "@chakra-ui/react";
import { EditIcon } from "@chakra-ui/icons";
import SchemaEditor from "../components/schema-viewer";
import { useRouter } from "next/dist/client/router";
import React from "react";
import { Page } from "../components/common";
import { EnrichedLanguageService } from "@theguild/editor";
import { MonacoBinding } from "../lib/yMonaco";
import { saveSchema } from "../lib/saveSchema";
import { fetchSchema } from "../lib/getSchema";
import { randomHash } from "../lib/randomHash";
import { randomName } from "../lib/randomName";
import { generateRandomHslColor } from "../lib/generateHSLAColors";
import debounce from "lodash/debounce";
import { useBatchedUpdates } from "../lib/hooks/useBatchedUpdates";
import { getFontColorForBackgroundColor } from "../lib/getFontColorForBackgroundColor";
import useMeasure from "react-use-measure";
import { CopyInput } from "../components/CopyInput";

const DEFAULT_SCHEMA = `# Start creating your schema!
type Query {
  ping: Int!
}
`;

const URL_PREFIX = "/#/code/";

export default function Home() {
  const [title, setTitle] = React.useState("");
  const [schemaId, setSchemaId] = React.useState<null | string>(null);
  const [initialEditorSchema, setInitialSchema] = React.useState<string | null>(
    null
  );
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

    return service;
  }, []);

  const batchUpdates = useBatchedUpdates();

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
        batchUpdates(() => {
          setTitle(res.data.title);
          setSchemaId(schemaId);
          setInitialSchema(res.data.sdl);
        });
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

  const providerRef = React.useRef<null | WebrtcProvider>(null);

  const [viewer, setViewer] = React.useState<null | CollaboratorEntity>(null);
  const [collaborators, setCollaborators] =
    React.useState<null | Array<CollaboratorEntity>>(null);

  const connect = (
    api: typeof monaco,
    editor: monaco.editor.IStandaloneCodeEditor
  ) => {
    const ydocument = new Y.Doc();

    const provider = (providerRef.current = new WebrtcProvider(
      `session-${latestSchemaId.current}`,
      ydocument
    ));

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

    provider.awareness.on("change", () => {
      const collaborators: Array<CollaboratorEntity> = [];
      let viewer: CollaboratorEntity | null = null;
      for (const [id, state] of provider.awareness.getStates()) {
        if (
          typeof state?.collaborator?.name !== "string" ||
          typeof state?.collaborator?.color !== "string"
        ) {
          continue;
        }
        const collaborator: CollaboratorEntity = {
          id: String(id),
          name: state.collaborator.name,
          color: state.collaborator.color,
        };
        if (id === provider.awareness.clientID) {
          viewer = collaborator;
          continue;
        }

        collaborators.push({
          id: String(id),
          name: state.collaborator.name,
          color: state.collaborator.color,
        });
      }
      batchUpdates(() => {
        setCollaborators(collaborators);
        setViewer(viewer);
      });
    });
  };

  const saveAndStartCollaborationSession = () => {
    const id = randomHash();
    setSchemaId(id);

    const newURL = `${URL_PREFIX}${id}`;

    latestSchemaId.current = id;

    Promise.all([
      saveSchema(
        id,
        title.trim(),
        editorInterface.current?.editor.getModel()?.getValue() ?? ""
      ),
      window.navigator.clipboard.writeText(location.href.toString()),
    ]).then(
      () => {
        window.history.replaceState({}, "", newURL);
        connect(editorInterface.current!.api, editorInterface.current!.editor);

        toast({
          isClosable: true,
          position: "bottom",
          title: "Sharing link was copied to clipboard",
          status: "info",
        });
      },
      (e: any) => alert(e)
    );
  };

  const saveTaskRef = React.useRef<ReturnType<typeof saveSchema> | null>(null);

  const latestDataRef = React.useRef<{
    schemaId: string;
    title: string;
  } | null>(null);

  React.useEffect(() => {
    latestDataRef.current = schemaId
      ? {
          schemaId,
          title,
        }
      : null;
  });

  const [isSavingCount, setIsSavingCount] = React.useState(0);

  const isSaving = isSavingCount > 0;

  /**
   * Debounced save of the schema
   */
  const [save] = React.useState(() =>
    debounce((value: string) => {
      const provider = providerRef.current;
      if (provider == null || latestDataRef.current === null) {
        return;
      }
      const { schemaId, title } = latestDataRef.current;

      // if we are the client with the lowest id, we persist the changes.
      const [lowestId] = Array.from(provider.awareness.getStates().keys()).sort(
        (a, b) => a - b
      );
      if (lowestId === provider.awareness.clientID) {
        let saveTask = saveTaskRef.current;
        if (saveTask) {
          saveTask.cancel();
        }
        saveTaskRef.current = saveTask = saveSchema(schemaId, title, value);
        saveTask.promise
          .catch((err) => {
            console.log(err);
          })
          .finally(() => {
            setIsSavingCount((count) => count - 1);
          });
        setIsSavingCount((count) => count + 1);
      }
    }, 500)
  );

  const [ref, bounds] = useMeasure();

  return (
    <Page>
      <Flex background="#1E1E1E" minHeight="calc(100vh - 6rem)">
        <Box width="calc(100vw - 250px)" display="flex" flexDirection="column">
          <Flex color="white" p="3" width="100%">
            <HStack maxWidth="500px">
              {schemaId === null ? (
                <>
                  <InputGroup>
                    <InputLeftAddon children="Schema Title" />
                    <Input
                      type="text"
                      value={title}
                      onChange={(ev) => setTitle(ev.target.value)}
                    />
                  </InputGroup>

                  <Box marginLeft="auto">
                    <Button
                      colorScheme="pink"
                      onClick={() => {
                        if (!title.trim()) {
                          alert("Please enter a valid title first!");
                          return;
                        }

                        saveAndStartCollaborationSession();
                      }}
                    >
                      Collaborate
                    </Button>
                  </Box>
                </>
              ) : (
                <>
                  <Heading size="md" flex="1">
                    {title}
                  </Heading>
                </>
              )}
            </HStack>
            {isSaving ? (
              <Center marginLeft="auto">
                <Text as="span" paddingRight="2">
                  Saving
                </Text>
                <Spinner size="sm" />
              </Center>
            ) : null}
          </Flex>
          <Box ref={ref} flex="1">
            {initialEditorSchema ? (
              <React.Suspense fallback={null}>
                <SchemaEditor
                  editorProps={{
                    height: bounds.height,
                    theme: "vs-dark",
                    options: {
                      automaticLayout: true,
                      minimap: {
                        enabled: false,
                      },
                    },
                    sharedLanguageService: languageService,
                    onChange: (value) => {
                      if (value) {
                        save(value);
                      }
                    },
                  }}
                  schema={initialEditorSchema}
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
        </Box>
        {Array.isArray(collaborators) && viewer != null ? (
          <CollaboratorList
            collaborators={collaborators}
            changeName={(name: string) => {
              providerRef.current?.awareness.setLocalStateField(
                "collaborator",
                {
                  name: name,
                  color: viewer.color,
                }
              );
            }}
            viewer={viewer}
            shareUrl={{
              edit: location.href.toString(),
              view: "lel",
            }}
          />
        ) : null}
      </Flex>
      <Box height="3rem" backgroundColor="black" width="100%"></Box>
    </Page>
  );
}

const CollaboratorList = (props: {
  viewer: CollaboratorEntity;
  collaborators: Array<{ id: string; color: string; name: string }>;
  shareUrl: {
    edit: string;
    view: string;
  };
  changeName: (value: string) => void;
}) => (
  <Box
    width="250px"
    display="flex"
    flexDirection="column"
    paddingLeft="1"
    paddingRight="1"
  >
    <Box padding="2">
      <Heading size="md" color="white">
        Collaborators
      </Heading>
    </Box>
    <Box flex="1">
      <CollaboratorBox
        collaborator={props.viewer}
        additionalContent={
          <Popover>
            <PopoverTrigger>
              <IconButton
                marginLeft="auto"
                aria-label="Change Name"
                variant="ghost"
                size="sm"
                color={getFontColorForBackgroundColor(props.viewer.color)}
                icon={<EditIcon />}
              />
            </PopoverTrigger>
            <PopoverContent>
              <PopoverArrow />
              <PopoverCloseButton />
              <PopoverHeader>
                <Heading size="sm" color="white">
                  Edit Name
                </Heading>
              </PopoverHeader>
              <PopoverBody>
                <ChangeNameForm
                  name={props.viewer.name}
                  changeName={props.changeName}
                />
              </PopoverBody>
            </PopoverContent>
          </Popover>
        }
      />
      {props.collaborators.map((collaborator) => (
        <CollaboratorBox key={collaborator.id} collaborator={collaborator} />
      ))}
    </Box>
    <Box paddingTop="2" paddingBottom="4" color="white">
      <Popover>
        <PopoverTrigger>
          <Button colorScheme="pink" width="100%">
            Invite Collaborator
          </Button>
        </PopoverTrigger>
        <PopoverContent>
          <PopoverArrow />
          <PopoverCloseButton />
          <PopoverHeader>
            <Heading size="sm" color="white">
              Invite Collaborators
            </Heading>
          </PopoverHeader>
          <PopoverBody>
            <VStack spacing="2">
              <Text>
                You can either invite a collaborator as an editor or viewer.
              </Text>
              <Box>
                <Text mb="4px" fontWeight="bold">
                  Write
                </Text>
                <CopyInput defaultValue={props.shareUrl.edit} readOnly />
              </Box>
              <Box>
                <Text mb="4px" fontWeight="bold">
                  Read
                </Text>
                <CopyInput defaultValue={props.shareUrl.view} readOnly />
              </Box>
            </VStack>
          </PopoverBody>
        </PopoverContent>
      </Popover>
    </Box>
  </Box>
);

const CollaboratorBox = (props: {
  collaborator: CollaboratorEntity;
  additionalContent?: React.ReactElement;
}) => {
  return (
    <Box
      backgroundColor={props.collaborator.color}
      color={getFontColorForBackgroundColor(props.collaborator.color)}
      key={props.collaborator.id}
      paddingLeft="2"
      paddingRight="2"
      paddingTop="1"
      paddingBottom="1"
      borderRadius="5px"
      marginBottom="1"
      marginLeft="2"
      marginRight="2"
      display="flex"
      alignItems="center"
    >
      {props.collaborator.name}
      {props.additionalContent}
    </Box>
  );
};

type CollaboratorEntity = {
  id: string;
  name: string;
  color: string;
};

const ChangeNameForm = (props: {
  name: string;
  changeName: (name: string) => void;
}) => {
  return (
    <VStack
      as="form"
      onSubmit={(ev) => {
        ev.preventDefault();
        const newName = (ev.target as any).nameInput.value.trim();
        if (newName === "") {
          return;
        }
        props.changeName(newName);
      }}
    >
      <Input color="white" defaultValue={props.name} id="nameInput" />
      <Button type="submit" size="sm" colorScheme="pink" width="100%">
        Save
      </Button>
    </VStack>
  );
};
