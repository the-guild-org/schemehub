import { useToast, SimpleGrid, Box } from "@chakra-ui/react";
import SchemaEditor from "../components/schema-viewer";
import { useRouter } from "next/dist/client/router";
import React from "react";
import { Page } from "../components/common";
import { EnrichedLanguageService } from "@theguild/editor";
import ReactFlow, {
  ReactFlowProvider,
  isNode,
  Node,
  Position,
  Connection,
  Elements,
  Edge,
  MiniMap,
  Controls,
} from "react-flow-renderer";
import dagre from "dagre";
import {
  buildSchema,
  GraphQLNamedType,
  GraphQLOutputType,
  GraphQLSchema,
  isInterfaceType,
  isIntrospectionType,
  isListType,
  isNonNullType,
  isObjectType,
  isScalarType,
} from "graphql";
import { saveSchema } from "../lib/saveSchema";
import { fetchSchema } from "../lib/getSchema";
import { randomHash } from "../lib/randomHash";

const DEFAULT_SCHEMA = `# Start creating your schema!
type Query {
  ping: Int!
}
`;

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 400;
const nodeHeight = 80;

const getLayoutedElements = (elements: Elements, direction = "TB") => {
  const isHorizontal = direction === "LR";
  dagreGraph.setGraph({ rankdir: direction });

  elements.forEach((el: Node | Connection | Edge) => {
    if (isNode(el)) {
      dagreGraph.setNode(el.id, { width: nodeWidth, height: nodeHeight });
    } else {
      dagreGraph.setEdge(el.source as any, el.target as any);
    }
  });

  dagre.layout(dagreGraph);

  return elements.map((el: any) => {
    if (isNode(el)) {
      const nodeWithPosition = dagreGraph.node(el.id);
      el.targetPosition = isHorizontal ? Position.Left : Position.Top;
      el.sourcePosition = isHorizontal ? Position.Right : Position.Bottom;

      // unfortunately we need this little hack to pass a slightly different position
      // to notify react flow about the change. Moreover we are shifting the dagre node position
      // (anchor=center center) to the top left so it matches the react flow node anchor point (top left).
      el.position = {
        x: nodeWithPosition.x - nodeWidth / 2 + Math.random() / 1000,
        y: nodeWithPosition.y - nodeHeight / 2,
      };
    }

    return el;
  });
};

function unwrapType(t: GraphQLOutputType): GraphQLNamedType {
  if (isNonNullType(t)) {
    return unwrapType(t.ofType);
  }

  if (isListType(t)) {
    return unwrapType(t.ofType);
  }

  return t;
}

function createFromSchema(schema: GraphQLSchema): Elements {
  const result: Elements = [];
  const types = schema.getTypeMap();

  for (const [typeName, type] of Object.entries(types)) {
    if (isScalarType(type) || isIntrospectionType(type)) {
      continue;
    }

    result.push({
      id: typeName,
      data: {
        label: typeName,
      },
      position: { x: 0, y: 0 },
    });

    if (isObjectType(type) || isInterfaceType(type)) {
      const fields = type.getFields();

      for (const [fieldName, field] of Object.entries(fields)) {
        const baseType = unwrapType(field.type);

        if (isScalarType(baseType) || isIntrospectionType(baseType)) {
          continue;
        }

        result.push({
          id: `${typeName}.${fieldName}`,
          source: typeName,
          label: `${fieldName}: ${field.type.toString()}`,
          target: baseType.name,
          sourceHandle: `${typeName}.${fieldName}`,
          animated: true,
        });
      }
    }
  }

  return getLayoutedElements(result);
}

const URL_PREFIX = "/#/code/";

export default function Home() {
  const [schemaId, setSchemaId] = React.useState<null | string>(null);
  const [initialEditorSchema, setInitialSchema] =
    React.useState<string | null>(null);
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

    service.trySchema = (schema) => {
      originalTry.call(service, schema);
      service.getSchema().then((schema) => {
        if (schema) {
          setSchema(schema);
        }
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

  const [elements, setElements] = React.useState<Elements>([]);

  React.useEffect(() => {
    if (languageService && schema) {
      const elements = createFromSchema(schema);
      setElements(elements);
    }
  }, [schema, languageService]);

  const latestSchemaId = React.useRef(schemaId);
  React.useEffect(() => {
    latestSchemaId.current = schemaId;
  });

  return (
    <Page>
      <SimpleGrid columns={2} spacing={4} p={8} background={"black"}>
        <Box border="1px solid #E535AB" borderRadius={6} overflow={"hidden"}>
          {initialEditorSchema ? (
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
            />
          ) : null}
        </Box>
        <Box
          border="1px solid #E535AB"
          borderRadius={6}
          overflow={"hidden"}
          p={4}
        >
          <ReactFlowProvider>
            <ReactFlow
              elements={elements}
              nodesDraggable={false}
              style={{ width: "100%", height: "80vh" }}
            >
              <MiniMap />
              <Controls />
            </ReactFlow>
          </ReactFlowProvider>
        </Box>
      </SimpleGrid>
    </Page>
  );
}
