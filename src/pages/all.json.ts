import { loadSites } from "../utils/load-sites";

export async function GET() {
  const sites = await loadSites();
  const output = { count: sites.length, sites };
  return new Response(JSON.stringify(output, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
}
