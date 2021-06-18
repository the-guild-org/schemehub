import type { Data } from "../pages/api/schema/[schemaId]";

export const fetchSchema = (id: string): Promise<Data> =>
  fetch(`/api/schema/${id}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  }).then((res) => res.json());
