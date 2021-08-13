import type { NextApiRequest, NextApiResponse } from "next";
import createCors from "cors";
import { z } from "zod";
import once from "lodash/once";
import {
  Store,
  createRunWithStore,
  SchemaEntity,
} from "../../../lib/store/store";

const loadStore = once(async (): Promise<Store> => {
  switch (process.env["STORE_ADAPTER"]) {
    case "threaddb":
    default:
      const { createAdapter } = await import(
        "../../../lib/store/threaddb-adapter"
      );
      return await createAdapter();
  }
});

const runWithStore = createRunWithStore(loadStore);

const cors = createCors();

export type Response<SuccessPayload> =
  | {
      error: {
        message: string;
      };
    }
  | {
      data: SuccessPayload;
    };

export type SchemaEntityWithOptionalEditHash = Omit<
  SchemaEntity,
  "editHash"
> & { editHash: string | null };

const runMiddleware = <Data>(
  req: NextApiRequest,
  res: NextApiResponse<Data>,
  fn: typeof cors
) => {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }

      return resolve(result);
    });
  });
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  await runMiddleware(req, res, cors);
  switch (req.method) {
    case "GET":
      return await get(req, res);
    case "POST":
      return await post(req, res);
    case "PATCH":
      return await patch(req, res);
    default: {
      res.status(400).json({
        error: {
          message: "Invalid method",
        },
      });
    }
  }
};

export default handler;

const get = runWithStore(
  async (
    store,
    req: NextApiRequest,
    res: NextApiResponse<Response<SchemaEntityWithOptionalEditHash>>
  ) => {
    const { schemaId: schemaIdOrEditHash } = req.query;

    if (typeof schemaIdOrEditHash !== "string") {
      res.status(400).json({
        error: {
          message: "Missing 'schemaId'.",
        },
      });
      return;
    }

    if (schemaIdOrEditHash.endsWith(":edit")) {
      const schemaEntity = await store.findWhereEditHash(
        schemaIdOrEditHash.replace(":edit", "")
      );
      if (schemaEntity == null) {
        res.status(404).json({
          error: {
            message: "Schema not found.",
          },
        });
        return;
      }
      res.status(200).json({
        data: {
          ...schemaEntity,
          editHash: `${schemaEntity.editHash}:edit`,
        },
      });
      return;
    }

    const schemaEntity = await store.findWhereId(schemaIdOrEditHash);

    if (schemaEntity == null) {
      res.status(404).json({
        error: {
          message: "Schema not found.",
        },
      });
      return;
    }

    // when u query by id you don't get edit access
    res.status(200).json({
      data: {
        ...schemaEntity,
        editHash: null,
      },
    });

    return;
  }
);

const PostInput = z.object({
  title: z.string(),
  sdl: z.string(),
  editHash: z.string(),
  base64YjsModel: z.string(),
});

const SchemaId = z.string();

type PostInputType = z.TypeOf<typeof PostInput>;

const post = runWithStore(
  async (
    store,
    req: NextApiRequest,
    res: NextApiResponse<Response<SchemaEntity>>
  ) => {
    let data: PostInputType;
    try {
      data = PostInput.parse(req.body);
    } catch (err) {
      console.error(err);
      res.status(400).json({
        error: {
          message: "Invalid input.",
        },
      });
      return;
    }
    const schemaId = await store.create({
      title: data.title,
      sdl: data.sdl,
      editHash: data.editHash,
      base64YjsModel: data.base64YjsModel,
    });

    const schemaEntity = await store.findWhereId(schemaId);

    if (schemaEntity == null) {
      res.status(500).json({
        error: {
          message: "Unexpected error.",
        },
      });
      return;
    }

    res.status(200).json({
      data: {
        ...schemaEntity,
        editHash: `${schemaEntity.editHash}:edit`,
      },
    });
  }
);

const UpdateInput = z.object({
  title: z.string(),
  sdl: z.string(),
  base64YjsModel: z.string(),
});

type UpdateInputType = z.TypeOf<typeof UpdateInput>;

const patch = runWithStore(
  async (
    store,
    req: NextApiRequest,
    res: NextApiResponse<Response<{ success: boolean }>>
  ) => {
    let data: UpdateInputType;
    let schemaId: string;
    try {
      data = UpdateInput.parse(req.body);
      schemaId = SchemaId.parse(req.query["schemaId"]);
    } catch (err) {
      res.status(400).json({
        error: {
          message: "Invalid input.",
        },
      });
      return;
    }

    if (schemaId.endsWith(":edit") === false) {
      res.status(404).json({
        error: {
          message: "Not found.",
        },
      });
      return;
    }

    const editHash = schemaId.replace(":edit", "");

    const didUpdate = await store.updateWhereEditHash(editHash, {
      title: data.title,
      sdl: data.sdl,
      base64YjsModel: data.base64YjsModel,
    });

    if (didUpdate === false) {
      res.status(404).json({
        error: {
          message: "Not found.",
        },
      });
      return;
    }

    res.status(200).json({
      data: {
        success: true,
      },
    });
  }
);
