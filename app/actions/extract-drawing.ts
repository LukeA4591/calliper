"use server";

import "server-only";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_AI_MODEL,
  extractionInputSchema,
} from "@/lib/forge/extraction";
import {
  createExtractionLimiter,
  isAllowedExtractionUser,
  isLocalExtractionRequest,
} from "@/lib/forge/extraction-access";
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
  const requestHeaders = await headers();
  if (
    !isLocalExtractionRequest(
      process.env.NODE_ENV,
      requestHeaders.get("host"),
      requestHeaders.get("origin"),
    )
  ) {
    try {
      const client = await createClient();
      const { data, error } = await client.auth.getClaims();
      if (
        error ||
        !isAllowedExtractionUser(
          data?.claims.sub,
          process.env.AI_ALLOWED_USER_IDS,
        )
      )
        return {
          ok: false,
          error:
            "Sign in with an account enabled for AI extraction. The owner must add its verified user ID to AI_ALLOWED_USER_IDS on the server.",
        };
    } catch {
      return {
        ok: false,
        error: "Sign-in could not be verified. Please sign in and try again.",
      };
    }
  }
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
