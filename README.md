# SchemeHub

A web app for collaborative editing of GraphQL Schemas.

## Development Instructions

### Install dependencies

```bash
yarn
```

### Setup Database

SchemeHub supports multiple database types.

#### FaunaDB

```bash
cp .env.local.sample .env.local
```

Set `STORE_ADAPTER` to `FAUNADB` within `.env.local`.
Setup `FAUNA_DB_SECRET` and `FAUNA_DB_DOMAIN` within `.env.local` (You need to create an account on https://fauna.com or host a local instance).

##### Seed Database

```bash
yarn ts-node scripts/fauna-db/seed
```

##### Migrate Database

```bash
yarn ts-node scripts/fauna-db/migrate
```

#### ThreadDB

```bash
cp .env.local.sample .env.local
```

Setup `TEXTILE_API_PUBLIC_KEY` and `TEXTILE_API_SECRET_KEY` within `.env.local` (You need to create an account on https://textile.io).

##### Seed Database

```bash
yarn ts-node scripts/thread-db/seed
```

Copy the printed `THREAD_ID` into `.env.local`.

##### Migrate database

After the database got seeded you can run the migrations via. This is necessary every time the model changes.

```bash
yarn ts-node scripts/thread-db/migrate
```

### Run Project

Start the development server.

```bash
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deploy on Vercel

The easiest way to deploy SchemeHub app is to use the [Vercel Platform](https://vercel.com/new) from the creators of Next.js.

Check out the [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.

The following environment variables must be configured.

| Name                     | Description                                                                            | Example Value                 |
| ------------------------ | -------------------------------------------------------------------------------------- | ----------------------------- |
| `STORE_ADAPTER`          | Store adapter used for persisting data. Supported values are `THREADDB` and `FAUNADB`. | `THREADDB`                    |
| `TEXTILE_API_PUBLIC_KEY` | Textile.io api public key. (required if using `THREADDB`)                              | `ixgh8sfzg4h3dvzptq2jhb9tfs4` |
| `TEXTILE_API_SECRET_KEY` | Textile.io api secret key. (required if using `THREADDB`)                              | `4sft9bhj2qtpzvd3h4gzfs8hgxi` |
| `THREAD_ID`              | Textile.io Thread ID. (required if using `THREADDB`)                                   | `schemehub-storage`           |
| `FAUNA_DB_SECRET`        | FaunaDB secret. (required if using `FAUNADB`)                                          | `4sft9bhj2qtpzvd3h4gzfs8hgxi` |
| `FAUNA_DB_DOMAIN`        | FaunaDB Domain. (required if using `FAUNADB`)                                          | `db.eu.fauna.com`             |
