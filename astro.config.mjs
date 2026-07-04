// @ts-check
import { defineConfig } from "astro/config";

// https://astro.build/config
import path from "node:path";

export default defineConfig({
  output: "static",
  vite: {
    ssr: {
      external: ["@xingwangzhe/bfs-rs", "@xingwangzhe/force-rs"],
    },
    build: {
      rolldownOptions: {
        external: ["@xingwangzhe/force-rs", "@xingwangzhe/bfs-rs"],
      },
    },
  },
});
