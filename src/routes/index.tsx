import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/inp-analyzer" });
  },
});


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SWMM INP & RPT Analyzer" },
      {
        name: "description",
        content:
          "Upload EPA SWMM .inp and .rpt files to validate structure and inspect parsed sections.",
      },
      { property: "og:title", content: "SWMM INP & RPT Analyzer" },
      {
        property: "og:description",
        content:
          "Upload EPA SWMM .inp and .rpt files to validate structure and inspect parsed sections.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-xl text-center space-y-6">
        <h1 className="text-4xl font-semibold tracking-tight">
          SWMM INP & RPT Analyzer
        </h1>
        <p className="text-muted-foreground">
          Upload EPA SWMM input and report files. We validate size, extension,
          and structure, then surface parsed sections and any issues.
        </p>
        <Link
          to="/inp-analyzer"
          className="inline-flex h-11 items-center rounded-md bg-primary px-6 text-primary-foreground hover:opacity-90"
        >
          Open analyzer
        </Link>
      </div>
    </main>
  );
}
