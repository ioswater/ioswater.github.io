export const getTranslations = async (lang: string) => {
  let menu;
  try {
    menu = await import(`../../config/menu.${lang}.json`);
  } catch (error) {
    menu = await import("../../config/menu.root.json");
  }

  return { ...menu.default };
};
