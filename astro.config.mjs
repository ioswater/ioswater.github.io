// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import { viewTransitions } from "astro-vtbot/starlight-view-transitions";
import tailwindcss from "@tailwindcss/vite";
import config from "./src/config/config.json";
import social from "./src/config/social.json";
import locals from "./src/config/locals.json";
import sidebar from "./src/config/sidebar.json";
import { fileURLToPath } from "url";

const { site } = config;
const { title, logo, logo_darkmode } = site;

const logoConfig = logo
  ? {
      light: logo,
      dark: logo_darkmode || logo,
      alt: "LiuLuit"
    }
  : undefined;

export const locales = locals;

export default defineConfig({
  site: "https://liuluit.com",
  trailingSlash: "always",
  image: {
    service: { entrypoint: "astro/assets/services/noop" }
  },
  integrations: [
    starlight({
      title,
      logo: logoConfig,
      // @ts-ignore
      social: social.main || [],
      locales,
      sidebar: sidebar.main || [],
      customCss: ["./src/styles/global.css"],
      components: {
        Head: "./src/components/override-components/Head.astro",
        Header: "./src/components/override-components/Header.astro",
        Hero: "./src/components/override-components/Hero.astro",
        PageFrame: "./src/components/override-components/PageFrame.astro",
        PageSidebar: "./src/components/override-components/PageSidebar.astro",
        TwoColumnContent:
          "./src/components/override-components/TwoColumnContent.astro",
        ContentPanel: "./src/components/override-components/ContentPanel.astro",
        Pagination: "./src/components/override-components/Pagination.astro",
        Sidebar: "./src/components/override-components/Sidebar.astro",
        Footer: "./src/components/override-components/Footer.astro"
      }
    })
  ],
  vite: {
    plugins: /** @type {any} */ ([tailwindcss(), viewTransitions()]),
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
        "~": fileURLToPath(new URL("./src", import.meta.url))
      }
    }
  }
});
