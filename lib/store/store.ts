import { z } from "zod";

export const SchemaEntityModel = z.object({
  id: z.string(),
  title: z.string(),
  sdl: z.string(),
  base64YjsModel: z.string(),
  editHash: z.string(),
});

export const MaybeSchemaEntity = z.nullable(SchemaEntityModel);

export const SchemaEntityId = z.string();

export const SchemaUpdateResult = z.boolean();

export type SchemaEntity = {
  id: string;
  title: string;
  sdl: string;
  base64YjsModel: string;
  editHash: string;
};

export type Adapter = {
  findWhereId(id: string): Promise<null | SchemaEntity>;
  findWhereEditHash(editHash: string): Promise<null | SchemaEntity>;
  create(params: Omit<SchemaEntity, "id">): Promise<string>;
  updateWhereEditHash(
    editHash: string,
    params: Partial<Omit<SchemaEntity, "id" | "editHash">>
  ): Promise<boolean>;
};

export type Store = Adapter;

export const createStore = (adapter: Adapter): Store => ({
  async findWhereId(id) {
    const record: unknown = await adapter.findWhereId(id);
    return MaybeSchemaEntity.parse(record);
  },
  async findWhereEditHash(editHash) {
    const record: unknown = await adapter.findWhereEditHash(editHash);
    return MaybeSchemaEntity.parse(record);
  },
  async create(params) {
    const record: unknown = await adapter.create(params);
    return SchemaEntityId.parse(record);
  },
  async updateWhereEditHash(id, params) {
    const record: unknown = await adapter.updateWhereEditHash(id, params);
    return SchemaUpdateResult.parse(record);
  },
});

export const createRunWithStore =
  (storeLoader: () => Promise<Store>) =>
  <TArgs extends Array<unknown>, TReturn>(
    handler: (store: Store, ...args: TArgs) => Promise<TReturn>
  ) =>
  async (...args: TArgs): Promise<TReturn> => {
    const store = await storeLoader();
    return await handler(store, ...args);
  };
