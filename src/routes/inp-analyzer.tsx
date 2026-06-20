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

  // Bucket sections into known groups, plus an "Other" group for unknowns.
  const grouped = useMemo(() => {
    const seen = new Set<string>();
    const groups = INP_GROUPS.map((g) => {
      const names = g.sections.filter((n) => doc.sections[n]);
      names.forEach((n) => seen.add(n));
      return { label: g.label, names };
    }).filter((g) => g.names.length > 0);
    const other = doc.order.filter((n) => !seen.has(n));
    if (other.length) groups.push({ label: "Other", names: other });
    return groups;
  }, [doc]);

  const errors = doc.issues.filter((i) => i.severity === "error");
  const warnings = doc.issues.filter((i) => i.severity === "warning");

  return (
    <section className="mt-8 space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Sections" value={stats.sections} icon={FolderTree} />
        <Stat label="Total rows" value={stats.rows} icon={ListTree} />
        <Stat label="Errors" value={errors.length} tone={errors.length ? "error" : "default"} icon={XCircle} />
        <Stat label="Warnings" value={warnings.length + doc.warnings.length} tone={(warnings.length + doc.warnings.length) ? "warning" : "default"} icon={AlertTriangle} />
      </div>

      {(doc.issues.length > 0 || doc.warnings.length > 0) && (
        <Panel title="Diagnostics" icon={Info}>
          <ul className="divide-y divide-border text-sm">
            {doc.issues.map((iss, i) => (
              <li key={`i-${i}`} className="flex gap-3 py-2">
                <Badge
                  variant={iss.severity === "error" ? "destructive" : "secondary"}
                  className="shrink-0 uppercase"
                >
                  {iss.severity}
                </Badge>
                <span className="text-muted-foreground font-mono text-xs shrink-0 pt-0.5">
                  {iss.line ? `L${iss.line}` : "—"}
                </span>
                <span className="text-foreground">{iss.message}</span>
              </li>
            ))}
            {doc.warnings.map((w, i) => (
              <li key={`w-${i}`} className="flex gap-3 py-2">
                <Badge variant="secondary" className="shrink-0 uppercase">warn</Badge>
                <span className="text-foreground">{w}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title="Sections" icon={FolderTree} count={stats.sections}>
        <div className="space-y-4">
          {grouped.map((group) => (
            <SectionGroup key={group.label} label={group.label} count={group.names.length}>
              <div className="space-y-1.5">
                {group.names.map((name) => {
                  const s = doc.sections[name];
                  if (!s) return null;
                  return <SectionRow key={name} name={name} section={s} />;
                })}
              </div>
            </SectionGroup>
          ))}
        </div>
      </Panel>
    </section>
  );
}

function SectionGroup({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-accent">
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 transition-transform",
            open && "rotate-90",
          )}
        />
        <span>{label}</span>
        <Badge variant="outline" className="ml-auto font-normal normal-case">
          {count}
        </Badge>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-5 pt-1.5 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

function SectionRow({
  name,
  section,
}: {
  name: string;
  section: InpDocument["sections"][string];
}) {
  const [open, setOpen] = useState(false);
  const preview = section.rows.slice(0, 25);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-left text-sm hover:bg-accent">
        <ChevronRight
          className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-90")}
        />
        <span className="font-mono font-medium">[{name}]</span>
        <Badge variant="outline" className="ml-auto font-normal">
          {section.rows.length} {section.rows.length === 1 ? "row" : "rows"}
        </Badge>
      </CollapsibleTrigger>
      <CollapsibleContent className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
        <div className="mt-1 rounded-md border border-border bg-background/50 p-2">
          {section.rows.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">No rows.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                {section.columns && (
                  <thead className="bg-muted/50">
                    <tr>
                      {section.columns.map((c, i) => (
                        <th
                          key={i}
                          className="border-b border-border px-2 py-1.5 text-left font-medium"
                        >
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                )}
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className="even:bg-muted/20">
                      {row.map((cell, j) => (
                        <td key={j} className="border-b border-border/50 px-2 py-1 font-mono">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {section.rows.length > preview.length && (
                <p className="px-2 pt-2 text-xs text-muted-foreground">
                  Showing first {preview.length} of {section.rows.length} rows.
                </p>
              )}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function RptView({ doc }: { doc: RptDocument }) {
  return (
    <section className="mt-8 space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Blocks" value={doc.blocks.length} icon={FileText} />
        <Stat label="Errors" value={doc.errors.length} tone={doc.errors.length ? "error" : "default"} icon={XCircle} />
        <Stat label="Warnings" value={doc.warnings.length} tone={doc.warnings.length ? "warning" : "default"} icon={AlertTriangle} />
        <Stat label="Issues" value={doc.issues.length} icon={Info} />
      </div>

      {doc.errors.length > 0 && (
        <Panel title="Errors" icon={XCircle} tone="error" count={doc.errors.length}>
          <ul className="space-y-1 text-sm">
            {doc.errors.map((e, i) => (
              <li key={i} className="font-mono text-xs">{e}</li>
            ))}
          </ul>
        </Panel>
      )}

      {doc.warnings.length > 0 && (
        <Panel title="Warnings" icon={AlertTriangle} tone="warning" count={doc.warnings.length}>
          <ul className="space-y-1 text-sm">
            {doc.warnings.map((w, i) => (
              <li key={i} className="font-mono text-xs">{w}</li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title="Report blocks" icon={ListTree} count={doc.blocks.length}>
        <div className="space-y-1.5">
          {doc.blocks.map((b, i) => (
            <RptBlockRow key={i} title={b.title} body={b.body} defaultOpen={i === 0} />
          ))}
        </div>
      </Panel>
    </section>
  );
}

function RptBlockRow({
  title,
  body,
  defaultOpen = false,
}: {
  title: string;
  body: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const lines = body.split(/\r?\n/).length;
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-left text-sm hover:bg-accent">
        <ChevronRight
          className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-90")}
        />
        <span className="font-medium">{title}</span>
        <Badge variant="outline" className="ml-auto font-normal">
          {lines} {lines === 1 ? "line" : "lines"}
        </Badge>
      </CollapsibleTrigger>
      <CollapsibleContent className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
        <pre className="mt-1 max-h-96 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs leading-relaxed whitespace-pre">
          {body}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}

function Panel({
  title,
  icon: Icon,
  count,
  tone = "default",
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  count?: number;
  tone?: "default" | "error" | "warning";
  children: React.ReactNode;
}) {
  const toneCls =
    tone === "error"
      ? "border-destructive/40"
      : tone === "warning"
      ? "border-amber-400/50"
      : "border-border";
  return (
    <div className={cn("rounded-lg border bg-card", toneCls)}>
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {typeof count === "number" && (
          <Badge variant="secondary" className="ml-auto font-normal">
            {count}
          </Badge>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "default" | "error" | "warning";
}) {
  const valueCls =
    tone === "error"
      ? "text-destructive"
      : tone === "warning"
      ? "text-amber-600"
      : "text-foreground";
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        <span>{label}</span>
      </div>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", valueCls)}>{value}</p>
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
