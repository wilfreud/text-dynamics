import {
  ipcClearActivityHistory,
  ipcClearDiagnosticLogs,
  ipcGetCurrentSessionId,
  ipcListActivityEvents,
  ipcListDiagnosticLogs,
  ipcListSessions,
  ipcOpenLogsFolder,
  type ActivityEventsFilterDto,
  type ActivityEventsResponseDto,
  type DiagnosticLogsFilterDto,
  type DiagnosticLogsResponseDto,
  type SessionSummaryDto,
} from "../../lib/tauri/ipc";

export async function fetchActivityEvents(
  filter: ActivityEventsFilterDto
): Promise<ActivityEventsResponseDto> {
  return ipcListActivityEvents(filter);
}

export async function fetchSessions(): Promise<SessionSummaryDto[]> {
  return ipcListSessions();
}

export async function fetchCurrentSessionId(): Promise<string> {
  return ipcGetCurrentSessionId();
}

export async function fetchDiagnosticLogs(
  filter: DiagnosticLogsFilterDto
): Promise<DiagnosticLogsResponseDto> {
  return ipcListDiagnosticLogs(filter);
}

export async function openLogsFolder(): Promise<void> {
  return ipcOpenLogsFolder();
}

export async function clearActivityHistory(): Promise<void> {
  return ipcClearActivityHistory();
}

export async function clearDiagnosticLogs(): Promise<void> {
  return ipcClearDiagnosticLogs();
}

export function formatFriendlyDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    const timeStr = d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    if (isToday) return `Today ${timeStr}`;
    if (isYesterday) return `Yesterday ${timeStr}`;

    return `${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${timeStr}`;
  } catch {
    return isoString;
  }
}

export function formatEventTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return isoString;
  }
}
