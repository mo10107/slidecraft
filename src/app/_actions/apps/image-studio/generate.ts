"use server";

import { env } from "@/env";
import { requireOptionalIntegration } from "@/lib/env/optional-integrations";
import { auth } from "@/server/auth";
import { db } from "@/server/db";

export type GeminiImageModelList =
  | "gemini-3.1-flash-image-preview"
  | "gemini-2.5-flash-image";

export type FalImageModelList = string; // kept for type compat, not used
export type ImageModelList = GeminiImageModelList | string;

async function generateGeminiImage(
  prompt: string,
  model: string,
  userId: string,
) {
  const geminiApiKey = env.GEMINI_API_KEY ?? env.GEMINI_KEY;
  const geminiConfig = requireOptionalIntegration({
    integration: "Gemini",
    envVar: "GEMINI_API_KEY",
    value: geminiApiKey,
    feature: "AI image generation",
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
        generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
      }),
    },
  );

  const data = (await response.json()) as GeminiImageResponse;

  if (!response.ok) {
    throw new Error(
      data.error?.message ??
        `Gemini image generation failed with status ${response.status}`,
    );
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
    const image = await db.generatedImage.create({
      data: { url: dataUrl, prompt, userId },
    });
    return { success: true, image };
  } catch {
    return { success: true, image: { url: dataUrl, prompt, userId, id: `temp-${Date.now()}` } };
  }
}

export async function generateImageAction(
  prompt: string,
  model: ImageModelList = "gemini-3.1-flash-image-preview",
) {
  const session = await auth();
  const userId = session?.user?.id ?? "local-dev-user";

  try {
    return await generateGeminiImage(prompt, model, userId);
  } catch (error) {
    console.error("Error generating image:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate image",
    };
  }
}
