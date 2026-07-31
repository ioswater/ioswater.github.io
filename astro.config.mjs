// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import astroExpressiveCode from "astro-expressive-code";
import { pluginLineNumbers } from "@expressive-code/plugin-line-numbers";
import { viewTransitions } from "astro-vtbot/starlight-view-transitions";
import tailwindcss from "@tailwindcss/vite";
import rehypeCallouts from "rehype-callouts";
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
    // 必须排在 mdx()/starlight() 之前，否则 MDX 代码块无法使用 EC
    astroExpressiveCode({
      // 代码块恒为深色面板（亮/暗站主题下都走 github-dark），与首页 Hero 的暗色代码卡统一
      themes: ["github-dark"],
      useDarkModeMediaQuery: false,
      themeCssSelector: () => ":root",
      // antd 极简风默认不显示行号；作者可用 `showLineNumbers` 元信息开启
      defaultProps: { showLineNumbers: false },
      // 注册 oc 作为 Objective-C 的别名（Shiki 自带 objc/objective-c）
      shiki: { langAlias: { oc: "objective-c" } },
      // 行号插件（默认关闭，按需开启）
      plugins: [pluginLineNumbers()]
    }),
    starlight({
      title,
      logo: logoConfig,
      // @ts-ignore
      social: social.main || [],
      locales,
      sidebar: sidebar.main || [],
      customCss: ["./src/styles/global.css", "./src/styles/code-block.css"],
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
  markdown: {
    rehypePlugins: [rehypeCallouts]
  },
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
