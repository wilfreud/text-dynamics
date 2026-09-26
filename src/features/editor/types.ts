export interface SourceUnit {
  id: string;
  text: string;
  lineIndex: number;
}

export interface EditorState {
  documentId: string | null;
  title: string;
  content: string;
  selectedUnitId: string | null;
  isDirty: boolean;
}
