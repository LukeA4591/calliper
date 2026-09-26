"use server";

import "server-only";
import { requireUser } from "@/lib/auth";
import {
  DEFAULT_AI_MODEL,
  extractionInputSchema,
} from "@/lib/forge/extraction";
import { createExtractionLimiter } from "@/lib/forge/extraction-access";
import {
  extractWithOpenAI,
  ExtractionError,
} from "@/lib/forge/openai-extractor";
import type { Extraction } from "@/lib/forge/types";

const acquire = createExtractionLimiter();
export async function extractDrawing(
  input: unknown,
): Promise<
  { ok: true; extraction: Extraction } | { ok: false; error: string }
> {
  const { supabase, userId } = await requireUser("designer");
  const parsed = extractionInputSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error:
        "Choose 1–3 pages and allow their images/text to be sent to OpenAI. The request must be under the page limits.",
    };
  if (!process.env.AI_API_KEY?.trim())
    return {
      ok: false,
      error:
        "Add AI_API_KEY to the server’s .env.local, then restart the dev server.",
    };
  const { data: owned } = await supabase
    .from("analyses")
    .select("id")
    .eq("owner_id", userId)
    .eq("id", parsed.data.sourceFileId)
    .maybeSingle();
  if (!owned)
    return {
      ok: false,
      error: "Save this drawing to your account before extraction.",
    };
  let release: (() => void) | undefined;
  try {
    release = acquire();
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
  try {
    const extraction = await extractWithOpenAI(parsed.data, {
      apiKey: process.env.AI_API_KEY.trim(),
      model: process.env.AI_MODEL?.trim() || DEFAULT_AI_MODEL,
    });
    return { ok: true, extraction };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof ExtractionError
          ? error.message
          : "Extraction failed. Your drawing is saved; please try again.",
    };
  } finally {
    release();
  }
}
