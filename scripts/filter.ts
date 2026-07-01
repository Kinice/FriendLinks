/**
 * 友链过滤器 — 共享模块
 * 被 fetch-*.ts 和 prune-irrelevant.ts 共用
 */

import { createHash } from "node:crypto";
import { JUNK_NAME_PATTERNS } from "./filter/names";
import { JUNK_URL_PATTERNS } from "./filter/urls";
import { NON_BLOG_DOMAINS } from "./filter/domains";
import { SENSITIVE_DOMAINS } from "./filter/sensitive";
import { SERVICE_SUBDOMAINS } from "./filter/subdomains";
import { PLATFORM_HOSTS } from "./filter/platforms";
import { WHITELIST_DOMAINS } from "./filter/whitelist";

// ─── 预计算加速结构 ──────────────────────────────────────────
const NON_BLOG_SET = new Set(NON_BLOG_DOMAINS);
const SENSITIVE_SET = new Set(SENSITIVE_DOMAINS);
const WHITELIST_SET = new Set(WHITELIST_DOMAINS);

// ─── 过滤函数 ──────────────────────────────────────────────────

export function isJunkEntry(f: { name: string; url: string }, siteUrl?: string): boolean {
  const name = (f.name || "").trim();
  const url = (f.url || "").trim();

  // ── URL 格式检查 ──────────────────────────────────────────
  if (url.includes("https:// https://") || url.includes("http:// http://")) return true;
  if (/^https?:\/\//i.test(name) && /^https?:\/\//i.test(url)) return true;
  for (const p of JUNK_URL_PATTERNS) { if (p.test(url)) return true; }

  // 无效 URL 格式
  if (/^https?:\/\/\s/.test(url)) return true;   // "https: //..." 冒号后空格
  if (/^https?:\/\/$/.test(url)) return true;     // "http://" 无主机
  if (/^https?:\/\/#/.test(url)) return true;     // "http://#"

  // ── 域名检查 ────────────────────────────────────────────
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname;
    // 绝对白名单 — 无论如何不被过滤
    if (WHITELIST_SET.has(hostname) || WHITELIST_SET.has(hostname.replace(/^www\./, ""))) return false;
    // 友链必须指向首页
    if (pathname !== "/" && pathname !== "") return true;
    if (/^api[.-]/i.test(hostname)) return true;
    if (SERVICE_SUBDOMAINS.test(hostname)) return true;
    // 非博客域名（明文，支持子域名匹配）— O(1) Set 查找
    const hostParts = hostname.split(".");
    const hostIsJunk = NON_BLOG_SET.has(hostname) || hostParts.some((_, i) => NON_BLOG_SET.has(hostParts.slice(i).join(".")));
    if (hostIsJunk) return true;
    // 敏感域名（SHA-256 哈希）
    if (SENSITIVE_SET.has(createHash("sha256").update(hostname).digest("hex"))) return true;
    // 仅排除个人绝对无法注册的机构域名
    if (/\.(edu|gov|mil|go)(\.[a-z]{2})?$/.test(hostname)) return true;
  } catch { return true; } // URL 解析失败 → 视为垃圾

  // IP 地址
  if (/^https?:\/\/(\d{1,3}\.){3}\d{1,3}/.test(url)) return true;

  // 自引用
  if (siteUrl && isSelfReference(url, siteUrl)) return true;

  // ── 名称检查 ────────────────────────────────────────────
  for (const p of JUNK_NAME_PATTERNS) { if (p.test(name)) return true; }
  if (/^\d+$/.test(name)) return true;
  if ([...name].length === 1) return true;

  return false;
}

export function isSelfReference(url: string, siteUrl: string): boolean {
  try {
    const friendHost = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
    const siteHost = new URL(siteUrl).hostname;
    const f = friendHost.replace(/^www\./, "");
    const s = siteHost.replace(/^www\./, "");
    if (f === s) return true;

    const onPlatform = (h: string) => PLATFORM_HOSTS.some(p => h === p || h.endsWith("." + p));
    const regDomain = (h: string) => {
      if (onPlatform(h)) return h;
      const parts = h.split(".");
      return parts.length > 2 ? parts.slice(1).join(".") : h;
    };
    return regDomain(f) === regDomain(s);
  } catch { return false; }
}

export function filterFriends(friends: Array<{ name: string; url: string }>, siteUrl?: string): Array<{ name: string; url: string }> {
  return friends.filter(f => {
    if (!f || typeof f !== "object") return false;
    if (!f.name || !f.url) return false;
    if (isJunkEntry(f, siteUrl)) return false;
    return true;
  });
}
