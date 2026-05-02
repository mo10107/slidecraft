"use server";

import { env } from "@/env";
import { requireOptionalIntegration } from "@/lib/env/optional-integrations";
import { auth } from "@/server/auth";
import { db } from "@/server/db";

const DEFAULT_SLIDE_IMAGE_MODEL = "gemini-3.1-flash-image-preview";

export async function generateSlideImageAction(
  prompt: string,
  imageModel: string = DEFAULT_SLIDE_IMAGE_MODEL,
) {
  const session = await auth();
  const userId = session?.user?.id ?? "local-dev-user";

  try {
    return await generateGeminiSlideImage(prompt, imageModel, userId);
  } catch (error) {
    console.error("Error generating slide image:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate slide image",
    };
  }
}

async function generateGeminiSlideImage(prompt: string, model: string, userId: string) {
  const geminiApiKey = env.GEMINI_API_KEY ?? env.GEMINI_KEY;
  const geminiConfig = requireOptionalIntegration({
    integration: "Gemini",
    envVar: "GEMINI_API_KEY",
    value: geminiApiKey,
    feature: "slide image generation",
  });

  if (!geminiConfig.ok) {
    return { success: false, error: geminiConfig.error };
  }

  interface GeminiImageResponse {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
          inlineData?: { mimeType?: string; data?: string };
        }>;
      };
    }>;
    error?: { message?: string };
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": geminiConfig.value,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["IMAGE", "TEXT"],
          imageConfig: { aspectRatio: "16:9" },
        },
      }),
    },
  );

  const data = (await response.json()) as GeminiImageResponse;

  if (!response.ok) {
    throw new Error(data.error?.message ?? `Gemini API error ${response.status}`);
  }

  const imagePart = data.candidates?.[0]?.content?.parts?.find(
    (p) => p.inlineData?.data,
  );

  if (!imagePart?.inlineData?.data) {
    throw new Error("Gemini returned no image data");
  }

  const mimeType = imagePart.inlineData.mimeType ?? "image/png";
  const dataUrl = `data:${mimeType};base64,${imagePart.inlineData.data}`;

  try {
    const generatedImage = await db.generatedImage.create({
      data: { url: dataUrl, prompt, userId },
    });
    return { success: true, image: generatedImage };
  } catch {
    return { success: true, image: { url: dataUrl, prompt, userId, id: `temp-${Date.now()}` } };
  }
}
