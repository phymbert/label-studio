import { registerAnalytics } from "@humansignal/core";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App";
import { setupServiceWorker } from "./utils/service-worker";
import "./utils/state-registry-lso";
import "@humansignal/ui/src/tailwind.css";
import "./app/App.scss";

registerAnalytics();

setupServiceWorker();

const rootElement = document.getElementById("root") ?? document.querySelector(".app-wrapper");

if (rootElement) {
  createRoot(rootElement).render(<App />);
}
