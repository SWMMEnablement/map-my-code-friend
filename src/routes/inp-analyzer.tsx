import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import type { InpDocument, RptDocument } from "@/lib/swmm/types";

export const Route = createFileRoute("/inp-analyzer")({
  head: () => ({
    meta: [
      { title: "SWMM INP / RPT Analyzer" },
      { name: "description", content: "Upload an EPA SWMM .inp or .rpt file and inspect it parsed on the server." },
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

  async function onFile(file: File) {
    setBusy(true);
    setError(null);
    setInp(null);
    setRpt(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/swmm/${kind}`, { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
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

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold">SWMM File Analyzer</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Server-side parsing for EPA SWMM5 <code>.inp</code> and <code>.rpt</code> files.
      </p>

      <div className="mt-6 flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" checked={kind === "inp"} onChange={() => setKind("inp")} />
          .inp
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" checked={kind === "rpt"} onChange={() => setKind("rpt")} />
          .rpt
        </label>
        <input
          type="file"
          accept={kind === "inp" ? ".inp" : ".rpt"}
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
          }}
          className="text-sm"
        />
      </div>

      {busy && <p className="mt-4 text-sm">Parsing…</p>}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {inp && <InpView doc={inp} />}
      {rpt && <RptView doc={rpt} />}
    </div>
  );
}

function InpView({ doc }: { doc: InpDocument }) {
  return (
    <div className="mt-8 space-y-4">
      <h2 className="text-lg font-semibold">Sections ({doc.order.length})</h2>
      {doc.warnings.length > 0 && (
        <ul className="text-sm text-amber-700">
          {doc.warnings.map((w, i) => (
            <li key={i}>⚠ {w}</li>
          ))}
        </ul>
      )}
      {doc.order.map((name) => {
        const s = doc.sections[name];
        if (!s) return null;
        return (
          <details key={name} className="rounded border border-border bg-card p-3">
            <summary className="cursor-pointer text-sm font-medium">
              [{name}] — {s.rows.length} rows
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
                  {s.rows.slice(0, 20).map((row, i) => (
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
              {s.rows.length > 20 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  …{s.rows.length - 20} more rows
                </p>
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}

function RptView({ doc }: { doc: RptDocument }) {
  return (
    <div className="mt-8 space-y-4">
      <h2 className="text-lg font-semibold">Blocks ({doc.blocks.length})</h2>
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
          <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap text-xs">{b.body}</pre>
        </details>
      ))}
    </div>
  );
}
