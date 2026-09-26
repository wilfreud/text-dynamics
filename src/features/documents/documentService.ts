import {
  ipcCreateDocument,
  ipcDeleteDocument,
  ipcGetDocument,
  ipcListDocuments,
  ipcUpdateDocument,
  type DocumentRecordDto,
  type DocumentSummaryDto,
} from "../../lib/tauri/ipc";
import { getLogger } from "../../lib/logging";
import type { CreateDocumentInput, Document, DocumentSummary, UpdateDocumentInput } from "./types";

const logger = getLogger(["app"]);

function mapRecordDtoToDocument(dto: DocumentRecordDto): Document {
  return {
    id: dto.id,
    title: dto.title,
    content: dto.content,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

function mapSummaryDtoToSummary(dto: DocumentSummaryDto): DocumentSummary {
  return {
    id: dto.id,
    title: dto.title,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
    charCount: dto.char_count,
    lineCount: dto.line_count,
  };
}

export async function fetchDocumentList(): Promise<DocumentSummary[]> {
  try {
    const list = await ipcListDocuments();
    return list.map(mapSummaryDtoToSummary);
  } catch (error) {
    logger.error("Failed to list documents: {error}", { error: String(error) });
    throw error;
  }
}

export async function fetchDocumentById(id: string): Promise<Document> {
  try {
    const doc = await ipcGetDocument(id);
    return mapRecordDtoToDocument(doc);
  } catch (error) {
    logger.error("Failed to fetch document id={id}: {error}", { id, error: String(error) });
    throw error;
  }
}

export async function saveNewDocument(input: CreateDocumentInput): Promise<Document> {
  try {
    const title = input.title?.trim() || "Untitled Document";
    const doc = await ipcCreateDocument(title, input.content);
    logger.info("Saved new document id={id}", { id: doc.id });
    return mapRecordDtoToDocument(doc);
  } catch (error) {
    logger.error("Failed to save new document: {error}", { error: String(error) });
    throw error;
  }
}

export async function updateExistingDocument(input: UpdateDocumentInput): Promise<Document> {
  try {
    const doc = await ipcUpdateDocument(input.id, input.title, input.content);
    logger.info("Updated document id={id}", { id: doc.id });
    return mapRecordDtoToDocument(doc);
  } catch (error) {
    logger.error("Failed to update document id={id}: {error}", { id: input.id, error: String(error) });
    throw error;
  }
}

export async function removeDocument(id: string): Promise<void> {
  try {
    await ipcDeleteDocument(id);
    logger.info("Removed document id={id}", { id });
  } catch (error) {
    logger.error("Failed to remove document id={id}: {error}", { id, error: String(error) });
    throw error;
  }
}
