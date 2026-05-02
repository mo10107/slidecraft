import { SimpleChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessageChunk, type BaseMessage } from "@langchain/core/messages";
import { ChatGenerationChunk } from "@langchain/core/outputs";

type GeminiRole = "user" | "model";

interface GeminiContent {
  role: GeminiRole;
  parts: Array<{ text: string }>;
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
    finishReason?: string;
  }>;
  error?: {
    message?: string;
  };
}

interface GeminiChatModelFields {
  apiKey: string;
  model?: string;
  thinkingLevel?: "low" | "medium" | "high";
}

function toGeminiText(message: BaseMessage): string {
  return message.text || String(message.content ?? "");
}

function toGeminiContents(messages: BaseMessage[]) {
  const systemInstructions: string[] = [];
  const contents: GeminiContent[] = [];

  for (const message of messages) {
    const text = toGeminiText(message).trim();
    if (!text) {
      continue;
    }

    const type = message.getType();
    if (type === "system") {
      systemInstructions.push(text);
      continue;
    }

    contents.push({
      role: type === "ai" ? "model" : "user",
      parts: [{ text }],
    });
  }

  return {
    contents:
      contents.length > 0
        ? contents
        : [{ role: "user" as const, parts: [{ text: "Continue." }] }],
    systemInstruction: systemInstructions.join("\n\n"),
  };
}

export class GeminiChatModel extends SimpleChatModel {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly thinkingLevel?: GeminiChatModelFields["thinkingLevel"];

  constructor(fields: GeminiChatModelFields) {
    super({});
    this.apiKey = fields.apiKey;
    this.model = fields.model || "gemini-3-flash-preview";
    this.thinkingLevel = fields.thinkingLevel;
  }

  _llmType() {
    return "gemini";
  }

  bindTools() {
    return this;
  }

  async _call(messages: BaseMessage[]): Promise<string> {
    const { contents, systemInstruction } = toGeminiContents(messages);
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.apiKey,
        },
        body: JSON.stringify({
          ...(systemInstruction
            ? {
                system_instruction: {
                  parts: [{ text: systemInstruction }],
                },
              }
            : {}),
          contents,
          ...(this.thinkingLevel
            ? {
                generationConfig: {
                  thinkingConfig: {
                    thinkingLevel: this.thinkingLevel,
                  },
                },
              }
            : {}),
        }),
      },
    );

    const data = (await response.json()) as GeminiGenerateContentResponse;
    if (!response.ok) {
      throw new Error(
        data.error?.message ||
          `Gemini API request failed with status ${response.status}`,
      );
    }

    const text =
      data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("")
        .trim() ?? "";

    if (!text) {
      throw new Error("Gemini returned an empty response.");
    }

    return text;
  }

  async *_stream(messages: BaseMessage[]): AsyncGenerator<ChatGenerationChunk> {
    const { contents, systemInstruction } = toGeminiContents(messages);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:streamGenerateContent?alt=sse`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.apiKey,
        },
        body: JSON.stringify({
          ...(systemInstruction
            ? {
                system_instruction: {
                  parts: [{ text: systemInstruction }],
                },
              }
            : {}),
          contents,
          ...(this.thinkingLevel
            ? {
                generationConfig: {
                  thinkingConfig: {
                    thinkingLevel: this.thinkingLevel,
                  },
                },
              }
            : {}),
        }),
      },
    );

    if (!response.ok) {
      const errorData = (await response.json()) as GeminiGenerateContentResponse;
      throw new Error(
        errorData.error?.message ||
          `Gemini API request failed with status ${response.status}`,
      );
    }

    if (!response.body) {
      throw new Error("Gemini stream response has no body.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (!jsonStr || jsonStr === "[DONE]") continue;

        let chunk: GeminiGenerateContentResponse;
        try {
          chunk = JSON.parse(jsonStr) as GeminiGenerateContentResponse;
        } catch {
          continue;
        }

        if (chunk.error?.message) {
          throw new Error(chunk.error.message);
        }

        const text =
          chunk.candidates?.[0]?.content?.parts
            ?.map((part) => part.text ?? "")
            .join("") ?? "";

        if (text) {
          yield new ChatGenerationChunk({
            text,
            message: new AIMessageChunk({ content: text }),
          });
        }
      }
    }
  }
}
