import { Client, ThreadID } from "@textile/hub";
import * as path from "path";
import * as envalid from "envalid";
import { config } from "dotenv";
import { schema } from "../lib/schema-store";

const main = async () => {
  config({
    path: path.resolve(__dirname, "..", ".env.local"),
  });
  const env = envalid.cleanEnv(process.env, {
    THREAD_ID: envalid.str(),
    TEXTILE_API_PUBLIC_KEY: envalid.str(),
    TEXTILE_API_SECRET_KEY: envalid.str(),
  });
  const client = await Client.withKeyInfo({
    key: env.TEXTILE_API_PUBLIC_KEY,
    secret: env.TEXTILE_API_SECRET_KEY,
  });

  const threadId = ThreadID.fromString(env.THREAD_ID);

  await client.updateCollection(threadId, schema);
};

main();
