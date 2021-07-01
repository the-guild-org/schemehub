import { JSONSchema, ThreadID } from "@textile/threaddb";
import { Client } from "@textile/threads-client";
import once from "lodash/once";

export const collectionTitle = "GraphQLSchema";

export const schema: JSONSchema = {
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
      description: "The hash required for editing/saving the schema",
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
};

export interface GraphQLSchema {
  _id: string;
  title: string;
  sdl: string;
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
  findById(id: string): Promise<undefined | null | GraphQLSchema>;
  create(id: string, sdl: string): Promise<Array<string>>;
  save(id: string, sdl: string): Promise<void>;
};

export const runWithSchemaStore =
  <TArgs extends Array<unknown>, TReturn>(
    handler: (store: SchemaStore, ...args: TArgs) => Promise<TReturn>
  ) =>
  async (...args: TArgs): Promise<TReturn> => {
    const [client, threadId] = await initClient();
    const store: SchemaStore = {
      findById: (id) => client.findByID(threadId, collectionTitle, id),
      create: (_id, sdl) =>
        client.create(threadId, collectionTitle, [{ _id, sdl }]),
      save: (_id, sdl) =>
        client.save(threadId, collectionTitle, [{ _id, sdl }]),
    };
    return await handler(store, ...args);
  };
