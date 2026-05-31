import { describe, it, expect } from "vitest";
import { Route as InpRoute } from "@/routes/api/swmm/inp";
import { Route as RptRoute } from "@/routes/api/swmm/rpt";
import { MAX_SWMM_BYTES } from "@/lib/swmm/types";

// Resolve POST handler from createFileRoute, tolerating shape changes.
function getPost(route: any): (ctx: { request: Request }) => Promise<Response> {
  const server = route.options?.server ?? route.server;
  const handlers =
    typeof server?.handlers === "function"
      ? server.handlers({ createHandlers: (h: any) => h })
      : server?.handlers;
  const post = handlers?.POST;
  return typeof post === "function" ? post : post.handler;
}

const postInp = getPost(InpRoute);
const postRpt = getPost(RptRoute);

function multipart(filename: string, body: Uint8Array | string): Request {
  const form = new FormData();
  const blob =
    typeof body === "string"
      ? new Blob([body], { type: "text/plain" })
      : new Blob([body]);
  form.append("file", new File([blob], filename));
  return new Request("http://test.local/api/swmm/inp", {
    method: "POST",
    body: form,
  });
}

function textReq(url: string, body: string, contentType = "text/plain"): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": contentType, "content-length": String(body.length) },
    body,
  });
}

describe("POST /api/swmm/inp — validation", () => {
  it("rejects missing file field", async () => {
    const form = new FormData();
    const res = await postInp({
      request: new Request("http://t/", { method: "POST", body: form }),
    });
    expect(res.status).toBe(400);
    const j = await res.json();
    expect(j.code).toBe("missing_file");
  });

  it("rejects wrong extension", async () => {
    const res = await postInp({ request: multipart("model.txt", "[TITLE]\nx") });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("bad_extension");
  });

  it("rejects bad filename characters", async () => {
    const res = await postInp({ request: multipart("../evil.inp", "[TITLE]\nx") });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("bad_filename");
  });

  it("rejects empty file", async () => {
    const res = await postInp({ request: multipart("a.inp", "") });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("empty_body");
  });

  it("rejects binary content (NUL bytes)", async () => {
    const bin = new Uint8Array([0x5b, 0x54, 0x00, 0x00, 0x00, 0x49, 0x4e]);
    const res = await postInp({ request: multipart("a.inp", bin) });
    expect(res.status).toBe(415);
    expect((await res.json()).code).toBe("binary_content");
  });

  it("rejects oversize via content-length precheck", async () => {
    const req = new Request("http://t/", {
      method: "POST",
      headers: {
        "content-type": "text/plain",
        "content-length": String(MAX_SWMM_BYTES + 1),
      },
      body: "x",
    });
    const res = await postInp({ request: req });
    expect(res.status).toBe(413);
    expect((await res.json()).code).toBe("too_large");
  });

  it("rejects unsupported content-type", async () => {
    const res = await postInp({
      request: new Request("http://t/", {
        method: "POST",
        headers: { "content-type": "application/xml" },
        body: "<x/>",
      }),
    });
    expect(res.status).toBe(415);
    expect((await res.json()).code).toBe("unsupported_content_type");
  });

  it("returns 422 with structured issues for non-SWMM text", async () => {
    const res = await postInp({
      request: textReq("http://t/", "this is just prose with no sections"),
    });
    expect(res.status).toBe(422);
    const j = await res.json();
    expect(j.ok).toBe(false);
    expect(j.code).toBe("parser_error");
    expect(Array.isArray(j.issues)).toBe(true);
    expect(j.issues.some((i: any) => i.severity === "error")).toBe(true);
  });

  it("parses a valid .inp and returns document", async () => {
    const inp = `[TITLE]\nDemo\n\n[JUNCTIONS]\n;;Name  Elev  MaxDepth\nJ1  10  5\n`;
    const res = await postInp({ request: multipart("ok.inp", inp) });
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.ok).toBe(true);
    expect(j.document.order).toContain("JUNCTIONS");
  });
});

describe("POST /api/swmm/rpt — validation", () => {
  it("rejects wrong extension", async () => {
    const res = await postRpt({ request: multipart("a.inp", "hi") });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("bad_extension");
  });

  it("returns 422 for content with no report blocks", async () => {
    const res = await postRpt({ request: textReq("http://t/", "no banners here at all") });
    expect(res.status).toBe(422);
    const j = await res.json();
    expect(j.code).toBe("parser_error");
    expect(j.issues.some((i: any) => i.severity === "error")).toBe(true);
  });

  it("parses a valid .rpt with banner block", async () => {
    const rpt = [
      "  EPA STORM WATER MANAGEMENT MODEL",
      "  ****************",
      "  Analysis Options",
      "  ****************",
      "  Flow Units ............ CFS",
      "",
    ].join("\n");
    const res = await postRpt({ request: multipart("ok.rpt", rpt) });
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.ok).toBe(true);
    expect(j.document.blocks.length).toBeGreaterThan(0);
  });
});
