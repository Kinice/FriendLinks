/**
 * 死站预检共享模块
 *
 * 提供 DNS 预检、死链缓存读取、轻量 HEAD 预检功能。
 * 所有 fetch/probe 脚本在启动 Playwright **前** 调用此模块快速筛掉死站，
 * 避免白等超时或启动浏览器消耗资源。
 *
 * 用法:
 *   import { precheckHost, isKnownDead } from "./precheck";
 *   const { alive, reason } = await precheckHost("example.com");
 *   if (!alive) { console.log(`  ⏭️ 跳过: ${reason}`); return; }
 */

import { resolve4 } from "node:dns/promises";
import { resolve } from "node:path";

// ─── 路径解析（Bun 原生 import.meta.dir） ─────────────────────────
const ROOT = resolve(import.meta.dir, "..");
const DEAD_FILE = resolve(ROOT, "dead.txt");

// ─── 死链缓存（模块初始化时一次性预加载，Bun 原生文件 API） ──────
const deadCache = await (async () => {
  const cache = new Set<string>();
  const file = Bun.file(DEAD_FILE);
  if (await file.exists()) {
    const text = await file.text();
    for (const line of text.split("\n")) {
      const h = line.trim();
      if (!h || h.startsWith("疑似") || h.startsWith("格式") || h.startsWith("=") || h.startsWith("死链")) continue;
      cache.add(h);
    }
  }
  return cache;
})();

/**
 * 检查域名是否在已知死链缓存中（零网络开销，同步）
 */
export function isKnownDead(host: string): boolean {
  return deadCache.has(host);
}

/**
 * DNS 预检：检查域名是否能解析 A 记录
 * 一次 UDP 查询 ≈ 20ms，远快于 Playwright 超时等待
 */
export async function isDomainResolvable(host: string): Promise<boolean> {
  try {
    await resolve4(host);
    return true;
  } catch {
    return false;
  }
}

/**
 * 轻量 HEAD 预检：检查首页是否可达（非 5xx）
 * 裸 HTTP 请求，不启动浏览器
 */
export async function quickHeadCheck(
  host: string,
): Promise<{ ok: boolean; status?: number }> {
  for (const proto of ["https", "http"] as const) {
    try {
      const resp = await fetch(`${proto}://${host}/`, {
        method: "HEAD",
        signal: AbortSignal.timeout(5000),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; FriendLinks/1.0) Precheck",
        },
      });
      return { ok: resp.status < 500, status: resp.status };
    } catch {
      continue;
    }
  }
  return { ok: false };
}

/**
 * 综合预检：先查缓存 → DNS → 可选 HEAD
 *
 * 三步走，每一步失败可直接跳过，避免启动 Playwright 浪费资源。
 *
 * @param host      要检查的域名
 * @param options.checkHead  是否额外做一次 HEAD 请求（默认 false）
 */
export async function precheckHost(
  host: string,
  options?: { checkHead?: boolean },
): Promise<{ alive: boolean; reason?: string }> {
  // 第一步：死链缓存（零网络开销）
  if (isKnownDead(host)) {
    return { alive: false, reason: "已知死链（缓存）" };
  }

  // 第二步：DNS 解析
  const dnsOk = await isDomainResolvable(host);
  if (!dnsOk) {
    return { alive: false, reason: "DNS 未解析" };
  }

  // 第三步：轻量 HEAD 请求
  if (options?.checkHead) {
    const { ok, status } = await quickHeadCheck(host);
    if (!ok) {
      return { alive: false, reason: status ? `HTTP ${status}` : "HEAD 失败/超时" };
    }
  }

  return { alive: true };
}
