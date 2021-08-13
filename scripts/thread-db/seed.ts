import { Client } from "@textile/hub";
import * as path from "path";
import * as envalid from "envalid";
import { config } from "dotenv";
import { schema } from "../../lib/store/threaddb-adapter";

const main = async () => {
  config({
    path: path.resolve(__dirname, "..", ".env.local"),
  });
  const env = envalid.cleanEnv(process.env, {
    TEXTILE_API_PUBLIC_KEY: envalid.str(),
    TEXTILE_API_SECRET_KEY: envalid.str(),
  });
  const client = await Client.withKeyInfo({
    key: env.TEXTILE_API_PUBLIC_KEY,
    secret: env.TEXTILE_API_SECRET_KEY,
  });

  const threadId = await client.newDB(undefined, "schemehub-storage");

  await client.newCollection(threadId, schema);
  await client.updateCollection(threadId, schema);

  console.log(`Update .env.local\n\nTHREAD_ID=${threadId.toString()}`);
};

main();
