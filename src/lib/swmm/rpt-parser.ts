import type { RptBlock, RptDocument } from "./types";

// SWMM5 .rpt files separate sections with a banner of asterisks:
//   ****************
//     Some Title
//   ****************
const BANNER_RE = /^\s*\*{4,}\s*$/;

export function parseRpt(text: string): RptDocument {
  const lines = text.split(/\r?\n/);
  const blocks: RptBlock[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  let i = 0;
  // Capture any preamble (e.g. EPA SWMM 5.x header) as the first block.
  const preamble: string[] = [];
  while (i < lines.length && !BANNER_RE.test(lines[i])) {
    preamble.push(lines[i]);
    i++;
  }
  if (preamble.some((l) => l.trim())) {
    blocks.push({ title: "Header", body: preamble.join("\n").trimEnd() });
  }

  while (i < lines.length) {
    if (!BANNER_RE.test(lines[i])) {
      i++;
      continue;
    }
    // Title lines sit between two banners.
    i++;
    const titleLines: string[] = [];
    while (i < lines.length && !BANNER_RE.test(lines[i])) {
      titleLines.push(lines[i]);
      i++;
    }
    if (i < lines.length) i++; // consume closing banner

    const bodyLines: string[] = [];
    while (i < lines.length && !BANNER_RE.test(lines[i])) {
      bodyLines.push(lines[i]);
      i++;
    }

    const title = titleLines.map((l) => l.trim()).filter(Boolean).join(" ") || "(untitled)";
    blocks.push({ title, body: bodyLines.join("\n").trimEnd() });
  }

  for (const block of blocks) {
    const lowered = block.title.toLowerCase();
    if (lowered.includes("error")) {
      for (const line of block.body.split(/\r?\n/)) {
        const t = line.trim();
        if (t.toUpperCase().startsWith("ERROR")) errors.push(t);
      }
    }
    if (lowered.includes("warning")) {
      for (const line of block.body.split(/\r?\n/)) {
        const t = line.trim();
        if (t.toUpperCase().startsWith("WARNING")) warnings.push(t);
      }
    }
  }

  const summaries: Record<string, Record<string, string>> = {};
  for (const block of blocks) {
    const lowered = block.title.toLowerCase();
    if (
      lowered.includes("continuity") ||
      lowered.includes("analysis options")
    ) {
      summaries[block.title] = extractKeyValues(block.body);
    }
  }

  return { blocks, summaries, errors, warnings };
}

// Two-column "Label .... Value" pairs common in SWMM continuity / options blocks.
function extractKeyValues(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    // Match "Some Label ........... 12.345" or "Label : value"
    const dotted = line.match(/^\s*(.+?)\s*\.{2,}\s*(.+)$/);
    const colon = !dotted ? line.match(/^\s*(.+?)\s*:\s*(.+)$/) : null;
    const m = dotted ?? colon;
    if (!m) continue;
    const key = m[1].trim();
    const val = m[2].trim();
    if (key && val) out[key] = val;
  }
  return out;
}
