export const saveSchema = (id: string, title: string, sdl: string) => {
  const abort = new AbortController();
  return {
    promise: fetch(`/api/schema/${id}`, {
      body: JSON.stringify({
        title,
        sdl,
      }),
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: abort.signal,
    }).then((res) => res.json()),
    cancel: () => abort.abort(),
  };
};
