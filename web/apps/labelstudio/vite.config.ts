import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import path from "path";

const css_prefix = "lsf-";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, "../../"), "");
  const envVars = {
    ...env,
    NODE_ENV: mode,
    CSS_PREFIX: css_prefix,
  };

  return {
    base: "/react-app/",
    define: {
      "process.env": envVars,
      "process.env.RELEASE_NAME": JSON.stringify(env.RELEASE_NAME),
    },
    build: {
      outDir: path.resolve(__dirname, "../../dist/apps/labelstudio"),
      emptyOutDir: true,
      sourcemap: mode !== "production",
      manifest: true,
      assetsDir: ".",
      cssCodeSplit: false,
      rollupOptions: {
        input: path.resolve(__dirname, "./index.html"),
        output: {
          entryFileNames: "main.js",
          chunkFileNames: (chunkInfo) => (chunkInfo.name === "vendor" ? "vendor.js" : "[name].js"),
          manualChunks: {
            vendor: [
              "react",
              "react-dom",
              "react-router",
              "react-router-dom",
              "mobx",
              "mobx-react",
              "mobx-react-lite",
              "mobx-state-tree",
            ],
          },
          assetFileNames: ({ name }) => {
            if (name && name.endsWith(".css")) return "main.css";
            return "[name].[ext]";
          },
        },
      },
    },
    plugins: [
      svgr({
        exportAsDefault: true,
      }),
      react({
        babel: {
          plugins: [
            ["babel-plugin-transform-class-properties"],
            ["babel-plugin-transform-private-methods", { loose: true }],
            ["@babel/plugin-proposal-private-property-in-object", { loose: true }],
            ["@babel/plugin-proposal-class-properties", { loose: true }],
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        react: path.resolve(__dirname, "../../node_modules/react"),
        "react-dom": path.resolve(__dirname, "../../node_modules/react-dom"),
        "react-joyride": path.resolve(__dirname, "../../node_modules/react-joyride"),
        "@humansignal/ui": path.resolve(__dirname, "../../libs/ui"),
        "@humansignal/core": path.resolve(__dirname, "../../libs/core"),
      },
    },
    server: {
      port: Number(new URL(env.FRONTEND_HOSTNAME || "http://localhost:8010").port || 8010),
      strictPort: true,
      host: "0.0.0.0",
      proxy: {
        "/api": {
          target: `${env.DJANGO_HOSTNAME || "http://localhost:8080"}/api`,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
          secure: false,
        },
        "/": {
          target: env.DJANGO_HOSTNAME || "http://localhost:8080",
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
