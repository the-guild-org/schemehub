import { Adapter, SchemaEntity } from "./store";
import faunadb from "faunadb";

export const collectionName = "schemaEntities";

const toSchemaEntity = ({ ref: { id }, data }: any): SchemaEntity => ({
  id,
  ...data,
});

export const createAdapter = async (): Promise<Adapter> => {
  const client = new faunadb.Client({
    secret: process.env["FAUNA_DB_SECRET"]!,
    domain: process.env["FAUNA_DB_DOMAIN"]!,
    keepAlive: false,
  });

  const adapter: Adapter = {
    async findWhereId(id) {
      const result = await client.query(
        faunadb.query.Get(
          faunadb.query.Ref(faunadb.query.Collection(collectionName), id)
        )
      );
      return toSchemaEntity(result);
    },
    async findWhereEditHash(editHash) {
      const result = await client.query(
        faunadb.query.Map(
          faunadb.query.Paginate(
            faunadb.query.Match(
              faunadb.query.Index(`${collectionName}-editHash`),
              editHash
            )
          ),
          faunadb.query.Lambda(
            collectionName,
            faunadb.query.Get(faunadb.query.Var(collectionName))
          )
        )
      );

      const id = (result as any)?.data?.[0].ref?.id;

      if (id) {
        return toSchemaEntity((result as any)?.data?.[0]);
      }

      return null;
    },
    async create(params) {
      const result = await client.query(
        faunadb.query.Create(faunadb.query.Collection(collectionName), {
          data: {
            title: params.title,
            sdl: params.sdl,
            editHash: params.editHash,
            base64YjsModel: params.base64YjsModel,
          },
        })
      );
      return (result as any)?.ref?.id;
    },
    async updateWhereEditHash(editHash, params) {
      const record = await adapter.findWhereEditHash(editHash);
      if (record == null) {
        return false;
      }

      await client.query(
        faunadb.query.Update(
          faunadb.query.Ref(
            faunadb.query.Collection(collectionName),
            record.id
          ),
          {
            data: {
              title: params.title,
              sdl: params.sdl,
              base64YjsModel: params.base64YjsModel,
            },
          }
        )
      );

      return true;
    },
  };

  return adapter;
};
