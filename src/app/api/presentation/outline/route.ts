import { search_tool } from "@/ai/tools/search";
import {
  getLatestUserMessage,
  getMessageText,
} from "@/lib/ai/uiMessageParts";
import {
  assertModelIsConfigured,
  ensureModelIsReady,
  modelPicker,
} from "@/lib/modelPicker";
import { createLogger } from "@/lib/observability/logger";
import { logger } from "@/lib/observability/server/logger";
import { toBaseMessages, toUIMessageStream } from "@ai-sdk/langchain";
import {
  createUIMessageStreamResponse,
  createUIMessageStream,
  type UIMessage,
} from "ai";
import { SystemMessage } from "@langchain/core/messages";
import { createAgent } from "langchain";
import { NextResponse } from "next/server";

interface OutlineRequest {
  messages?: UIMessage[];
}

interface OutlineMessageMetadata {
  numberOfCards?: number;
  language?: string;
  modelId?: string;
  modelProvider?: "gemini" | "openai" | "ollama" | "lmstudio";
  webSearch?: boolean;
  textContent?: "minimal" | "concise" | "detailed" | "extensive";
  tone?: string;
  audience?: string;
  scenario?: string;
  presentationId?: string;
}

const outlineSystemPrompt = `You are an expert presentation outline generator. Your task is to create a comprehensive and engaging presentation outline based on the user's topic.

Current Date: {currentDate}

## Presentation Customization:
- Text Content Level: {textContent}
- Tone: {tone}
- Target Audience: {audience}
- Scenario: {scenario}

## Your Process:
1. Analyze the topic
2. {researchStep}
3. Generate the outline

## Web Search Guidelines:
{webSearchGuidelines}

## Outline Requirements:
- First generate an appropriate title for the presentation
- Generate exactly {numberOfCards} main topics
- Each topic should be a clear, engaging heading
- Include 2-3 bullet points per topic
- Use {language} language
- Adapt content depth based on the text content level
- Tailor language for the requested tone, audience, and scenario
- ALWAYS use bullet points formatted as "- point text"
- Do not use bold, italic, or underline

## Output Format:
Start with the title in XML tags, then generate markdown with each topic as a heading followed by bullet points.

Example:
<TITLE>Your Generated Presentation Title Here</TITLE>

# First Main Topic
- Key point
- Another point

# Second Main Topic
- Key point
- Another point

Remember: {finalInstruction}`;

function buildOutlineSystemPrompt({
  actualLanguage,
  numberOfCards,
  currentDate,
  textContent,
  tone,
  audience,
  scenario,
  webSearch,
}: {
  actualLanguage: string;
  numberOfCards: number;
  currentDate: string;
  textContent: NonNullable<OutlineMessageMetadata["textContent"]>;
  tone: string;
  audience: string;
  scenario: string;
  webSearch: boolean;
}) {
  return outlineSystemPrompt
    .replace("{currentDate}", currentDate)
    .replace("{numberOfCards}", numberOfCards.toString())
    .replace("{language}", actualLanguage)
    .replaceAll("{textContent}", textContent)
    .replaceAll("{tone}", tone)
    .replaceAll("{audience}", audience)
    .replaceAll("{scenario}", scenario)
    .replace(
      "{researchStep}",
      webSearch
        ? "Research first using web search before writing the outline"
        : "Use existing knowledge only and skip tool usage",
    )
    .replace(
      "{webSearchGuidelines}",
      webSearch
        ? [
            "- Use web search for current facts, recent developments, and useful statistics",
            "- Limit yourself to a few focused searches",
            "- Only search when it materially improves the outline",
          ].join("\n")
        : "- Web search is disabled for this request.",
    )
    .replace(
      "{finalInstruction}",
      webSearch
        ? "Perform at least one web search before generating the outline."
        : "Generate the outline directly without web search.",
    );
}

function extractMessageText(message: { text?: string; content?: unknown }) {
  if (message.text) {
    return message.text;
  }

  if (typeof message.content === "string") {
    return message.content;
  }

  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => {
        if (!part || typeof part !== "object") {
          return "";
        }

        const text = (part as { text?: unknown }).text;
        return typeof text === "string" ? text : "";
      })
      .join("");
  }

  return "";
}

export async function POST(req: Request) {
  const actionName = "presentation.outline.post";
  const requestId = crypto.randomUUID();
  const routeLogger = createLogger("api:presentation-outline");
  const span = logger.startSpan(`allweone.api.${actionName}`, {
    attributes: {
      "allweone.scope": "api",
      "allweone.action.type": "api_route",
      "allweone.action.name": actionName,
      "http.method": "POST",
      "http.route": "/api/presentation/outline",
      "allweone.request.id": requestId,
    },
  });

  try {
    routeLogger.info("Outline request received", { requestId });

    const request = (await req.json()) as OutlineRequest;
    const { messages = [] } = request;
    const latestUserMessage = getLatestUserMessage(messages);
    const prompt = latestUserMessage ? getMessageText(latestUserMessage).trim() : "";
    const metadata =
      (latestUserMessage?.metadata as OutlineMessageMetadata | undefined) ?? {};
    const numberOfCards = metadata.numberOfCards ?? 0;
    const language = metadata.language ?? "";
    const modelProvider = metadata.modelProvider ?? "gemini";
    const modelId = metadata.modelId;
    const webSearch = Boolean(metadata.webSearch);
    const effectiveWebSearch = webSearch && modelProvider !== "gemini";

    span.annotate({
      "allweone.presentation.cards.count": numberOfCards,
      "allweone.presentation.prompt.length": prompt.length,
      "allweone.presentation.language": language,
      "allweone.presentation.web_search": effectiveWebSearch,
    });
    routeLogger.info("Validated outline request payload", {
      requestId,
      numberOfCards,
      promptLength: prompt.length,
      language,
      modelProvider,
      modelId: modelId || "gpt-4o-mini",
      webSearch: effectiveWebSearch,
    });

    if (!prompt || !numberOfCards || !language || messages.length === 0) {
      routeLogger.warn("Outline request rejected: missing required fields", {
        requestId,
        hasPrompt: Boolean(prompt),
        numberOfCards,
        language,
        messageCount: messages.length,
      });
      span.event("allweone.api.request_rejected", {
        "allweone.validation.error": "missing_required_fields",
      });
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const languageMap: Record<string, string> = {
      "en-US": "English (US)",
      pt: "Portuguese",
      es: "Spanish",
      fr: "French",
      de: "German",
      it: "Italian",
      ja: "Japanese",
      ko: "Korean",
      zh: "Chinese",
      ru: "Russian",
      hi: "Hindi",
      ar: "Arabic",
    };

    const actualLanguage = languageMap[language] ?? language;
    const currentDate = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    try {
      assertModelIsConfigured(modelProvider, modelId);
    } catch (error) {
      routeLogger.error("Outline request rejected: invalid model configuration", error, {
        requestId,
        modelProvider,
        modelId: modelId || "gpt-4o-mini",
      });
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Invalid model configuration",
        },
        { status: 400 },
      );
    }
    try {
      await ensureModelIsReady(modelProvider, modelId);
    } catch (error) {
      routeLogger.error(
        "Outline request rejected: selected model could not be prepared",
        error,
        {
          requestId,
          modelProvider,
          modelId: modelId || "gpt-4o-mini",
        },
      );
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to prepare selected model",
        },
        { status: 503 },
      );
    }

    const systemPrompt = buildOutlineSystemPrompt({
      actualLanguage,
      numberOfCards,
      currentDate,
      textContent: metadata.textContent ?? "concise",
      tone: metadata.tone ?? "auto",
      audience: metadata.audience ?? "auto",
      scenario: metadata.scenario ?? "auto",
      webSearch: effectiveWebSearch,
    });

    if (modelProvider === "gemini") {
      routeLogger.info("Presentation outline generation started", {
        requestId,
        modelProvider,
        modelId: modelId || "gemini-3-flash-preview",
        numberOfCards,
        webSearch: effectiveWebSearch,
      });

      const stream = createUIMessageStream({
        originalMessages: messages,
        execute: async ({ writer }) => {
          const modelStream = await modelPicker(modelProvider, modelId).stream([
            new SystemMessage(systemPrompt),
            ...(await toBaseMessages(messages)),
          ]);

          const textId = crypto.randomUUID();
          writer.write({ type: "text-start", id: textId });

          let hasContent = false;
          for await (const chunk of modelStream) {
            const chunkText = extractMessageText(chunk).replace(/^\s+/, "");
            if (chunkText) {
              hasContent = true;
              writer.write({ type: "text-delta", id: textId, delta: chunkText });
            }
          }

          writer.write({ type: "text-end", id: textId });

          if (!hasContent) {
            throw new Error("Gemini returned an empty outline.");
          }
        },
        onError: (error) =>
          error instanceof Error
            ? error.message
            : "Failed to generate outline",
      });

      routeLogger.info("Presentation outline stream created", {
        requestId,
        modelProvider,
        modelId: modelId || "gemini-3-flash-preview",
      });
      span.event("allweone.api.response_stream_created");
      return createUIMessageStreamResponse({ stream });
    }

    const agent = createAgent({
      model: modelPicker(modelProvider, modelId),
      tools: effectiveWebSearch ? [search_tool] : [],
      systemPrompt,
    });

    routeLogger.info("Presentation outline generation started", {
      requestId,
      modelProvider,
      modelId: modelId || "gpt-4o-mini",
      numberOfCards,
      webSearch: effectiveWebSearch,
    });
    const stream = await agent.stream(
      {
        messages: await toBaseMessages(messages),
      },
      {
        streamMode: ["values", "messages"],
      },
    );

    routeLogger.info("Presentation outline stream created", {
      requestId,
      modelProvider,
      modelId: modelId || "gpt-4o-mini",
    });
    span.event("allweone.api.response_stream_created");
    return createUIMessageStreamResponse({
      stream: toUIMessageStream(stream),
    });
  } catch (error) {
    routeLogger.error("Presentation outline generation failed", error, {
      requestId,
    });
    span.error(error);
    return NextResponse.json(
      { error: "Failed to generate outline" },
      { status: 500 },
    );
  } finally {
    span.end();
  }
}
