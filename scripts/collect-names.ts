#!/usr/bin/env -S bun --bun run
/**
 * 收集所有主站和友链的名称，排重排序后输出到项目根目录 名字.txt
 *
 * 用于后续审查名称过滤规则，长期保留。
 *
 * 用法:
 *   bun run scripts/collect-names.ts
 *   bun run names            (package.json 别名)
 */

import { resolve } from "node:path";
import YAML from "yaml";

const LINKS_DIR = resolve(import.meta.dir, "..", "links");
const OUTPUT = resolve(import.meta.dir, "..", "名字.txt");

const names = new Set<string>();

const glob = new Bun.Glob("*.{yml,yaml}");
for await (const file of glob.scan({ cwd: LINKS_DIR })) {
  try {
    const doc = YAML.parse(
      await Bun.file(resolve(LINKS_DIR, file)).text(),
    ) as any;
    if (!doc?.site) continue;

    // 主站名称
    if (doc.site.name) names.add(doc.site.name.trim());

    // 友链名称
    if (Array.isArray(doc.site.friends)) {
      for (const f of doc.site.friends) {
        if (f.name) names.add(f.name.trim());
      }
    }
  } catch {
    // YAML 解析失败，跳过
  }
}

const sorted = [...names].sort((a, b) => a.localeCompare(b, "zh-CN"));
await Bun.write(OUTPUT, sorted.join("\n") + "\n");

console.log(`共 ${sorted.length} 个不重复名称 → ${OUTPUT}`);
