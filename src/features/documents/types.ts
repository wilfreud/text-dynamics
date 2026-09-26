export interface Document {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  charCount: number;
  lineCount: number;
}

export interface CreateDocumentInput {
  title?: string;
  content: string;
}

export interface UpdateDocumentInput {
  id: string;
  title?: string;
  content?: string;
}
