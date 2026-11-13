import { env, getSecrets } from "./config";
import { HttpError } from "./http";

/**
 * Provider-agnostic interface so the AI backend can be swapped
 * (e.g. Workers AI -> Bedrock Nova Canvas) without touching routes.
 */
export interface DesignGenerator {
  readonly model: string;
  enhancePrompt(description: string): Promise<string>;
  basicPrompt(description: string): string;
  generateImage(prompt: string): Promise<Uint8Array>;
}

const IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";
const TEXT_MODEL = "@cf/meta/llama-3.1-8b-instruct";

const SYSTEM_PROMPT = `You write prompts for a text-to-image model that renders jewelry design concepts.
Rewrite the user's description as ONE detailed prompt (max 80 words) covering: piece type, metal and finish,
stones (cut, colour, setting), style/era, and composition. Always end with:
"professional jewelry product photography, studio lighting, plain light background, sharp focus, high detail".
Reply with the prompt only.`;

export async function runWorkersAi<T>(model: string, input: unknown): Promise<T> {
  const { cloudflareApiToken } = await getSecrets();
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.cloudflareAccountId}/ai/run/${model}`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${cloudflareApiToken}`, "content-type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("Workers AI error", res.status, text.slice(0, 500));
    if (res.status === 429) {
      throw new HttpError(429, "ai_quota_exceeded", "Daily free AI quota reached. Try again tomorrow.");
    }
    throw new HttpError(502, "ai_error", "The AI provider failed to respond");
  }
  const data = (await res.json()) as { success: boolean; result: T };
  return data.result;
}

export const workersAiGenerator: DesignGenerator = {
  model: IMAGE_MODEL,
  basicPrompt,

  async enhancePrompt(description) {
    const result = await runWorkersAi<{ response?: string }>(TEXT_MODEL, {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: description },
      ],
      max_tokens: 200,
    });
    const prompt = result.response?.trim();
    return prompt && prompt.length > 0 ? prompt : basicPrompt(description);
  },

  async generateImage(prompt) {
    const result = await runWorkersAi<{ image?: string }>(IMAGE_MODEL, { prompt, steps: 6 });
    if (!result.image) throw new HttpError(502, "ai_error", "The AI provider returned no image");
    return Buffer.from(result.image, "base64");
  },
};

export function basicPrompt(description: string): string {
  return `${description}. Professional jewelry product photography, studio lighting, plain light background, sharp focus, high detail.`;
}
