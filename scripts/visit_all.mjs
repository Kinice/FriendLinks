#!/usr/bin/env node
/**
 * 遍历所有主站和友链节点，携带 Referer: https://links.needhelp.icu 访问
 * 最多同时打开 5 个页面，超过时销毁最早打开的页面
 * 允许 HTTP、自动跳转，超时 5s
 *
 * 用法: cd /home/xingwangzhe/桌面/前端项目/FriendLinks && bun scripts/visit_all.mjs
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";

const LINKS_DIR = path.resolve("/home/xingwangzhe/桌面/前端项目/FriendLinks/links");
const REFERER = "https://links.needhelp.icu";
const MAX_PAGES = 5;
const TIMEOUT = 5000;

function getHost(u) {
  try { return new URL(u).hostname.toLowerCase(); } catch { return ""; }
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log("=".repeat(60));
  console.log(`遍历所有友链节点，携带 Referer: ${REFERER}`);
  console.log(`最多 ${MAX_PAGES} 个并发页面，超时 ${TIMEOUT}ms`);
  console.log("=".repeat(60));
  console.log("");

  // 1. 读取所有 YML 收集 URL
  const files = (await readdir(LINKS_DIR)).filter(f => f.endsWith(".yml") || f.endsWith(".yaml"));
  const urlSet = new Set();

  for (const file of files) {
    const fp = path.join(LINKS_DIR, file);
    const content = await readFile(fp, "utf8");
    let doc;
    try { doc = YAML.parse(content); } catch { continue; }
    if (!doc?.site) continue;

    // 主站 URL
    if (doc.site.url) {
      try {
        const u = new URL(doc.site.url);
        urlSet.add(u.href.replace(/\/$/, ""));
      } catch {}
    }

    // 友链 URL
    if (Array.isArray(doc.site.friends)) {
      for (const f of doc.site.friends) {
        if (f.url) {
          try {
            const u = new URL(f.url);
            urlSet.add(u.href.replace(/\/$/, ""));
          } catch {}
        }
      }
    }
  }

  const urls = Array.from(urlSet);
  console.log(`共收集到 ${urls.length} 个唯一 URL\n`);
  console.log("-".repeat(60));

  // 2. 启动 Playwright
  const pw = await import("playwright");
  const browser = await pw.chromium.launch({ headless: true });

  // 创建一个设置了 Referer 的上下文
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: {
      "Referer": REFERER,
    },
  });

  // 页面池：最多 MAX_PAGES 个活跃页面
  const activePages = [];  // { page, url, startTime }
  let completed = 0;
  let failed = 0;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];

    // 如果活跃页面已达上限，等待最早的那个完成并销毁
    while (activePages.length >= MAX_PAGES) {
      // 等待最早的那个页面完成
      const oldest = activePages[0];
      try {
        await oldest.page.waitForLoadState("domcontentloaded", { timeout: TIMEOUT });
      } catch {}
      try { await oldest.page.close(); } catch {}
      const elapsed = Date.now() - oldest.startTime;
      completed++;
      process.stdout.write(`  ✓ ${oldest.url} (${elapsed}ms)\n`);
      activePages.shift();
    }

    // 创建新页面并发访问（从 context 创建，自带 Referer 头）
    const page = await context.newPage();
    const startTime = Date.now();

    // 异步访问，不 await（由上面的循环负责等待）
    const visitPromise = (async () => {
      try {
        // 尝试 https，失败则降级 http
        for (const proto of ["https", "http"]) {
          let targetUrl = url;
          // 替换协议
          targetUrl = targetUrl.replace(/^https?:\/\//, `${proto}://`);
          try {
            const resp = await page.goto(targetUrl, {
              waitUntil: "domcontentloaded",
              timeout: TIMEOUT,
            });
            if (resp && (resp.ok() || resp.status() >= 300)) {
              // 成功或重定向都算访问成功
              break;
            }
          } catch {}
        }
      } catch {}
    })();

    activePages.push({ page, url, startTime, promise: visitPromise });
    process.stdout.write(`  [${i + 1}/${urls.length}] 访问 ${url}... `);
  }

  // 3. 等待所有剩余页面完成
  process.stdout.write(`\n等待剩余 ${activePages.length} 个页面完成...\n`);
  for (const ap of activePages) {
    try {
      await ap.page.waitForLoadState("domcontentloaded", { timeout: TIMEOUT });
    } catch {}
    try { await ap.page.close(); } catch {}
    const elapsed = Date.now() - ap.startTime;
    completed++;
    process.stdout.write(`  ✓ ${ap.url} (${elapsed}ms)\n`);
  }

  await browser.close();

  console.log("\n" + "=".repeat(60));
  console.log(`完成！共访问 ${completed} 个 URL`);
  console.log("=".repeat(60));
}

main().catch(e => {
  console.error("错误:", e.message || e);
  process.exit(1);
});
