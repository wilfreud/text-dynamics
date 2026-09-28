import type {
  ActivityEventDto,
  ActivityEventsFilterDto,
  ActivityEventsResponseDto,
  DiagnosticLogEntryDto,
  DiagnosticLogsFilterDto,
  DiagnosticLogsResponseDto,
  SessionSummaryDto,
} from "../../lib/tauri/ipc";

export type {
  ActivityEventDto,
  ActivityEventsFilterDto,
  ActivityEventsResponseDto,
  DiagnosticLogEntryDto,
  DiagnosticLogsFilterDto,
  DiagnosticLogsResponseDto,
  SessionSummaryDto,
};

export type HistoryTab = "activity" | "diagnostics";

export interface HighlightSegment {
  text: string;
  isMatch: boolean;
}
