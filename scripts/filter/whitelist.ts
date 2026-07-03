// 白名单域名 — 永远不被过滤，即使匹配黑名单关键词
// 仅限博客聚合/目录/社区平台（不是普通博客网站）
export const WHITELIST_DOMAINS: string[] = [
  // 开往 — 博客webring社区
  "travellings.cn",
  "travellings.net",
  // 博客聚合/目录平台
  "foreverblog.cn",
  "blogfinder.cc",
  "blogscn.com",
  "bkld.me",
	  "blogs.hn",
	  // Fediring — Fediverse 个人站点 webring
	  "fediring.net",
];
