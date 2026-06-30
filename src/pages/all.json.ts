import { loadSites } from "../utils/load-sites";
import { printProgress, printDone } from "../utils/progress";

export async function GET() {
  const start = performance.now();

  printProgress("❶", "加载友链数据…", 0);
  const sites = await loadSites();
  printProgress("❶", `${sites.length} 站点已加载`, 50);

  const output = { count: sites.length, sites };
  printProgress("❶", "JSON 序列化完成", 100);

  const elapsed = ((performance.now() - start) / 1000).toFixed(1);
  printDone(`/all.json  ${sites.length} 站点，耗时 ${elapsed}s`);

  return new Response(JSON.stringify(output), {
    headers: { "Content-Type": "application/json" },
  });
}
