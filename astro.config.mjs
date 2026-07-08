import tailwindcss from "@tailwindcss/vite";
// @ts-check
import { defineConfig } from "astro/config";

// https://astro.build/config
import path from "node:path";

export default defineConfig({
	output: "static",
  vite: {
		plugins: [tailwindcss()],
    ssr: {
      external: ["@xingwangzhe/bfs-rs", "@xingwangzhe/force-rs"],
    },
    build: {
      rolldownOptions: {
        external: ["@xingwangzhe/force-rs", "@xingwangzhe/bfs-rs"],
        output: {
          manualChunks(id) {
            if (id.includes("node_modules/three/")) return "vendor-three";
            if (id.includes("node_modules/flexsearch/")) return "vendor-flexsearch";
            if (id.includes("node_modules/msgpackr/")) return "vendor-msgpackr";
          },
        },
      },
    },
  },
});
