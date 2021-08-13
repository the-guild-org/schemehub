import faunadb from "faunadb";
import * as path from "path";
import { config } from "dotenv";
import * as envalid from "envalid";
import { collectionName } from "../../lib/store/faunadb-adapter";

const main = async () => {
  config({
    path: path.resolve(__dirname, "..", "..", ".env.local"),
  });
  const env = envalid.cleanEnv(process.env, {
    FAUNA_DB_SECRET: envalid.str(),
    FAUNA_DB_DOMAIN: envalid.str(),
  });
  const client = new faunadb.Client({
    secret: env["FAUNA_DB_SECRET"],
    domain: env["FAUNA_DB_DOMAIN"],
    keepAlive: false,
  });

  await client.query(
    faunadb.query.CreateIndex({
      name: `${collectionName}-id`,
      source: faunadb.query.Collection(collectionName),
      unique: true,
      terms: [{ field: ["data", "id"] }],
    })
  );
  await client.query(
    faunadb.query.CreateIndex({
      name: `${collectionName}-editHash`,
      source: faunadb.query.Collection(collectionName),
      unique: true,
      terms: [{ field: ["data", "editHash"] }],
    })
  );
};

main();
