import { z } from "zod";
import { type ExtractionInput } from "./extraction";
import {
  groundDrawingReview,
  modelReviewSchema,
  validateReviewCoverage,
} from "./drawing-review";

export class ExtractionError extends Error {}

export { instructions } from "./review-prompt";
import { instructions } from "./review-prompt";

export async function extractWithOpenAI(
  input: ExtractionInput,
  config: { apiKey: string; model: string; totalPages: number },
  fetcher: typeof fetch = fetch,
) {
  const usesGpt6 = /^gpt-6-(astra|sol|luna)(-|$)/.test(config.model);
  const content = input.pages.flatMap((page) => [
    {
      type: "input_text",
      text: JSON.stringify({
        page: page.page,
        projectUnits: input.units,
        totalDrawingPages: config.totalPages,
        suppliedPages: input.pages.map((p) => p.page),
        spans: page.spans.map((s) => ({
          id: s.id,
          text: s.text,
          region: s.region,
        })),
        textTruncated: page.textTruncated,
      }),
    },
    { type: "input_image", image_url: page.image, detail: "high" },
  ]);
  let response: Response;
  let body: unknown;
  try {
    response = await fetcher("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(120_000),
      cache: "no-store",
      body: JSON.stringify({
        model: config.model,
        store: false,
        // Reasoning tokens share the output budget with the extracted JSON.
        max_output_tokens: usesGpt6 ? 10000 : 6500,
        ...(usesGpt6 ? { reasoning: { effort: "low" } } : {}),
        instructions,
        input: [{ role: "user", content }],
        text: {
          format: {
            type: "json_schema",
            name: "drawing_review",
            strict: true,
            schema: z.toJSONSchema(modelReviewSchema, {
              target: "draft-7",
            }),
          },
        },
      }),
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403)
        throw new ExtractionError(
          "OpenAI could not authorize this request. Check the server API key and project access.",
        );
      if (response.status === 429)
        throw new ExtractionError(
          "OpenAI usage or rate limit reached. Check API billing/limits, then try again later.",
        );
      if (response.status === 400 || response.status === 404)
        throw new ExtractionError(
          "OpenAI could not process this request. Check AI_MODEL supports images and structured outputs, or try fewer pages.",
        );
      throw new ExtractionError(
        "OpenAI is temporarily unavailable. Your drawing is still saved; try again later.",
      );
    }
    body = await response.json();
  } catch (error) {
    if (error instanceof ExtractionError) throw error;
    if (
      error instanceof Error &&
      ["TimeoutError", "AbortError"].includes(error.name)
    )
      throw new ExtractionError(
        "Drawing review timed out after 120 seconds. Try one page at a time.",
      );
    throw new ExtractionError(
      "Could not reach OpenAI. Check the connection and try again.",
    );
  }
  const envelope = z
    .object({
      status: z.string(),
      output: z.array(
        z.object({
          type: z.string(),
          content: z
            .array(z.object({ type: z.string(), text: z.string().optional() }))
            .optional(),
        }),
      ),
    })
    .safeParse(body);
  if (!envelope.success)
    throw new ExtractionError(
      "OpenAI returned an unreadable response. No findings were added.",
    );
  const parts = envelope.data.output.flatMap((item) => item.content ?? []);
  if (parts.some((p) => p.type === "refusal"))
    throw new ExtractionError(
      "OpenAI declined to review this drawing. No findings were added.",
    );
  if (envelope.data.status !== "completed")
    throw new ExtractionError(
      "Drawing review was incomplete. Try fewer pages; no partial findings were added.",
    );
  let raw;
  try {
    raw = modelReviewSchema.parse(
      JSON.parse(
        parts
          .filter((p) => p.type === "output_text")
          .map((p) => p.text ?? "")
          .join(""),
      ),
    );
  } catch {
    throw new ExtractionError(
      "The review did not match the required review format. No findings were added; try again.",
    );
  }
  try {
    validateReviewCoverage(raw, input);
    return groundDrawingReview(
      raw,
      input,
      config.totalPages,
      config.model,
      crypto.randomUUID(),
    );
  } catch {
    throw new ExtractionError(
      "The review did not cover every selected page and reconcile all six checks. No partial findings were added; try again.",
    );
  }
}
