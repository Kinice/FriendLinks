/**
 * 站点探测共享工具库
 *
 * 提供 fetchPage / checkErrorPage / extractAnchors / extractTitle 等函数，
 * 供 probe_subs.ts 和 retry-slow.ts 共用。
 */

import ky, { HTTPError } from "ky";
import * as cheerio from "cheerio";
import type { BrowserContext } from "playwright";

export const TIMEOUT = 5000;
export const TIMEOUT_SLOW = 15000;
export const RENDER_WAIT = 1500;
export const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36";

export type FetchResult = {
  html: string | null;
  timedOut: boolean;
};

export function checkErrorPage(html: string): boolean {
  if (!html) return true;
  const head = html.slice(0, 300).toLowerCase();
  const title = (html.match(/<title[^>]*>([^<]+)<\/title>/i) || ["", ""])[1].toLowerCase();
  const combined = title + " " + head;
  const errorPatterns = [
    /\b404\s*(not\s*found|error|错误|页面)/,
    /page\s+not\s+found/i,
    /页面不存[在时]/,
    /页面未找到/,
    /找不到页面/,
    /无法访问/,
  ];
  return errorPatterns.some(p => p.test(combined));
}

export function extractTitle(html: string): string {
  const $ = cheerio.load(html);
  return $("title").first().text().trim();
}

export function extractAnchors(html: string, excludeHost: string): Array<{ t: string; h: string }> {
  const $ = cheerio.load(html);
  const anchors: Array<{ t: string; h: string }> = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    const text = $(el).text().trim().slice(0, 80);
    if (href.startsWith("http") && !href.includes(excludeHost) && text.length > 2) {
      anchors.push({ t: text, h: href });
    }
  });
  const seen = new Set<string>();
  return anchors.filter(a => {
    const k = a.h.toLowerCase().replace(/\/$/, "");
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * 两层页面获取：先 Ky HTTP fetch，失败则降级 Playwright
 *
 * - Ky 返回 404/410/5xx → 直判失败，不降级
 * - Ky 网络超时 → PW 使用 TIMEOUT_SLOW（15s）给慢站机会
 * - Ky 其他错误 → PW 使用正常 TIMEOUT（5s）
 *
 * @param onPwStart 可选，Playwright 页面创建前调用（eg. 获取信号量）
 * @param onPwEnd   可选，Playwright 页面关闭后调用（eg. 释放信号量）
 */
export async function fetchPage(
  context: BrowserContext,
  url: string,
  logs: string[],
  label: string,
  onPwStart?: () => Promise<void>,
  onPwEnd?: () => void,
): Promise<FetchResult> {
  let timedOut = false;
  logs.push(`   ⚡${label}... `);
  try {
    const resp = await ky.get(url, { timeout: TIMEOUT, retry: { limit: 1 }, headers: { "User-Agent": UA } });
    const html = await resp.text();
    if (!checkErrorPage(html)) {
      logs[logs.length - 1] += "✅";
      return { html, timedOut: false };
    }
    logs[logs.length - 1] += "⚠ 错误页，降级";
  } catch (err) {
    if (err instanceof HTTPError) {
      const s = err.response.status;
      if (s === 404 || s === 410 || s >= 500) {
        logs[logs.length - 1] += `status=${s}，直判失败`;
        return { html: null, timedOut: false };
      }
      logs[logs.length - 1] += `status=${s}，降级`;
    } else {
      timedOut = true;
      logs[logs.length - 1] += "✗ 超时/失败，降级";
    }
  }

  // 第二层：Playwright 兜底（仅当提供了 browser context 时启用）
  if (!context) {
    // 没有 Playwright，直返失败
    logs[logs.length - 1] += ` 无可用降级`;
    return { html: null, timedOut };
  }
  const pwTimeout = timedOut ? TIMEOUT_SLOW : TIMEOUT;
  logs.push(`   🎭${label}...${timedOut ? "⏳慢站15s" : ""}`);
  if (onPwStart) await onPwStart();
  const page = await context.newPage();
  try {
    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: pwTimeout });
    if (resp) {
      await page.waitForTimeout(RENDER_WAIT);
      const status = resp.status();
      if (status >= 200 && status < 400) {
        const html = await page.content();
        if (!checkErrorPage(html)) {
          logs[logs.length - 1] += "✅";
          await page.close();
          if (onPwEnd) onPwEnd();
          return { html, timedOut };
        }
        logs.push(`   ⚠ ${label} PW ✗ 错误页`);
      } else {
        logs[logs.length - 1] += `✗ status=${status}`;
      }
    } else {
      logs[logs.length - 1] += "✗ 无响应";
    }
  } catch {
    logs[logs.length - 1] += "✗ 超时/失败";
  }
  await page.close();
  if (onPwEnd) onPwEnd();
  return { html: null, timedOut };
}
