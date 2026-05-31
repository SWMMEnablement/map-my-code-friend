import { createFileRoute } from "@tanstack/react-router";

import { parseInp } from "@/lib/swmm/inp-parser";
import { readSwmmBody } from "@/lib/swmm/validate";

export const Route = createFileRoute("/api/swmm/inp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { text, filename, error } = await readSwmmBody(request, "inp");
        if (error) {
          return Response.json(
            { ok: false, code: error.code, error: error.message },
            { status: error.status },
          );
        }
        try {
          const document = parseInp(text!);
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
          console.error("[/api/swmm/inp] parse failure", err);
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
