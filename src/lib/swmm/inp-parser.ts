import type { InpDocument, InpSection, ParseIssue } from "./types";

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
  const issues: ParseIssue[] = [];
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
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const lineNo = lineIdx + 1;
    const sectionMatch = line.match(SECTION_RE);
    if (sectionMatch) {
      flush();
      const name = sectionMatch[1].trim().toUpperCase();
      if (sections[name]) {
        const msg = `Duplicate section [${name}] at line ${lineNo} — later occurrence merged.`;
        warnings.push(msg);
        issues.push({ severity: "warning", line: lineNo, message: msg });
        current = sections[name];
        rawBuffer = [current.raw];
      } else {
        current = { name, rows: [], raw: "" };
        order.push(name);
      }
      continue;
    }

    if (!current) {
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
      lastCommentLine = trimmed.replace(/^;+/, "").trim();
      continue;
    }

    const { content } = stripComment(line);
    const tokens = tokenize(content);
    if (tokens.length === 0) continue;

    if (!current.columns && lastCommentLine) {
      const cols = tokenize(lastCommentLine);
      if (cols.length > 0) {
        current.columns = cols;
        // If a previous row in this section had a different column count,
        // surface it as a soft warning.
        const prior = current.rows[0];
        if (prior && prior.length !== cols.length) {
          issues.push({
            severity: "warning",
            line: lineNo,
            message: `Section [${current.name}] row has ${prior.length} columns but header declares ${cols.length}.`,
          });
        }
      }
      lastCommentLine = null;
    }

    if (current.columns && tokens.length !== current.columns.length) {
      issues.push({
        severity: "warning",
        line: lineNo,
        message: `Section [${current.name}] row has ${tokens.length} columns, expected ${current.columns.length}.`,
      });
    }

    current.rows.push(tokens);
  }
  flush();

  const realSections = order.filter((n) => n !== "__PREAMBLE__");
  if (realSections.length === 0) {
    issues.push({
      severity: "error",
      line: 0,
      message: "No [SECTION] headers found — file does not look like a SWMM .inp.",
    });
  }


  return { sections, order, warnings, issues };
}
