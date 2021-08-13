import { Client, ThreadID, CollectionConfig, Where } from "@textile/hub";
import once from "lodash/once";
import { Adapter, SchemaEntity } from "./store";

type ThreadDBRecord = { _id: string } & Omit<SchemaEntity, "id">;

const toSchemaEntity = ({
  _id: id,
  ...record
}: ThreadDBRecord): SchemaEntity => ({
  id,
  ...record,
});

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

const initClient = once(async () => {
  const threadId = ThreadID.fromString(process.env.THREAD_ID!);
  const client = await Client.withKeyInfo({
    key: process.env.TEXTILE_API_PUBLIC_KEY!,
    secret: process.env.TEXTILE_API_SECRET_KEY!,
  });
  return [client, threadId] as const;
});

export const createAdapter = async (): Promise<Adapter> => {
  const [client, threadId] = await initClient();
  const adapter: Adapter = {
    async findWhereId(id) {
      return client
        .findByID<ThreadDBRecord>(threadId, collectionTitle, id)
        .then(toSchemaEntity)
        .catch(() => null);
    },
    async findWhereEditHash(editHash) {
      const [record] = await client.find<ThreadDBRecord | undefined>(
        threadId,
        collectionTitle,
        new Where("editHash").eq(editHash)
      );
      if (record == null) {
        return null;
      }
      return toSchemaEntity(record);
    },
    async create(params) {
      const [id] = await client.create(threadId, collectionTitle, [
        {
          title: params.title,
          sdl: params.sdl,
          editHash: params.editHash,
          base64YjsModel: params.base64YjsModel,
        },
      ]);
      return id;
    },
    async updateWhereEditHash(editHash, params) {
      const record = await adapter.findWhereEditHash(editHash);
      if (record == null) {
        return false;
      }

      await client.save(threadId, collectionTitle, [
        {
          _id: record.id,
          title: params.title ?? record.title,
          sdl: params.sdl ?? record.sdl,
          base64YjsModel: params.base64YjsModel ?? record.base64YjsModel,
          editHash: record.editHash,
        },
      ]);

      return true;
    },
  };

  return adapter;
};
