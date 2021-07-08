import type { Data } from "../pages/api/schema/[schemaId]";

const apiBaseUrl = process.env["API_BASE_URL"] || "/api/";

export const get = (idOrEditHash: string): Promise<Data> =>
  fetch(`${apiBaseUrl}schema/${idOrEditHash}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  }).then((res) => res.json());

export const create = (
  id: string,
  props: {
    sdl: string;
    title: string;
    editHash: string;
  }
): Promise<Data> =>
  fetch(`${apiBaseUrl}schema/${id}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(props),
  }).then((res) => res.json());

export const update = (
  editHash: string,
  props: {
    sdl?: string;
    title?: string;
  }
) => {
  const abort = new AbortController();

  const promise = fetch(`${apiBaseUrl}schema/${editHash}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(props),
  }).then((res) => res.json());

  return {
    promise,
    cancel: () => abort.abort(),
  };
};
