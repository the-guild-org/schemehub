const dec2Hex = (dec: number) => dec.toString(16).padStart(2, "0");

export const randomHash = () => {
  const array = new Uint32Array(10);
  window.crypto.getRandomValues(array);
  return Array.from(array, dec2Hex).join("");
};
