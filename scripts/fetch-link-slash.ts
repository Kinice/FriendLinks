/**
 * 批量 playwright 并发抓取 /link/ 路由
 * 用法: bun run scripts/fetch-link-slash.ts
 */

import { writeFileSync } from "node:fs";
import { chromium } from "playwright";
import YAML from "yaml";
import { filterFriends } from "./filter";

const CONCURRENCY = 12;
const TIMEOUT = 15000;

const SITES = [
  "wcowin.work", "blog.081113.xyz", "blog.crclare.top", "blog.chn.us.kg",
  "blog.pzai.cloud", "zsyyblog.com", "blog.lololowe.com", "blog.cancin.cn",
  "blog.joker2yue.com", "flzzz.com", "liublog.cn", "blog.randench.cn",
  "blog.w1f.top", "blog.fantasyke.cn", "wyjmew.cn", "blog.kwicaii.moe",
  "blog.qyliu.top", "ssnur.com", "blog.yhz610.com", "blog.loveak.top",
  "qmye.com", "pku-cs-cjw.top", "mahaofei.com", "sikan.moe",
  "blog.abloom.site", "cyborg2077.github.io", "one21.cn",
  "blog.shenley.cn", "github.com",
];

async function extractLinks(page: any, host: string): Promise<Array<{ name: string; url: string }>> {
  try {
    await page.goto(`https://${host}/link/`, { waitUntil: "networkidle", timeout: TIMEOUT });
    await page.waitForTimeout(2000);
  } catch {
    try {
      await page.goto(`http://${host}/link/`, { waitUntil: "domcontentloaded", timeout: TIMEOUT });
      await page.waitForTimeout(2000);
    } catch {
      return [];
    }
  }

  return await page.evaluate((exHost: string) => {
    const seen = new Set<string>();
    const results: Array<{ name: string; url: string }> = [];
    for (const a of document.querySelectorAll<HTMLAnchorElement>("a[href]")) {
      const href = a.href.trim();
      const text = (a.textContent || "").trim().slice(0, 80);
      if (!href || !text || text.length < 2) continue;
      if (!href.startsWith("http")) continue;
      try { if (new URL(href).hostname.includes(exHost)) continue; } catch {}
      const key = href.toLowerCase().replace(/\/$/, "");
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({ name: text, url: href });
    }
    return results;
  }, host);
}

async function main() {
  console.log(`[启动] 共 ${SITES.length} 个站点, 并发 ${CONCURRENCY}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  });

  let done = 0;
  let written = 0;
  let failed = 0;

  async function processOne(host: string) {
    const page = await context.newPage();
    const links = await extractLinks(page, host);
    await page.close();

    done++;
    const label = host.padEnd(24);
    if (links.length >= 2) {
      const rawFriends = links.map(f => ({
        name: f.name.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim(),
        url: f.url,
      }));
      const filtered = filterFriends(rawFriends, `https://${host}/`);
      if (filtered.length < 2) {
        done++;
        console.log(`[${String(done).padStart(3)}/${SITES.length}] ${host.padEnd(24)} ⏭️ 过滤后不足`);
        return;
      }
      const doc = {
        site: {
          name: host,
          url: `https://${host}/`,
          description: "友情链接",
          links: "/link/",
          friends: filtered,
        },
      };
      writeFileSync(`links/${host}.yml`, YAML.stringify(doc, { indent: 2, lineWidth: 0, defaultStringType: "QUOTE_SINGLE" }), "utf8");
      written++;
      console.log(`[${String(done).padStart(3)}/${SITES.length}] ${host.padEnd(24)} ✅ ${filtered.length} 个友链`);
    } else {
      console.log(`[${String(done).padStart(3)}/${SITES.length}] ${host.padEnd(24)} ⏭️ 跳过`);
    }
  }

  const queue = [...SITES.filter(h => h !== "github.com")]; // 跳过 github.com

  async function worker() {
    while (queue.length > 0) {
      const host = queue.shift()!;
      try { await processOne(host); }
      catch (e: any) {
        failed++;
        console.log(`[${String(done).padStart(3)}/${SITES.length}] ${host.padEnd(24)} ❌ ${(e.message || "").slice(0, 60)}`);
      }
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () => worker());
  await Promise.all(workers);

  await browser.close();
  console.log(`\n[完成] 总计 ${SITES.length - 1}, 写入 ${written} 个 yml, 失败 ${failed}`);
}

main();
