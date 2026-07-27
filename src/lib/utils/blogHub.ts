import type { CollectionEntry } from "astro:content";

export interface HubPost {
  title: string;
  description: string;
  url: string;
  category: string;
  categoryLabel: string;
  date: string;
}

const CATEGORY_LABELS = {
  "zh-CN": {
    "ios-basics": "iOS 基础知识",
    "ai-project-architecture": "AI 项目实战架构",
    "personal-projects": "个人项目",
    profile: "个人简介"
  },
  en: {
    "ios-basics": "iOS Fundamentals",
    "ai-project-architecture": "AI Project Architecture",
    "personal-projects": "Personal Projects",
    profile: "About Me"
  }
} as const;

const toDate = (lastUpdated: Date | boolean | undefined): string => {
  if (lastUpdated instanceof Date && !Number.isNaN(lastUpdated.getTime())) {
    return lastUpdated.toISOString().slice(0, 10);
  }

  return "1970-01-01";
};

export const buildBlogHubPosts = (
  docs: CollectionEntry<"docs">[],
  locale: "zh-CN" | "en"
): HubPost[] => {
  const categoryMap = CATEGORY_LABELS[locale];

  return docs.reduce<HubPost[]>((acc, entry) => {
    const pathSegments = entry.id.split("/");
    const isEn = entry.id.startsWith("en/");

    if ((locale === "en" && !isEn) || (locale === "zh-CN" && isEn)) {
      return acc;
    }

    const category = locale === "en" ? pathSegments[1] : pathSegments[0];
    if (!category || !categoryMap[category as keyof typeof categoryMap]) {
      return acc;
    }

    acc.push({
      title: entry.data.title,
      description: entry.data.description || "",
      url: `/${entry.id}/`,
      category,
      categoryLabel: categoryMap[category as keyof typeof categoryMap],
      date: toDate(entry.data.lastUpdated)
    });

    return acc;
  }, []);
};
