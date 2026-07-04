import { loadSites } from "../utils/load-sites";
import { printProgress, printDone } from "../utils/progress";

export async function GET() {
  const start = performance.now();

  printProgress("❶", "加载友链数据…", 0);
  const allSites = await loadSites(undefined, (i, total) => {
    const pct = Math.round((i / total) * 50);
    printProgress("❶", `${i}/${total} 站点已加载`, pct);
  });
  printProgress("❶", `${allSites.length} 站点加载完成`, 50);

  // DEV 模式只取 100 个站点，快速预览
  const sites = import.meta.env.DEV && allSites.length > 100
    ? [...allSites].sort(() => Math.random() - 0.5).slice(0, 100)
    : allSites;
  printProgress("❶", "JSON 序列化完成", 100);

  const elapsed = ((performance.now() - start) / 1000).toFixed(1);
  printDone(`/all.json  ${sites.length} 站点，耗时 ${elapsed}s`);

  return new Response(JSON.stringify(output), {
    headers: { "Content-Type": "application/json" },
  });
}
