/**
 * 友链无关条目剔除脚本
 *
 * 遍历 links/*.yml，剔除爬虫误抓的非友链条目。
 * 过滤规则定义在 scripts/filter/ 目录下。
 *
 * 用法: bun scripts/prune-irrelevant.ts
 */

import { readdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import YAML from "yaml";
import { isJunkEntry, isSelfReference, filterFriends } from "./filter";

// ─── 主流程 ────────────────────────────────────────────────────

function main() {
  const dir = resolve("links");
  const files = readdirSync(dir).filter((f) => f.endsWith(".yml"));

  let totalRemoved = 0;
  let totalFiles = 0;
  let totalFilesChanged = 0;

  for (const file of files) {
    const filePath = resolve(dir, file);
    const text = readFileSync(filePath, "utf8");
    const obj = YAML.parse(text);
    if (!obj?.site) continue;

    const site = obj.site;
    if (!Array.isArray(site.friends)) continue;

    const before = site.friends.map((f: any) => `${f.name || ""}  ${f.url || ""}`);
    const { cleaned, removed } = cleanupFriends(site.friends, site.url);
    totalRemoved += removed;

    if (removed > 0) {
      const after = new Set(cleaned.map((f: any) => `${f.name || ""}  ${f.url || ""}`));
      const removedEntries = before.filter((e: string) => !after.has(e));
      console.log(`\n📄 ${file} 剔除 ${removed} 条:`);
      for (const e of removedEntries) {
        const lastSpace = e.lastIndexOf("  ");
        const name = e.slice(0, lastSpace);
        const url = e.slice(lastSpace + 2);
        console.log(`   ❌ ${name.padEnd(30)} ${url}`);
      }
    }

    if (cleaned.length === 0) {
      try { unlinkSync(filePath); } catch {}
      if (removed > 0 || site.friends.length > 0) totalFilesChanged++;
    } else if (removed > 0) {
      site.friends = cleaned;
      const output = YAML.stringify(obj, {
        indent: 2,
        lineWidth: 0,
        defaultStringType: "QUOTE_SINGLE",
      });
      writeFileSync(filePath, output, "utf8");
      totalFilesChanged++;
    }

    totalFiles++;
  }

  console.log(`\n扫描文件: ${totalFiles}`);
  console.log(`修改文件: ${totalFilesChanged}`);
  console.log(`剔除条目: ${totalRemoved}`);
}

function cleanupFriends(friends: any[], siteUrl?: string): { cleaned: any[]; removed: number } {
  const filtered = friends.filter((f) => {
    if (!f || typeof f !== "object") return false;
    if (!(f.name && f.url)) return false;
    if (isJunkEntry(f, siteUrl)) return false;
    return true;
  });
  const removedCount = friends.length - filtered.length;
  const { deduped: hostDeduped, removed: hostRemoved } = deduplicateByHost(filtered);
  const { deduped, removed: dupRemoved } = deduplicate(hostDeduped);
  return { cleaned: deduped, removed: removedCount + hostRemoved + dupRemoved };
}

function deduplicateByHost(friends: any[]): { deduped: any[]; removed: number } {
  const best = new Map<string, { entry: any; pathLen: number }>();
  const removed: any[] = [];
  for (const f of friends) {
    const url = (f.url || "").trim();
    try {
      const u = new URL(url.startsWith("http") ? url : `https://${url}`);
      const host = u.hostname.toLowerCase();
      const pathLen = u.pathname.replace(/\/$/, "").split("/").filter(Boolean).length;
      const existing = best.get(host);
      if (!existing || pathLen < existing.pathLen) {
        if (existing) removed.push(existing.entry);
        best.set(host, { entry: f, pathLen });
      } else {
        removed.push(f);
      }
    } catch {}
  }
  return { deduped: Array.from(best.values()).map(v => v.entry), removed: removed.length };
}

function deduplicate(friends: any[]): { deduped: any[]; removed: number } {
  const seen = new Set<string>();
  const deduped: any[] = [];
  let removed = 0;
  for (const f of friends) {
    const url = (f.url || "").trim().toLowerCase();
    if (url && seen.has(url)) { removed++; continue; }
    seen.add(url);
    deduped.push(f);
  }
  return { deduped, removed };
}

main();
