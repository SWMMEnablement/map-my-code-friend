export interface ParseIssue {
  severity: "error" | "warning";
  line: number; // 1-indexed; 0 if unknown
  message: string;
}

export interface InpSection {
  name: string;
  columns?: string[];
  rows: string[][];
  raw: string;
}

export interface InpDocument {
  sections: Record<string, InpSection>;
  order: string[];
  warnings: string[];
  issues: ParseIssue[];
}

export interface RptBlock {
  title: string;
  body: string;
}

export interface RptDocument {
  blocks: RptBlock[];
  summaries: Record<string, Record<string, string>>;
  errors: string[];
  warnings: string[];
  issues: ParseIssue[];
}

export const MAX_SWMM_BYTES = 10 * 1024 * 1024;
