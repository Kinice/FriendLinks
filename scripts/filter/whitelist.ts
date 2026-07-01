/**
 * 绝对白名单 — 无论如何不被过滤剔除的域名
 *
 * 格式: host（不含 www. 前缀），如 "example.com"
 * 匹配规则: 全匹配 hostname 或 hostname 去掉 www. 后匹配
 */
export const WHITELIST_DOMAINS: string[] = [
  // "example.com",
];
