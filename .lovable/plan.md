# Server-side SWMM file upload + parsing

Add HTTP endpoints that accept EPA SWMM `.inp` (input) and `.rpt` (report) files, parse them on the server, and return structured JSON the frontend can render. Today all `.inp/.rpt` I/O in the BobSWMM project is client-side — this moves the heavy lifting to the API server so deeper analyses (cross-section diffs, multi-file aggregation, validation) can run without shipping parsers and large files to the browser.

Scope of this change (in this Lovable TanStack Start project):

1. Two pure parsers, no native deps (Worker-safe).
2. Two server routes for raw multipart uploads.
3. One typed server function for already-loaded text (small files, programmatic use).
4. A minimal `/inp-analyzer` route that uploads a file and renders the parsed result, so the pipeline is verifiable end-to-end.

## File layout

```text
src/lib/swmm/
  inp-parser.ts        # parseInp(text) -> InpDocument
  rpt-parser.ts        # parseRpt(text) -> RptDocument
  types.ts             # InpDocument, RptDocument, SwmmSection, etc.
  validate.ts          # zod schemas for parsed shapes + size/ext guards
  parse.functions.ts   # createServerFn wrappers (text-in, JSON-out)

src/routes/api/swmm/
  inp.ts               # POST multipart .inp  -> InpDocument JSON
  rpt.ts               # POST multipart .rpt  -> RptDocument JSON

src/routes/inp-analyzer.tsx   # minimal upload UI calling /api/swmm/inp
```

## Parser behavior

- `.inp`: tokenize by `[SECTION]` headers (TITLE, OPTIONS, JUNCTIONS, CONDUITS, SUBCATCHMENTS, RAINGAGES, TIMESERIES, REPORT, etc.). For each section, split lines, strip `;` comments, return `{ name, columns?, rows: string[][], raw: string }`. Unknown sections preserved as raw. Return `{ sections: Record<string, Section>, order: string[], warnings: string[] }`.
- `.rpt`: split on the SWMM5 banner rule (`  *****`), capture each block's title + body, plus targeted extractors for `Analysis Options`, `Runoff Quantity Continuity`, `Flow Routing Continuity`, `Node Depth Summary`, `Link Flow Summary`, `Analysis Errors/Warnings`. Return `{ blocks: Block[], summaries: {...}, errors: string[], warnings: string[] }`.
- Both parsers are pure functions over `string`. No fs, no streams — Worker-safe.

## HTTP surface

`POST /api/swmm/inp` and `POST /api/swmm/rpt`
- `multipart/form-data` with field `file`, OR `text/plain` body for direct paste.
- Size guard: reject > 10 MB with 413 (constant in `validate.ts`).
- Extension guard on multipart filename (`.inp` / `.rpt`).
- Response: `200 { ok: true, document }` or `4xx { ok: false, error }`.
- Errors handled in-route; no PII; no auth required for now (local tool).

`parseInpFn` / `parseRptFn` server functions
- `createServerFn({ method: "POST" })` with zod `inputValidator({ text: z.string().max(MAX) })`.
- For programmatic use from loaders/components without multipart.

## Minimal UI route

`/inp-analyzer`: `<input type="file" accept=".inp">` → fetch `/api/swmm/inp` → render section list + first 20 rows of each section in a collapsible. Just enough to prove the round-trip. Not a redesign of the existing BobSWMM analyzer.

## Out of scope

- Persisting uploads (no DB, no storage bucket). Files are parsed in-memory and discarded.
- Auth / per-user history.
- RPT charting, INP graph/network reconstruction, cross-file diff — these layer on top of the JSON returned here.
- Porting the full BobSWMM monorepo into this project.

## Technical notes

- Runs on Cloudflare Workers SSR. Parsers use only `string` + `RegExp`, no Node-only modules.
- 10 MB cap fits typical SWMM models; raise later if needed.
- Section + block shapes are returned as plain DTOs (string-only cells) — typed coercion (numbers, dates) is a follow-up so the first cut never throws on odd inputs.

## Verification

After build, POST a small `.inp` and `.rpt` via `invoke-server-function` and confirm the JSON shape, then load `/inp-analyzer` in the preview and upload a file.
