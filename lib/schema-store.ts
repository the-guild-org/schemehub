import { Client, ThreadID, CollectionConfig } from "@textile/hub";
import once from "lodash/once";

export const collectionTitle = "GraphQLSchema";

export const schema: CollectionConfig = {
  name: collectionTitle,
  schema: {
    title: collectionTitle,
    type: "object",
    required: ["_id"],
    properties: {
      _id: {
        type: "string",
        description: "The instance's id.",
      },
      editHash: {
        type: "string",
        description: "The hash required for editing the schema",
      },
      title: {
        type: "string",
        description: "The title of the schema.",
      },
      sdl: {
        type: "string",
        description: "The SDL that describes the schema.",
      },
    },
  },
};

export interface GraphQLSchemaEntity {
  _id: string;
  title: string;
  sdl: string;
  editHash: string;
}

const initClient = once(async () => {
  const threadId = ThreadID.fromString(process.env.THREAD_ID!);
  const client = await Client.withKeyInfo({
    key: process.env.TEXTILE_API_PUBLIC_KEY!,
    secret: process.env.TEXTILE_API_SECRET_KEY!,
  });
  return [client, threadId] as const;
});

type SchemaStore = {
  findById(id: string): Promise<null | GraphQLSchemaEntity>;
  findByEditHash(editHash: string): Promise<null | GraphQLSchemaEntity>;
  create(
    id: string,
    title: string,
    sdl: string,
    editHash: string
  ): Promise<Array<string>>;
  save(id: string, title: string, sdl: string): Promise<void>;
};

export const runWithSchemaStore =
  <TArgs extends Array<unknown>, TReturn>(
    handler: (store: SchemaStore, ...args: TArgs) => Promise<TReturn>
  ) =>
  async (...args: TArgs): Promise<TReturn> => {
    const [client, threadId] = await initClient();
    const store: SchemaStore = {
      findById: (id) =>
        client
          .findByID<GraphQLSchemaEntity | null>(threadId, collectionTitle, id)
          .catch(() => null),
      findByEditHash: async (editHash) => {
        const records = await client.find<GraphQLSchemaEntity>(
          threadId,
          collectionTitle,
          {
            // @ts-expect-error: invalid typings :)
            editHash: {
              $eq: editHash,
            },
          }
        );
        // for some reason schemaEntity does not include editHash when it used for querying lol
        return records[0] ? { ...records[0], editHash } : null;
      },
      create: (_id, title, sdl, editHash) =>
        client.create(threadId, collectionTitle, [
          { _id, title, sdl, editHash },
        ]),
      save: (_id, title, sdl) =>
        client.save(threadId, collectionTitle, [{ _id, title, sdl }]),
    };
    return await handler(store, ...args);
  };
