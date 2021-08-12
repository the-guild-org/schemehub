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
      base64YjsModel: {
        type: "string",
        description: "The YJS Model encoded as a base64 string.",
      },
    },
  },
};

export interface GraphQLSchemaEntity {
  _id: string;
  title: string;
  sdl: string;
  editHash: string;
  base64YjsModel: string;
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
    editHash: string,
    base64YjsModel: string
  ): Promise<Array<string>>;
  save(
    id: string,
    title: string,
    sdl: string,
    base64Model: string,
    editHash: string
  ): Promise<void>;
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
        // SO yeah I cannot figure out how where conditions work and now need to wai until anyone responds on the Textile.io slack
        // a great workaround (not) is to load all records and then filter them in JS :)
        const allRecords = await client.find<GraphQLSchemaEntity>(
          threadId,
          collectionTitle,
          {}
        );

        const record = allRecords.find(
          (record) => record.editHash === editHash
        );
        // for some reason schemaEntity does not include editHash when it used for querying lol Textile.io why
        return record ? ({ ...record, editHash } as any) : null;
      },
      create: (_id, title, sdl, editHash, base64YjsModel) =>
        client.create(threadId, collectionTitle, [
          { _id, title, sdl, editHash, base64YjsModel },
        ]),
      save: (_id, title, sdl, base64YjsModel, editHash) =>
        client.save(threadId, collectionTitle, [
          { _id, title, sdl, base64YjsModel, editHash },
        ]),
    };
    return await handler(store, ...args);
  };
