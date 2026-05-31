import { createFileRoute } from "@tanstack/react-router";

import { parseInp } from "@/lib/swmm/inp-parser";
import { MAX_SWMM_BYTES } from "@/lib/swmm/types";

async function readBody(request: Request): Promise<{ text?: string; error?: { status: number; message: string } }> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return { error: { status: 400, message: "Expected multipart field 'file'." } };
    }
    if (file.size > MAX_SWMM_BYTES) {
      return { error: { status: 413, message: `File exceeds ${MAX_SWMM_BYTES} bytes.` } };
    }
    const name = file.name.toLowerCase();
    if (!name.endsWith(".inp")) {
      return { error: { status: 400, message: "Expected a .inp file." } };
    }
    return { text: await file.text() };
  }

  const text = await request.text();
  if (text.length > MAX_SWMM_BYTES) {
    return { error: { status: 413, message: `Body exceeds ${MAX_SWMM_BYTES} bytes.` } };
  }
  if (!text.trim()) {
    return { error: { status: 400, message: "Empty body." } };
  }
  return { text };
}

export const Route = createFileRoute("/api/swmm/inp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { text, error } = await readBody(request);
          if (error) {
            return Response.json({ ok: false, error: error.message }, { status: error.status });
          }
          const document = parseInp(text!);
          return Response.json({ ok: true, document });
        } catch (err) {
          console.error("[/api/swmm/inp] parse failure", err);
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
            { status: 500 },
          );
        }
      },
    },
  },
});
