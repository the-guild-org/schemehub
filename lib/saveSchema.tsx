export const saveSchema = (id: string, sdl: string) =>
  fetch(`/api/schema/${id}`, {
    body: JSON.stringify({
      sdl,
    }),
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  }).then((res) => res.json());
