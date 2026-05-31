import { MAX_SWMM_BYTES } from "./types";

export type SwmmKind = "inp" | "rpt";

export interface ValidationError {
  status: number;
  code:
    | "missing_file"
    | "empty_body"
    | "too_large"
    | "bad_extension"
    | "bad_filename"
    | "binary_content"
    | "decode_failure"
    | "unsupported_content_type";
  message: string;
}

const FILENAME_RE = /^[\w.\- ()]+$/;

function isLikelyBinary(text: string): boolean {
  // SWMM files are ASCII. Reject if NUL byte present or >1% of first 4KB are
  // control chars outside tab/CR/LF.
  const sample = text.slice(0, 4096);
  if (sample.includes("\u0000")) return true;
  let bad = 0;
  for (let i = 0; i < sample.length; i++) {
    const c = sample.charCodeAt(i);
    if (c === 9 || c === 10 || c === 13) continue;
    if (c < 32 || c === 127) bad++;
  }
  return sample.length > 0 && bad / sample.length > 0.01;
}

function validateText(text: string): ValidationError | null {
  if (text.length === 0 || !text.trim()) {
    return { status: 400, code: "empty_body", message: "Empty body." };
  }
  if (text.length > MAX_SWMM_BYTES) {
    return {
      status: 413,
      code: "too_large",
      message: `Content exceeds limit of ${MAX_SWMM_BYTES} bytes.`,
    };
  }
  if (isLikelyBinary(text)) {
    return {
      status: 415,
      code: "binary_content",
      message: "Content does not look like a text-based SWMM file.",
    };
  }
  return null;
}

function checkContentLength(request: Request): ValidationError | null {
  const len = request.headers.get("content-length");
  if (!len) return null;
  const n = Number(len);
  if (Number.isFinite(n) && n > MAX_SWMM_BYTES) {
    return {
      status: 413,
      code: "too_large",
      message: `Content-Length ${n} exceeds limit of ${MAX_SWMM_BYTES} bytes.`,
    };
  }
  return null;
}

export async function readSwmmBody(
  request: Request,
  kind: SwmmKind,
): Promise<{ text?: string; filename?: string; error?: ValidationError }> {
  const preflight = checkContentLength(request);
  if (preflight) return { error: preflight };

  const contentType = request.headers.get("content-type") ?? "";
  const expectedExt = `.${kind}`;

  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch (err) {
      return {
        error: {
          status: 400,
          code: "decode_failure",
          message: `Could not parse multipart body: ${err instanceof Error ? err.message : "unknown"}`,
        },
      };
    }
    const file = form.get("file");
    if (!(file instanceof File)) {
      return {
        error: { status: 400, code: "missing_file", message: "Expected multipart field 'file'." },
      };
    }
    if (file.size === 0) {
      return { error: { status: 400, code: "empty_body", message: "Uploaded file is empty." } };
    }
    if (file.size > MAX_SWMM_BYTES) {
      return {
        error: {
          status: 413,
          code: "too_large",
          message: `File size ${file.size} exceeds limit of ${MAX_SWMM_BYTES} bytes.`,
        },
      };
    }
    const filename = file.name ?? "";
    if (!FILENAME_RE.test(filename) || filename.includes("..")) {
      return {
        error: {
          status: 400,
          code: "bad_filename",
          message: "Filename contains unsupported characters.",
        },
      };
    }
    if (!filename.toLowerCase().endsWith(expectedExt)) {
      return {
        error: {
          status: 400,
          code: "bad_extension",
          message: `Expected a ${expectedExt} file, got "${filename}".`,
        },
      };
    }
    let text: string;
    try {
      text = await file.text();
    } catch (err) {
      return {
        error: {
          status: 400,
          code: "decode_failure",
          message: `Could not decode file as UTF-8: ${err instanceof Error ? err.message : "unknown"}`,
        },
      };
    }
    const v = validateText(text);
    if (v) return { error: v };
    return { text, filename };
  }

  if (
    contentType === "" ||
    contentType.includes("text/plain") ||
    contentType.includes("application/octet-stream")
  ) {
    let text: string;
    try {
      text = await request.text();
    } catch (err) {
      return {
        error: {
          status: 400,
          code: "decode_failure",
          message: `Could not read request body: ${err instanceof Error ? err.message : "unknown"}`,
        },
      };
    }
    const v = validateText(text);
    if (v) return { error: v };
    return { text };
  }

  return {
    error: {
      status: 415,
      code: "unsupported_content_type",
      message: `Unsupported Content-Type: ${contentType}. Use multipart/form-data or text/plain.`,
    },
  };
}
