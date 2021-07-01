import type { NextApiRequest, NextApiResponse } from "next";
import { GraphQLSchema, runWithSchemaStore } from "../../../lib/schema-store";

export type Data =
  | {
      error: {
        message: string;
      };
    }
  | {
      data: GraphQLSchema;
    };

export default runWithSchemaStore(
  async (store, req: NextApiRequest, res: NextApiResponse<Data>) => {
    if (req.method === "GET") {
      const { schemaId } = req.query;
      if (typeof schemaId !== "string") {
        res.status(400).json({
          error: {
            message: "Missing 'schemaId'.",
          },
        });
        return;
      }

      let schema = await store.findById(schemaId).catch(() => null);

      if (schema == null) {
        res.status(404).json({
          error: {
            message: "Schema not found.",
          },
        });
        return;
      }

      res.status(200).json({
        data: schema,
      });
      return;
    } else if (req.method !== "POST") {
      res.status(404).json({
        error: {
          message: "Invalid method.",
        },
      });
      return;
    }

    const { schemaId } = req.query;

    if (typeof schemaId !== "string") {
      res.status(400).json({
        error: {
          message: "Missing 'schemaId'.",
        },
      });
      return;
    }

    let { sdl, title } = req.body;

    if (typeof sdl !== "string") {
      res.status(400).json({
        error: {
          message: "Missing 'sdl' property in body.",
        },
      });
      return;
    }
    if (typeof title !== "string") {
      res.status(400).json({
        error: {
          message: "Missing 'title' property in body.",
        },
      });
      return;
    }

    let schema = await store.findById(schemaId).catch(() => null);

    if (schema == null) {
      await store.create(schemaId, title, sdl);
    } else {
      await store.save(schemaId, title, sdl);
    }

    schema = await store.findById(schemaId);
    if (schema == null) {
      res.status(500).json({
        error: {
          message: "Unexpected error.",
        },
      });
      return;
    }

    res.status(200).json({
      data: schema,
    });
  }
);
