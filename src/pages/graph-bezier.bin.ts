import { loadSites } from "../utils/sites";
import { getBuildResult } from "../utils/build-graph";
import { encode } from "msgpackr";
import { printProgress, printDone } from "../utils/progress";
import { isFastMode } from "../utils/sample";
import { zstdCompress } from "../utils/compress";

export async function GET() {
  const startTime = performance.now();
  printProgress("❶", "加载站点数据…", 0);
  const sites = await loadSites();
  printDone(`${sites.length} 个站点`);
  const data = await getBuildResult(sites);

  const bezier = {
    lseg: data.lseg,
    bcx: data.bcx,
    bcy: data.bcy,
    bcz: data.bcz,
  };

  const encoded = Buffer.from(encode(bezier) as any);
  const body = isFastMode() ? encoded : await zstdCompress(encoded);
  const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
  printDone(
    `/graph-bezier.bin 完成 · ${data.ls.length} 边 · ${(body.length / 1024 / 1024).toFixed(1)}MB · 耗时 ${elapsed}s`,
  );
  return new Response(body as BodyInit, {
    headers: { "Content-Type": "application/octet-stream" },
  });
}
