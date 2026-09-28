import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { initLogging, getLogger } from "./lib/logging";
import { ErrorBoundary } from "./components/ErrorBoundary";

void initLogging().then(() => {
  const logger = getLogger(["app"]);
  logger.info("Text Dynamics frontend initialized");
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);

