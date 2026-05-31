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
}

export const MAX_SWMM_BYTES = 10 * 1024 * 1024;
