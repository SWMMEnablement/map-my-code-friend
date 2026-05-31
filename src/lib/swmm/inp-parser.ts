import type { InpDocument, InpSection } from "./types";

const SECTION_RE = /^\s*\[([A-Z0-9_ ]+)\]\s*$/i;

// Strip inline `;` comments. The first `;` on a non-comment line starts a comment.
function stripComment(line: string): { content: string; comment?: string } {
  const idx = line.indexOf(";");
  if (idx === -1) return { content: line };
  return { content: line.slice(0, idx), comment: line.slice(idx + 1).trim() };
}

function tokenize(line: string): string[] {
  return line.trim().split(/\s+/).filter(Boolean);
}

export function parseInp(text: string): InpDocument {
  const warnings: string[] = [];
  const order: string[] = [];
  const sections: Record<string, InpSection> = {};

  let current: InpSection | null = null;
  let rawBuffer: string[] = [];
  // Track the most recent comment line — SWMM convention puts column headers
  // on a `;;Name  Type  ...` line directly above the section data.
  let lastCommentLine: string | null = null;

  const flush = () => {
    if (current) {
      current.raw = rawBuffer.join("\n");
      sections[current.name] = current;
    }
    rawBuffer = [];
    lastCommentLine = null;
  };

  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const sectionMatch = line.match(SECTION_RE);
    if (sectionMatch) {
      flush();
      const name = sectionMatch[1].trim().toUpperCase();
      if (sections[name]) {
        warnings.push(`Duplicate section [${name}] — later occurrence merged.`);
        current = sections[name];
        rawBuffer = [current.raw];
      } else {
        current = { name, rows: [], raw: "" };
        order.push(name);
      }
      continue;
    }

    if (!current) {
      // Pre-section preamble — keep as a synthetic TITLE-ish block only if non-empty.
      if (line.trim()) {
        if (!sections.__PREAMBLE__) {
          sections.__PREAMBLE__ = { name: "__PREAMBLE__", rows: [], raw: "" };
          order.unshift("__PREAMBLE__");
        }
        sections.__PREAMBLE__.rows.push([line]);
        sections.__PREAMBLE__.raw += line + "\n";
      }
      continue;
    }

    rawBuffer.push(line);

    const trimmed = line.trim();
    if (!trimmed) {
      lastCommentLine = null;
      continue;
    }

    if (trimmed.startsWith(";")) {
      // `;;Header line` — strip leading semicolons for column hints.
      lastCommentLine = trimmed.replace(/^;+/, "").trim();
      continue;
    }

    const { content } = stripComment(line);
    const tokens = tokenize(content);
    if (tokens.length === 0) continue;

    if (!current.columns && lastCommentLine) {
      const cols = tokenize(lastCommentLine);
      if (cols.length > 0) current.columns = cols;
      lastCommentLine = null;
    }
    current.rows.push(tokens);
  }
  flush();

  return { sections, order, warnings };
}
