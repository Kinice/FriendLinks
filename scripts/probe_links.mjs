#!/usr/bin/env node
/**
 * 探测缺少 links 字段的主站友链路由
 * 找不到就跳过，不填默认值，不做任何污染
 *
 * 注意：命中率很低，仅作测试使用。
 *
 * 用法: cd /home/xingwangzhe/桌面/前端项目/FriendLinks && bun scripts/probe_links.mjs
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";

const LINKS_DIR = path.resolve(process.cwd(), "links");

// 常见友链页面路径（按可能性排序）
const CANDIDATES = [
  "/links",
  "/link",
  "/friends",
  "/friend",
  "/flink",
  "/links.html",
  "/friends.html",
  "/peers",
  "/friend-links",
  "/friend_link",
];

function getHost(url) {
  try { return new URL(url).hostname.toLowerCase(); } catch { return ""; }
}

async function main() {
  console.log("=".repeat(60));
  console.log("友链路由探测脚本（命中率很低，仅作测试使用）");
  console.log("=".repeat(60));
  console.log("");

  const pw = await import("playwright");
  const browser = await pw.chromium.launch({ headless: true });

  const files = (await readdir(LINKS_DIR))
    .filter(f => f.endsWith(".yml") || f.endsWith(".yaml"))
    .sort();

  // 找出缺少 links 的文件
  const todo = [];
  for (const file of files) {
    const fp = path.join(LINKS_DIR, file);
    const content = await readFile(fp, "utf8");
    let doc;
    try { doc = YAML.parse(content); } catch { continue; }
    if (!doc?.site) continue;
    if (!doc.site.links && doc.site.url) {
      todo.push({ file, fp, content, url: doc.site.url, host: getHost(doc.site.url) });
    }
  }

  console.log(`共 ${files.length} 个文件，其中 ${todo.length} 个缺少 links 字段\n`);
  console.log("-".repeat(60));

  let found = 0;
  let skipped = 0;

  for (let i = 0; i < todo.length; i++) {
    const { file, fp, content, url, host } = todo[i];

    let foundRoute = null;

    // 逐个尝试候选路径
    for (const candidate of CANDIDATES) {
      // 先试 https，再试 http
      const protocols = ["https", "http"];
      let foundOk = false;

      for (const proto of protocols) {
        const pageUrl = `${proto}://${host}${candidate}`;
        process.stdout.write(`  [${i + 1}/${todo.length}] ${host} 尝试 ${proto}://${candidate}... `);

        const page = await browser.newPage();
        try {
          const resp = await page.goto(pageUrl, {
            waitUntil: "domcontentloaded",
            timeout: 6000,
          });
          if (resp) {
            const status = resp.status();
            const ct = (resp.headers()["content-type"] || "").toLowerCase();
            // 允许 200-399 状态码（含重定向后最终正常）
            const statusOk = status >= 200 && status < 400;
            // 允许 text/html 或没有 content-type 的页面
            const ctOk = ct.includes("text/html") || ct === "";
            if (statusOk && ctOk) {
              foundOk = true;
              console.log(`✓ ${status}`);
            } else {
              console.log(`✗ status=${status} ct=${ct}`);
            }
          } else {
            console.log("✗ 无响应");
          }
        } catch (e) {
          console.log("✗ 超时/失败");
        }
        await page.close();

        if (foundOk) {
          foundRoute = candidate;
          break;
        }
      }

      if (foundOk) {
        break;
      }
    }

    if (foundRoute) {
      // 在 url: 行后插入 links: xxx
      const lines = content.split("\n");
      const urlIdx = lines.findIndex(l => l.trim().startsWith("url:"));
      if (urlIdx >= 0) {
        const indent = lines[urlIdx].match(/^\s*/)[0];
        lines.splice(urlIdx + 1, 0, `${indent}links: ${foundRoute}`);
        const newContent = lines.join("\n");
        await writeFile(fp, newContent, "utf8");
        found++;
        console.log(`  ✅ ${host} → links: ${foundRoute}`);
      }
    } else {
      skipped++;
      console.log(`  ⏭️  ${host} 未找到路由，跳过`);
    }

    console.log("");
  }

  await browser.close();

  console.log("=".repeat(60));
  console.log(`完成！找到 ${found} 个，跳过 ${skipped} 个`);
  console.log("=".repeat(60));
}

main().catch(e => {
  console.error("错误:", e.message || e);
  process.exit(1);
});
