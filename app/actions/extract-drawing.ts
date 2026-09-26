"use server";

import "server-only";
import { requireUser } from "@/lib/auth";
import { DEFAULT_AI_MODEL } from "@/lib/forge/extraction";
import { createExtractionLimiter } from "@/lib/forge/extraction-access";
import {
  extractWithOpenAI,
  ExtractionError,
} from "@/lib/forge/openai-extractor";
import { analysisSchema } from "@/lib/forge/types";
import {
  reviewInputSchema,
  type ReviewResult,
} from "@/lib/forge/drawing-review";

const acquire = createExtractionLimiter();
export async function extractDrawing(
  input: unknown,
): Promise<{ ok: true; result: ReviewResult } | { ok: false; error: string }> {
  const { supabase, userId } = await requireUser("designer");
  const parsed = reviewInputSchema.safeParse(input);
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
    .select("id, data")
    .eq("owner_id", userId)
    .eq("id", parsed.data.analysisId)
    .maybeSingle();
  if (!owned)
    return {
      ok: false,
      error: "Save this drawing to your account before AI review.",
    };
  const saved = analysisSchema.safeParse(owned.data);
  if (
    !saved.success ||
    saved.data.pdfFileId !== parsed.data.sourceFileId ||
    parsed.data.pages.some((p) => p.page > saved.data.pages.length)
  )
    return {
      ok: false,
      error: "The selected pages do not belong to the saved drawing.",
    };
  let release: (() => void) | undefined;
  try {
    release = acquire();
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
  try {
    const result = await extractWithOpenAI(parsed.data, {
      apiKey: process.env.AI_API_KEY.trim(),
      model: process.env.AI_MODEL?.trim() || DEFAULT_AI_MODEL,
      totalPages: saved.data.pages.length,
    });
    return { ok: true, result };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof ExtractionError
          ? error.message
          : "Drawing review failed. Your drawing is saved; please try again.",
    };
  } finally {
    release();
  }
}
