/**
 * 批量 playwright 并发抓取 /links.html 路由
 * 用法: bun run scripts/fetch-links-html.ts
 */

import { writeFileSync } from "node:fs";
import { chromium } from "playwright";
import YAML from "yaml";
import { filterFriends } from "./filter";

const CONCURRENCY = 6;
const TIMEOUT = 15000;

const SITES = [
  "blog.zeruns.tech", "blog.chrison.cn", "yvii.cn", "blog.conoha.vip",
  "blog.aqcoder.cn", "blog.feizhuqwq.com", "blog.mctsw.top", "blog.lmb520.cn",
  "zhyok.cn", "biibii.cn", "vian.top", "nekopara.uk", "moeshin.com",
  "ilogs.cn", "blog.ziyege.com", "luohuayu.cn", "pinaland.cn", "my1981.cn",
  "qninq.cn", "wonse.info", "moe.best", "blog.yeqing.net", "omn.cc",
  "gmcllp.cn", "niepan.org", "zxs.me", "nsxsb.com", "blog.zmyos.com",
  "silkage.cn", "bufanz.com", "blog.ziyibbs.com", "dbkuaizi.com", "ximi.me",
  "xizi.live", "fangtang.net", "2dph.com", "ruanjianya.net", "vss.plus",
  "yorg.top", "tsuk1.com", "zxz.ee", "52lc.top", "p3ter.me", "blog.kamt.cn",
  "creammint.cn", "hubtools.cn", "flyandnotdown.com", "barcodex.cn",
  "blog.kokowo.cn", "blog.xhxx.cc", "9sb.net", "blog.fxb.cc",
  "yanghuaxing.com", "underestimated.cn", "isyangs.cn",
];

async function extractLinks(page: any, host: string): Promise<Array<{ name: string; url: string }>> {
  try {
    await page.goto(`https://${host}/links.html`, { waitUntil: "networkidle", timeout: TIMEOUT });
    await page.waitForTimeout(2000);
  } catch {
    try {
      await page.goto(`http://${host}/links.html`, { waitUntil: "domcontentloaded", timeout: TIMEOUT });
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
  console.log(`[启动] 共 ${SITES.length} 个站点, 并发 ${CONCURRENCY}`);
  console.log("");

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

    const label = host.padEnd(22);
    if (links.length >= 2) {
      const rawFriends = links.map(f => ({
        name: f.name.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim(),
        url: f.url,
      }));
      const filtered = filterFriends(rawFriends, `https://${host}/`);
      if (filtered.length < 2) { done++; console.log(`[${String(done).padStart(3, " ")}/${SITES.length}] ${label} ⏭️ 过滤后不足`); return; }
      const doc = {
        site: {
          name: host,
          url: `https://${host}/`,
          description: "友情链接",
          links: "/links.html",
          friends: filtered,
        },
      };
      const output = YAML.stringify(doc, { indent: 2, lineWidth: 0, defaultStringType: "QUOTE_SINGLE" });
      writeFileSync(`links/${host}.yml`, output, "utf8");
      written++;
    }

    done++;
    console.log(`[${String(done).padStart(3, " ")}/${SITES.length}] ${label} ${links.length >= 2 ? `✅ ${links.length} 个友链` : "⏭️ 跳过"}`);
  }

  const queue = [...SITES];
  let active = 0;

  async function worker() {
    while (queue.length > 0) {
      const host = queue.shift()!;
      active++;
      try {
        await processOne(host);
      } catch (e: any) {
        failed++;
        console.log(`[${String(done).padStart(3, " ")}/${SITES.length}] ${host.padEnd(22)} ❌ ${(e.message || "").slice(0, 60)}`);
      }
      active--;
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, SITES.length) }, () => worker());
  await Promise.all(workers);

  await browser.close();
  console.log("");
  console.log(`[完成] 总计 ${SITES.length}, 写入 ${written} 个 yml, 失败 ${failed}`);
}

main();
