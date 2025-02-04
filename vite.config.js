import { resolve } from "path";
import { defineConfig } from "vite";

export default {
  base: "/STM_web_controller/",
  root: resolve(__dirname, "src"),
  build: {
    outDir: "dist",
    assetsDir: "assets",
  },
  server: {
    port: 8080,
  },
};
