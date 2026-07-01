#!/usr/bin/env -S bun --bun run
/**
 * 慢站重试脚本（5 并发 · 15s 超时）
 *
 * 读取 slow.txt 中的站点，逐个重新探测，能通的写入 YAML。
 *
 * 用法:
 *   bun run scripts/retry-slow.ts
 */

import path from "node:path";
import YAML from "yaml";
import { FRIEND_ROUTES } from "./friend-routes";
import {
  fetchPage, extractTitle, extractAnchors, checkErrorPage,
  TIMEOUT, TIMEOUT_SLOW,
  type FetchResult,
} from "./probe-lib";

const LINKS_DIR = path.resolve(process.cwd(), "links");
const SLOW_TXT = path.resolve(process.cwd(), "slow.txt");
const CONCURRENCY = 5;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

function getHost(u: string): string {
  try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; }
}

async function retryHost(host: string): Promise<{ found: boolean; log: string }> {
  const logs: string[] = [];

  for (const proto of ["https", "http"] as const) {
    const baseUrl = `${proto}://${host}`;

    // 首页存活探测
    const { html } = await fetchPage(null as any, baseUrl + "/", logs, `${proto.toUpperCase()} /`);
    if (html && html.length > 100) {
      logs.push(`  ✅ 首页可达`);
    } else {
      logs.push(`  ❌ 首页不可达`);
      continue;
    }

    // 路由探测
    for (const route of FRIEND_ROUTES) {
      const pageUrl = `${baseUrl}${route}`;
      const result = await fetchPage(null as any, pageUrl, logs, `${proto}${route}`);
      if (result.html) {
        const anchors = extractAnchors(result.html, host);
        if (anchors.length >= 2) {
          logs.push(`  路由 ${route} → ${anchors.length} 友链 ✅`);

          // 写入 YAML
          const rawFriends = anchors.map(a => ({
            name: a.t.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim(),
            url: a.h,
          }));

          const yamlPath = path.join(LINKS_DIR, `${host}.yml`);
          if (!await Bun.file(yamlPath).exists()) {
            const doc = {
              site: {
                name: host,
                url: baseUrl + "/",
                description: "友情链接",
                links: route,
                friends: rawFriends,
              },
            };
            await Bun.write(yamlPath, YAML.stringify(doc, { indent: 2, lineWidth: 0, defaultStringType: "QUOTE_SINGLE" }));
            logs.push(`  ✅ 写入 ${rawFriends.length} 个友链`);
          } else {
            logs.push(`  ⏭️ 已存在`);
          }

          return { found: true, log: logs.join("\n") };
        }
      }
    }

    logs.push(`  未找到友链路由`);
    return { found: false, log: logs.join("\n") };
  }

  return { found: false, log: logs.join("\n") };
}

async function main() {
  console.log("=".repeat(60));
  console.log("慢站重试（5 并发 · 15s 超时）");
  console.log("=".repeat(60));

  const text = await Bun.file(SLOW_TXT).text().catch(() => "");
  const lines = text.split("\n").filter(l => l && !l.startsWith("疑似") && !l.startsWith("===") && !l.startsWith("格式"));
  const hosts = lines.map(l => l.split("|")[0].trim()).filter(Boolean);

  if (hosts.length === 0) {
    console.log("slow.txt 为空或无法解析");
    return;
  }

  console.log(`待重试: ${hosts.length} 个站点\n`);

  const queue = [...hosts];
  let done = 0;
  let recovered = 0;
  let failed = 0;

  async function worker() {
    while (true) {
      const host = queue.shift();
      if (!host) break;

      const idx = ++done;
      process.stderr.write(`\r进度: ${idx}/${hosts.length} (已恢复: ${recovered})`);

      const { found, log } = await retryHost(host);
      if (found) recovered++;
      else failed++;

      console.log(`\n[${idx}/${hosts.length}] ${host}`);
      console.log(log);
    }
  }

  const pool = Math.min(CONCURRENCY, queue.length);
  await Promise.all(Array.from({ length: pool }, () => worker()));

  console.log("\n" + "=".repeat(60));
  console.log(`完成！共 ${hosts.length} 个慢站，恢复 ${recovered} 个，仍失败 ${failed} 个`);
  console.log("=".repeat(60));
}

main().catch(e => { console.error("错误:", e); process.exit(1); });
