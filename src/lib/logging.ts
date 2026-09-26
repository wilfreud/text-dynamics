import { configure, getConsoleSink, getLogger, type LogRecord, type Sink } from "@logtape/logtape";
import { DEFAULT_REDACT_FIELDS, redactByField } from "@logtape/redaction";
import { isTauri } from "@tauri-apps/api/core";
import * as tauriLog from "@tauri-apps/plugin-log";

export const LOG_CATEGORIES = [
  "app",
  "editor",
  "analysis",
  "graph",
  "settings",
  "ipc",
] as const;

export type LogCategory = (typeof LOG_CATEGORIES)[number];

const SENSITIVE_PATTERNS = [
  /api[-_]?key/i,
  /auth(?:orization)?/i,
  /token/i,
  /password/i,
  /secret/i,
  /source[-_]?text/i,
  /full[-_]?text/i,
  /poem/i,
  ...DEFAULT_REDACT_FIELDS,
];

function formatRecordMessage(record: LogRecord): string {
  const parts = record.message.map((part) => {
    if (typeof part === "object" && part !== null) {
      try {
        return JSON.stringify(part);
      } catch {
        return String(part);
      }
    }
    return String(part);
  });
  const cat = record.category.join(":");
  const hasProps = Object.keys(record.properties).length > 0;
  const propsStr = hasProps ? ` ${JSON.stringify(record.properties)}` : "";
  return `[${cat}] ${parts.join("")}${propsStr}`;
}

function createTauriBridgeSink(): Sink {
  return async (record: LogRecord) => {
    if (!isTauri()) return;
    const msg = formatRecordMessage(record);
    try {
      switch (record.level) {
        case "trace":
          await tauriLog.trace(msg);
          break;
        case "debug":
          await tauriLog.debug(msg);
          break;
        case "info":
          await tauriLog.info(msg);
          break;
        case "warning":
          await tauriLog.warn(msg);
          break;
        case "error":
        case "fatal":
          await tauriLog.error(msg);
          break;
      }
    } catch {
      // Ignore bridge errors to prevent logging loop / app crashes
    }
  };
}

let loggingInitialized = false;

export async function initLogging(): Promise<void> {
  if (loggingInitialized) return;

  const redactionOptions = {
    fieldPatterns: SENSITIVE_PATTERNS,
    action: () => "[REDACTED]",
  };

  const consoleSink = redactByField(getConsoleSink(), redactionOptions);
  const tauriSink = redactByField(createTauriBridgeSink(), redactionOptions);

  await configure({
    sinks: {
      console: consoleSink,
      tauri: tauriSink,
    },
    loggers: [
      {
        category: [],
        sinks: ["console", "tauri"],
        lowestLevel: "info",
      },
      ...LOG_CATEGORIES.map((category) => ({
        category: [category],
        sinks: ["console", "tauri"],
        lowestLevel: "debug" as const,
      })),
      {
        category: ["logtape", "meta"],
        sinks: ["console"],
        lowestLevel: "warning" as const,
      },
    ],
  });

  loggingInitialized = true;
}

export { getLogger };
