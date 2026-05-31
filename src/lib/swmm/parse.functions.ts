import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { parseInp } from "./inp-parser";
import { parseRpt } from "./rpt-parser";
import { MAX_SWMM_BYTES } from "./types";

const textInput = z.object({
  text: z.string().min(1).max(MAX_SWMM_BYTES),
});

export const parseInpFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => textInput.parse(input))
  .handler(async ({ data }) => {
    return parseInp(data.text);
  });

export const parseRptFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => textInput.parse(input))
  .handler(async ({ data }) => {
    return parseRpt(data.text);
  });
