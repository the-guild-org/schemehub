export const getFontColorForBackgroundColor = (bgColor: string) =>
  parseInt(bgColor.replace("#", ""), 16) > 0xffffff / 2 ? "#000" : "#fff";
