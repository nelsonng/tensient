import Anthropic from "@anthropic-ai/sdk";

let _anthropic: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }
  return _anthropic;
}

const DEFAULT_MODEL = "claude-opus-4-6";

export async function generateStructuredJSON<T>(opts: {
  system?: string;
  prompt: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
}): Promise<{ result: T; inputTokens: number; outputTokens: number }> {
  const anthropic = getAnthropic();

  const response = await anthropic.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: opts.maxTokens ?? 4096,
    messages: [{ role: "user", content: opts.prompt }],
    ...(opts.system ? { system: opts.system } : {}),
    output_config: {
      format: {
        type: "json_schema" as const,
        schema: opts.schema,
      },
    },
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const text = textBlock && textBlock.type === "text" ? textBlock.text : "{}";
  const result = JSON.parse(text) as T;

  return {
    result,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
