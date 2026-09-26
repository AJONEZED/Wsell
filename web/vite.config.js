import { defineConfig } from "vite";

// Project-site base path: https://<owner>.github.io/Wsell/
export default defineConfig({
  base: "/Wsell/",
  build: {
    outDir: "dist",
  },
});
