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
    base: "/playground-assets/",
    define: {
      "process.env": envVars,
      "process.env.RELEASE_NAME": JSON.stringify(env.RELEASE_NAME),
    },
    build: {
      outDir: path.resolve(__dirname, "../../dist/apps/playground/playground-assets"),
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
            vendor: ["react", "react-dom"],
          },
          assetFileNames: ({ name }) => {
            if (name && name.endsWith(".css")) return "main.css";
            return "[name].[ext]";
          },
        },
      },
    },
    plugins: [svgr({ exportAsDefault: true }), react()],
    resolve: {
      alias: {
        react: path.resolve(__dirname, "../../node_modules/react"),
        "react-dom": path.resolve(__dirname, "../../node_modules/react-dom"),
        "@humansignal/ui": path.resolve(__dirname, "../../libs/ui"),
        "@humansignal/core": path.resolve(__dirname, "../../libs/core"),
      },
    },
    server: {
      port: 4200,
      host: "0.0.0.0",
    },
  };
});
