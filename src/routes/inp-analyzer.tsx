import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import jsPDF from "jspdf";
import {
  AlertTriangle,
  ChevronRight,
  FileText,
  FolderTree,
  Info,
  ListTree,
  XCircle,
} from "lucide-react";

import type { InpDocument, RptDocument } from "@/lib/swmm/types";
import { SAMPLE_INP } from "@/lib/swmm/sample";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

// Logical groupings for SWMM .inp sections so users can scan by domain.
const INP_GROUPS: { label: string; sections: string[] }[] = [
  { label: "Project", sections: ["TITLE", "OPTIONS", "REPORT", "FILES", "EVAPORATION", "TEMPERATURE", "ADJUSTMENTS"] },
  { label: "Climatology", sections: ["RAINGAGES", "TIMESERIES", "PATTERNS"] },
  { label: "Hydrology", sections: ["SUBCATCHMENTS", "SUBAREAS", "INFILTRATION", "AQUIFERS", "GROUNDWATER", "SNOWPACKS", "HYDROGRAPHS", "LID_CONTROLS", "LID_USAGE"] },
  { label: "Hydraulics — Nodes", sections: ["JUNCTIONS", "OUTFALLS", "DIVIDERS", "STORAGE"] },
  { label: "Hydraulics — Links", sections: ["CONDUITS", "PUMPS", "ORIFICES", "WEIRS", "OUTLETS", "XSECTIONS", "TRANSECTS", "LOSSES"] },
  { label: "Quality", sections: ["POLLUTANTS", "LANDUSES", "BUILDUP", "WASHOFF", "COVERAGES", "LOADINGS", "TREATMENT"] },
  { label: "Controls & Inflows", sections: ["CONTROLS", "INFLOWS", "DWF", "RDII", "HYDROGRAPHS"] },
  { label: "Map & Geometry", sections: ["MAP", "COORDINATES", "VERTICES", "POLYGONS", "SYMBOLS", "LABELS", "BACKDROP"] },
];

export const Route = createFileRoute("/inp-analyzer")({
  head: () => ({
    meta: [
      { title: "SWMM INP / RPT Analyzer" },
      {
        name: "description",
        content:
          "Upload an EPA SWMM .inp or .rpt file, inspect parsed sections, and export the results as JSON or PDF.",
      },
    ],
  }),
  component: Analyzer,
});

type Kind = "inp" | "rpt";

function Analyzer() {
  const [kind, setKind] = useState<Kind>("inp");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inp, setInp] = useState<InpDocument | null>(null);
  const [rpt, setRpt] = useState<RptDocument | null>(null);
  const [sourceName, setSourceName] = useState<string>("");

  async function parse(file: File) {
    setBusy(true);
    setError(null);
    setInp(null);
    setRpt(null);
    setSourceName(file.name);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/swmm/${kind}`, { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
        if (json.issues) console.warn("parse issues", json.issues);
        return;
      }
      if (kind === "inp") setInp(json.document as InpDocument);
      else setRpt(json.document as RptDocument);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function loadSample() {
    setKind("inp");
    const file = new File([SAMPLE_INP], "sample.inp", { type: "text/plain" });
    await parse(file);
  }

  const activeDoc = inp ?? rpt;
  const activeKind: Kind | null = inp ? "inp" : rpt ? "rpt" : null;

  function exportJSON() {
    if (!activeDoc) return;
    const blob = new Blob([JSON.stringify(activeDoc, null, 2)], {
      type: "application/json",
    });
    triggerDownload(blob, `${baseName(sourceName)}.json`);
  }

  function exportPDF() {
    if (!activeDoc || !activeKind) return;
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    renderPDF(doc, activeKind, activeDoc, sourceName);
    doc.save(`${baseName(sourceName)}.pdf`);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="border-b border-border pb-6">
        <h1 className="text-3xl font-semibold tracking-tight">SWMM File Analyzer</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Server-side parsing of EPA SWMM5 <code>.inp</code> input and{" "}
          <code>.rpt</code> report files. Inspect sections, validate structure,
          and export results.
        </p>
      </header>

      <section className="mt-6 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-4">
          <fieldset className="flex items-center gap-3 text-sm">
            <legend className="sr-only">File kind</legend>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={kind === "inp"}
                onChange={() => setKind("inp")}
              />
              .inp input
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={kind === "rpt"}
                onChange={() => setKind("rpt")}
              />
              .rpt report
            </label>
          </fieldset>

          <input
            type="file"
            accept={kind === "inp" ? ".inp" : ".rpt"}
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void parse(f);
            }}
            className="text-sm"
          />

          <button
            type="button"
            onClick={() => void loadSample()}
            disabled={busy}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
          >
            Load sample .inp
          </button>

          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={exportJSON}
              disabled={!activeDoc}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-40"
            >
              Export JSON
            </button>
            <button
              type="button"
              onClick={exportPDF}
              disabled={!activeDoc}
              className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-40"
            >
              Export PDF
            </button>
          </div>
        </div>

        {sourceName && (
          <p className="mt-3 text-xs text-muted-foreground">
            Source: <span className="font-mono">{sourceName}</span>
          </p>
        )}
        {busy && <p className="mt-3 text-sm">Parsing…</p>}
        {error && (
          <p className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </section>

      {inp && <InpView doc={inp} />}
      {rpt && <RptView doc={rpt} />}
      {!activeDoc && !busy && !error && (
        <p className="mt-10 text-center text-sm text-muted-foreground">
          Upload a file or click <strong>Load sample .inp</strong> to see results.
        </p>
      )}
    </div>
  );
}

function InpView({ doc }: { doc: InpDocument }) {
  const stats = useMemo(() => {
    const totalRows = doc.order.reduce(
      (n, s) => n + (doc.sections[s]?.rows.length ?? 0),
      0,
    );
    return { sections: doc.order.length, rows: totalRows };
  }, [doc]);

  return (
    <section className="mt-8 space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Sections" value={stats.sections} />
        <Stat label="Total rows" value={stats.rows} />
        <Stat label="Issues" value={doc.issues.length} />
        <Stat label="Warnings" value={doc.warnings.length} />
      </div>

      {doc.issues.length > 0 && (
        <ul className="rounded border border-border bg-card p-3 text-sm">
          {doc.issues.map((iss, i) => (
            <li
              key={i}
              className={iss.severity === "error" ? "text-red-600" : "text-amber-700"}
            >
              {iss.severity === "error" ? "✖" : "⚠"}{" "}
              {iss.line ? `line ${iss.line}: ` : ""}
              {iss.message}
            </li>
          ))}
        </ul>
      )}

      <h2 className="pt-2 text-lg font-semibold">Sections</h2>
      <div className="space-y-2">
        {doc.order.map((name) => {
          const s = doc.sections[name];
          if (!s) return null;
          return (
            <details key={name} className="rounded border border-border bg-card p-3">
              <summary className="cursor-pointer text-sm font-medium">
                [{name}] <span className="text-muted-foreground">— {s.rows.length} rows</span>
              </summary>
              <div className="mt-2 overflow-x-auto">
                <table className="min-w-full text-xs">
                  {s.columns && (
                    <thead>
                      <tr>
                        {s.columns.map((c, i) => (
                          <th key={i} className="border-b px-2 py-1 text-left font-medium">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                  )}
                  <tbody>
                    {s.rows.slice(0, 25).map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => (
                          <td key={j} className="border-b px-2 py-1 font-mono">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {s.rows.length > 25 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    …{s.rows.length - 25} more rows
                  </p>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}

function RptView({ doc }: { doc: RptDocument }) {
  return (
    <section className="mt-8 space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Blocks" value={doc.blocks.length} />
        <Stat label="Errors" value={doc.errors.length} />
        <Stat label="Warnings" value={doc.warnings.length} />
        <Stat label="Issues" value={doc.issues.length} />
      </div>
      {doc.errors.length > 0 && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm">
          <p className="font-medium text-red-700">Errors</p>
          <ul>{doc.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}
      {doc.warnings.length > 0 && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
          <p className="font-medium text-amber-700">Warnings</p>
          <ul>{doc.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </div>
      )}
      {doc.blocks.map((b, i) => (
        <details key={i} className="rounded border border-border bg-card p-3">
          <summary className="cursor-pointer text-sm font-medium">{b.title}</summary>
          <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap text-xs">
            {b.body}
          </pre>
        </details>
      ))}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}

function baseName(name: string) {
  if (!name) return "swmm-report";
  return name.replace(/\.[^.]+$/, "") || "swmm-report";
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function renderPDF(
  doc: jsPDF,
  kind: Kind,
  data: InpDocument | RptDocument,
  source: string,
) {
  const margin = 48;
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = margin;

  const line = (text: string, size = 10, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const wrapped = doc.splitTextToSize(text, 520);
    for (const w of wrapped) {
      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(w, margin, y);
      y += size + 4;
    }
  };

  line(`SWMM ${kind.toUpperCase()} Analysis`, 18, true);
  line(`Source: ${source || "(unknown)"}`, 9);
  line(`Generated: ${new Date().toISOString()}`, 9);
  y += 6;

  if (kind === "inp") {
    const d = data as InpDocument;
    line(`Sections: ${d.order.length}`, 11, true);
    for (const name of d.order) {
      const s = d.sections[name];
      if (!s) continue;
      line(`[${name}] — ${s.rows.length} rows`, 11, true);
      if (s.columns) line(s.columns.join(" | "), 9);
      const preview = s.rows.slice(0, 10).map((r) => r.join(" | "));
      for (const row of preview) line(row, 9);
      if (s.rows.length > 10) line(`…${s.rows.length - 10} more rows`, 9);
      y += 4;
    }
    if (d.issues.length) {
      line("Issues", 12, true);
      for (const iss of d.issues) {
        line(`${iss.severity.toUpperCase()} line ${iss.line}: ${iss.message}`, 9);
      }
    }
  } else {
    const d = data as RptDocument;
    line(`Blocks: ${d.blocks.length}`, 11, true);
    if (d.errors.length) {
      line("Errors", 12, true);
      for (const e of d.errors) line(e, 9);
    }
    if (d.warnings.length) {
      line("Warnings", 12, true);
      for (const w of d.warnings) line(w, 9);
    }
    for (const b of d.blocks) {
      line(b.title, 11, true);
      line(b.body.slice(0, 1500), 9);
      y += 4;
    }
  }
}
