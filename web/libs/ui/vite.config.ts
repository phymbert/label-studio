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
    base: "/",
    define: {
      "process.env": envVars,
      "process.env.RELEASE_NAME": JSON.stringify(env.RELEASE_NAME),
    },
    build: {
      outDir: path.resolve(__dirname, "../../dist/libs/ui"),
      emptyOutDir: true,
      sourcemap: mode !== "production",
      assetsDir: ".",
      cssCodeSplit: false,
      lib: {
        entry: path.resolve(__dirname, "./src/index.ts"),
        name: "ui",
        formats: ["umd"],
        fileName: () => "ui.js",
      },
      rollupOptions: {
        output: {
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
  };
});
