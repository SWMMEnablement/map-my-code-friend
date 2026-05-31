import { createFileRoute } from "@tanstack/react-router";

import { parseRpt } from "@/lib/swmm/rpt-parser";
import { readSwmmBody } from "@/lib/swmm/validate";

export const Route = createFileRoute("/api/swmm/rpt")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { text, filename, error } = await readSwmmBody(request, "rpt");
        if (error) {
          return Response.json(
            { ok: false, code: error.code, error: error.message },
            { status: error.status },
          );
        }
        try {
          const document = parseRpt(text!);
          const fatal = document.issues.filter((i) => i.severity === "error");
          if (fatal.length > 0) {
            return Response.json(
              {
                ok: false,
                code: "parser_error",
                error: fatal[0].message,
                issues: document.issues,
                filename,
              },
              { status: 422 },
            );
          }
          return Response.json({ ok: true, document, filename });
        } catch (err) {
          console.error("[/api/swmm/rpt] parse failure", err);
          return Response.json(
            {
              ok: false,
              code: "parser_exception",
              error: err instanceof Error ? err.message : "Unknown error",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
