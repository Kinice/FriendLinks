import { loadSites } from "../utils/load-sites";
import { printProgress, printDone } from "../utils/progress";

function getHost(u: string): string {
  try {
    return new URL(u).hostname.toLowerCase();
  } catch {
    return u.toLowerCase();
  }
}

export async function GET() {
  const start = performance.now();

  printProgress("❶", "加载友链数据…", 0);
  const validSites = await loadSites();
  printProgress("❶", `已加载 ${validSites.length} 个站点`, 20);

  const siteHostSet = new Set<string>();
  for (const s of validSites) {
    siteHostSet.add(getHost(s.url));
  }

  const linkMap = new Map<string, Set<string>>();
  for (const s of validSites) {
    linkMap.set(getHost(s.url), new Set());
  }

  let externalFriendsCount = 0;
  for (const s of validSites) {
    const sourceNorm = getHost(s.url);
    for (const f of s.friends) {
      const targetHost = getHost(f.url);
      if (siteHostSet.has(targetHost)) {
        linkMap.get(sourceNorm)!.add(targetHost);
      } else {
        externalFriendsCount++;
      }
    }
  }

  // 统计外部友链节点的唯一数量
  const externalHosts = new Set<string>();
  for (const s of validSites) {
    for (const f of s.friends) {
      const targetHost = getHost(f.url);
      if (!siteHostSet.has(targetHost)) {
        externalHosts.add(targetHost);
      }
    }
  }
  printProgress("❶", "链接映射构建完成", 40);

  const stats = {
    coreNodes: {
      count: validSites.length,
      uniqueHosts: siteHostSet.size,
    },
    friendNodes: {
      total: externalHosts.size,
      externalFriends: externalFriendsCount,
    },
    connections: {
      coreToCore: {
        total: 0,
        bidirectional: 0,
        unidirectional: 0,
      },
      coreToFriend: externalFriendsCount,
      total: 0,
    },
    overview: {
      totalNodes: 0,
      totalConnections: 0,
    },
  };

  printProgress("❷", "计算核心节点连接…", 50);
  const processedCoreLinks = new Set<string>();
  for (const [sourceHost, targetHosts] of linkMap) {
    for (const targetNorm of targetHosts) {
      const pairKey = [sourceHost, targetNorm].sort().join("<->");
      if (processedCoreLinks.has(pairKey)) continue;
      processedCoreLinks.add(pairKey);
      if (sourceHost === targetNorm) continue;

      const aLinksB = linkMap.get(sourceHost)?.has(targetNorm);
      const bLinksA = linkMap.get(targetNorm)?.has(sourceHost);

      stats.connections.coreToCore.total++;
      if (aLinksB && bLinksA) {
        stats.connections.coreToCore.bidirectional++;
      } else {
        stats.connections.coreToCore.unidirectional++;
      }
    }
  }

  stats.connections.total = stats.connections.coreToCore.total + stats.connections.coreToFriend;
  stats.overview.totalConnections = stats.connections.total;
  stats.overview.totalNodes = validSites.length + externalHosts.size;
  printProgress("❷", "连接统计完成", 75);

  // 统计友链页面路由分布
  const linkRoutes: Record<string, number> = {};
  for (const s of validSites) {
    if (s.links) {
      linkRoutes[s.links] = (linkRoutes[s.links] || 0) + 1;
    }
  }
  const linkRoutesSorted = Object.entries(linkRoutes)
    .sort(([, a], [, b]) => b - a)
    .map(([route, count]) => ({ route, count }));

  const statsWithRoutes = { ...stats, linkRoutes: linkRoutesSorted };
  printProgress("❷", "路由统计完成", 100);

  const elapsed = ((performance.now() - start) / 1000).toFixed(1);
  printDone(`/stats.json  ${validSites.length} 站点，${stats.connections.total} 连接，耗时 ${elapsed}s`);

  return new Response(JSON.stringify(statsWithRoutes), {
    headers: { "Content-Type": "application/json" },
  });
}
