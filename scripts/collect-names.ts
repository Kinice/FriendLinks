#!/usr/bin/env -S bun --bun run
/**
 * 收集所有主站和友链的名称，排重排序后输出到项目根目录 名字.txt
 *
 * 排重规则:
 *   1. 主站名称为第一权重（一个域名只保留主站名称）
 *   2. 子站域名若已作为主站存在，则跳过子站名称，直接使用主站名称
 *   3. 最终以名称排重
 *
 * 用法:
 *   bun run scripts/collect-names.ts
 *   bun run names            (package.json 别名)
 */

import { resolve } from "node:path";
import YAML from "yaml";

const LINKS_DIR = resolve(import.meta.dir, "..", "links");
const OUTPUT = resolve(import.meta.dir, "..", "名字.txt");

function getHost(u: string): string {
  try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; }
}

// ── 第一遍：收集主站 host → name 映射 ──────────────────────────
const hostToName = new Map<string, string>();
const mainNames = new Set<string>();

const glob = new Bun.Glob("*.{yml,yaml}");
for await (const file of glob.scan({ cwd: LINKS_DIR })) {
  try {
    const doc = YAML.parse(
      await Bun.file(resolve(LINKS_DIR, file)).text(),
    ) as any;
    if (!doc?.site) continue;

    const host = getHost(doc.site.url);
    const name = doc.site.name?.trim();
    if (host && name) {
      hostToName.set(host, name);
      mainNames.add(name);
    }
  } catch {}
}

// ── 第二遍：以 URL 去重，收集域名→规范名称 ────────────────────
const domainToName = new Map<string, string>();

// 主站优先写入
for (const [host, name] of hostToName) {
  domainToName.set(host, name);
}

for await (const file of glob.scan({ cwd: LINKS_DIR })) {
  try {
    const doc = YAML.parse(
      await Bun.file(resolve(LINKS_DIR, file)).text(),
    ) as any;
    if (!doc?.site || !Array.isArray(doc.site.friends)) continue;

    for (const f of doc.site.friends) {
      if (!f.name) continue;
      const friendHost = getHost(f.url || "");
      if (!friendHost || domainToName.has(friendHost)) continue;
      domainToName.set(friendHost, f.name.trim());
    }
  } catch {}
}

const sorted = [...domainToName.values()].sort((a, b) => a.localeCompare(b, "zh-CN"));
await Bun.write(OUTPUT, sorted.join("\n") + "\n");

console.log(`主站: ${mainNames.size} | 域名去重: ${sorted.length} → ${OUTPUT}`);
