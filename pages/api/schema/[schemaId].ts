import type { NextApiRequest, NextApiResponse } from "next";
import createCors from "cors";
import * as yup from "yup";
import {
  GraphQLSchemaEntity,
  runWithSchemaStore,
} from "../../../lib/schema-store";

const cors = createCors();

export type Data =
  | {
      error: {
        message: string;
      };
    }
  | {
      data: Omit<GraphQLSchemaEntity, "editHash"> & { editHash: null | string };
    };

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

const handler = async (req: NextApiRequest, res: NextApiResponse<Data>) => {
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

const get = runWithSchemaStore(
  async (store, req: NextApiRequest, res: NextApiResponse<Data>) => {
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
      const schemaEntity = await store.findByEditHash(
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

    const schemaEntity = await store.findById(schemaIdOrEditHash);

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

const PostInput = yup.object().shape({
  title: yup.string().required(),
  sdl: yup.string().required(),
  editHash: yup.string().required(),
  base64YjsModel: yup.string().required(),
});

const SchemaId = yup.string().required();

type PostInputType = yup.InferType<typeof PostInput>;

const post = runWithSchemaStore(
  async (store, req: NextApiRequest, res: NextApiResponse<Data>) => {
    let data: PostInputType;
    let schemaId: string;
    try {
      data = await PostInput.validate(req.body);
      schemaId = await SchemaId.validate(req.query["schemaId"]);
    } catch (err) {
      res.status(400).json({
        error: {
          message: "Invalid input.",
        },
      });
      return;
    }
    await store.create(
      schemaId,
      data.title,
      data.sdl,
      data.editHash,
      data.base64YjsModel
    );
    const schemaEntity = await store.findById(schemaId);

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

const UpdateInput = yup.object().shape({
  title: yup.string(),
  sdl: yup.string(),
  base64YjsModel: yup.string(),
});

type UpdateInputType = yup.InferType<typeof UpdateInput>;

const patch = runWithSchemaStore(
  async (store, req: NextApiRequest, res: NextApiResponse<Data>) => {
    let data: UpdateInputType;
    let schemaId: string;
    try {
      data = await UpdateInput.validate(req.body);
      schemaId = await SchemaId.validate(req.query["schemaId"]);
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

    const schemaEntity = await store.findByEditHash(editHash);
    if (schemaEntity == null) {
      res.status(404).json({
        error: {
          message: "Not found.",
        },
      });
      return;
    }

    await store.save(
      schemaEntity._id,
      data.title ?? schemaEntity.title,
      data.sdl ?? schemaEntity.sdl,
      data.base64YjsModel ?? schemaEntity.base64YjsModel
    );

    res.status(200).json({
      data: {
        ...schemaEntity,
        editHash: `${schemaEntity.editHash}:edit`,
      },
    });
  }
);
