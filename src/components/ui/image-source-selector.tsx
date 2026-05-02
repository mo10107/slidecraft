"use client";

import { type ImageModelList } from "@/app/_actions/apps/image-studio/generate";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Image, Wand2 } from "lucide-react";

export const IMAGE_MODELS: { value: ImageModelList; label: string; group?: string }[] = [
  { value: "gemini-3.1-flash-image-preview", label: "Nano Banana 2 (Gemini)", group: "gemini" },
  { value: "gemini-2.5-flash-image", label: "Nano Banana (Gemini)", group: "gemini" },
  { value: "fal-ai/flux-2/flash", label: "Flux 2 Flash", group: "fal" },
  { value: "fal-ai/flux/dev", label: "Flux Dev", group: "fal" },
  { value: "fal-ai/flux-2-pro", label: "Flux 2 Pro", group: "fal" },
];

interface ImageSourceSelectorProps {
  imageSource: "automatic" | "ai" | "stock";
  imageModel: ImageModelList;
  stockImageProvider: "unsplash" | "pixabay";
  onImageSourceChange: (source: "automatic" | "ai" | "stock") => void;
  onImageModelChange: (model: ImageModelList) => void;
  onStockImageProviderChange: (provider: "unsplash" | "pixabay") => void;
  className?: string;
  showLabel?: boolean;
}

export function ImageSourceSelector({
  imageSource,
  imageModel,
  stockImageProvider,
  onImageSourceChange,
  onImageModelChange,
  onStockImageProviderChange,
  className,
  showLabel = true,
}: ImageSourceSelectorProps) {
  return (
    <div className={className}>
      {showLabel && (
        <Label className="mb-2 block text-sm font-medium">Image Source</Label>
      )}
      <Select
        value={
          imageSource === "ai"
            ? imageModel || "fal-ai/flux-2/flash"
            : imageSource === "stock"
              ? `stock-${stockImageProvider}`
              : "automatic"
        }
        onValueChange={(value) => {
          if (value === "automatic") {
            onImageSourceChange("automatic");
          } else if (value.startsWith("stock-")) {
            // Handle stock image selection
            const provider = value.replace("stock-", "") as
              | "unsplash"
              | "pixabay";
            onImageSourceChange("stock");
            onStockImageProviderChange(provider);
          } else {
            // Handle AI model selection
            onImageSourceChange("ai");
            onImageModelChange(value as ImageModelList);
          }
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select image generation method" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="automatic" className="font-medium">
              Automatic
            </SelectItem>
          </SelectGroup>
          <SelectGroup>
            <SelectLabel className="flex items-center gap-1 text-primary/80">
              <Wand2 size={10} />
              Gemini (Nano Banana)
            </SelectLabel>
            {IMAGE_MODELS.filter((m) => m.group === "gemini").map((model) => (
              <SelectItem key={model.value} value={model.value}>
                {model.label}
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectGroup>
            <SelectLabel className="flex items-center gap-1 text-primary/80">
              <Wand2 size={10} />
              FAL / Flux
            </SelectLabel>
            {IMAGE_MODELS.filter((m) => m.group === "fal").map((model) => (
              <SelectItem key={model.value} value={model.value}>
                {model.label}
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectGroup>
            <SelectLabel className="flex items-center gap-1 text-primary/80">
              <Image size={10} />
              Stock Images
            </SelectLabel>
            <SelectItem value="stock-unsplash">Unsplash</SelectItem>
            <SelectItem value="stock-pixabay">Pixabay</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
