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

// ─── 过滤函数 ──────────────────────────────────────────────────

export function isJunkEntry(f: { name: string; url: string }, siteUrl?: string): boolean {
  const name = (f.name || "").trim();
  const url = (f.url || "").trim();

  // ── URL 格式检查 ──────────────────────────────────────────
  if (url.includes("https:// https://") || url.includes("http:// http://")) return true;
  if (/^https?:\/\//i.test(name) && /^https?:\/\//i.test(url)) return true;
  for (const p of JUNK_URL_PATTERNS) { if (p.test(url)) return true; }

  // ── 域名检查 ────────────────────────────────────────────
  try {
    const hostname = new URL(url.startsWith("http") ? url : `https://${url}`).hostname.toLowerCase();
    if (/^api[.-]/i.test(hostname)) return true;
    if (SERVICE_SUBDOMAINS.test(hostname)) return true;
    // 非博客域名（明文，支持子域名匹配）
    if (NON_BLOG_DOMAINS.some(d => hostname === d || hostname.endsWith("." + d))) return true;
    // 敏感域名（SHA-256 哈希）
    const hostHash = createHash("sha256").update(hostname).digest("hex");
    if (SENSITIVE_DOMAINS.includes(hostHash)) return true;
    // .edu / .gov
    if (hostname.endsWith(".edu") || hostname.endsWith(".edu.cn") || hostname.endsWith(".edu.tw") || hostname.endsWith(".edu.hk")) return true;
    if (hostname.endsWith(".gov") || hostname.endsWith(".gov.cn")) return true;
    // 敏感域名（SHA-256 哈希）
    const h = createHash("sha256").update(hostname).digest("hex");
    if (SENSITIVE_DOMAINS.includes(h)) return true;
  } catch {}

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
