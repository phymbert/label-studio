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
    base: env.MODE?.startsWith("standalone") ? "/" : "/label-studio-frontend/",
    define: {
      "process.env": envVars,
      "process.env.RELEASE_NAME": JSON.stringify(env.RELEASE_NAME),
    },
    build: {
      outDir: path.resolve(__dirname, "../../dist/libs/editor"),
      emptyOutDir: true,
      sourcemap: mode !== "production",
      assetsDir: ".",
      cssCodeSplit: false,
      lib: {
        entry: path.resolve(__dirname, "./src/standalone.js"),
        name: "editor",
        formats: ["umd"],
        fileName: () => "editor.js",
      },
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, "./public/index.html"),
        },
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
    server: {
      port: Number(env.LSF_PORT || 3000),
      host: "0.0.0.0",
    },
  };
});
