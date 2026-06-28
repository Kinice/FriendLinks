import { loadSites } from "../utils/load-sites";

function getHost(u: string): string {
  try {
    return new URL(u).hostname.toLowerCase();
  } catch {
    return u.toLowerCase();
  }
}

export async function GET() {
  const validSites = await loadSites();

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

  return new Response(JSON.stringify(stats, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
}
