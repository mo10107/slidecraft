"use client";

import { Button } from "@/components/ui/button";
import { usePresentationState } from "@/states/presentation-state";
import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const PPTX_MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

function safeFileName(title: string | null) {
  const baseName = title?.trim() || "presentation";
  return `${baseName
    .split("")
    .filter((char) => char.charCodeAt(0) >= 32 && !/[<>:"/\\|?*]/.test(char))
    .join("")
    .replace(/\s+/g, "-")
    .slice(0, 120)}.pptx`;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function waitForSlideAssets(slideElement: HTMLElement) {
  await document.fonts?.ready;

  const images = Array.from(slideElement.querySelectorAll("img"));
  await Promise.allSettled(
    images.map(async (image) => {
      if (image.complete && image.naturalWidth > 0) return;
      await image.decode().catch(
        () =>
          new Promise<void>((resolve) => {
            image.addEventListener("load", () => resolve(), { once: true });
            image.addEventListener("error", () => resolve(), { once: true });
          }),
      );
    }),
  );

  await new Promise((resolve) => requestAnimationFrame(resolve));
}

function getSlideElement(slideId: string) {
  return document.querySelector<HTMLElement>(`#presentation-root-${slideId}`);
}

export function ExportPptxButton() {
  const presentationId = usePresentationState((s) => s.currentPresentationId);
  const presentationTitle = usePresentationState(
    (s) => s.currentPresentationTitle,
  );
  const slides = usePresentationState((s) => s.slides);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  const handleExport = async () => {
    if (!presentationId || isExporting || slides.length === 0) return;

    setIsExporting(true);
    setExportProgress({ current: 0, total: slides.length });
    try {
      const [{ toPng }, { default: PptxGenJS }] = await Promise.all([
        import("html-to-image"),
        import("pptxgenjs"),
      ]);

      const pptx = new PptxGenJS();
      pptx.layout = "LAYOUT_16x9";
      pptx.author = "presentation-ai";
      if (presentationTitle) {
        pptx.subject = presentationTitle;
        pptx.title = presentationTitle;
      }
      pptx.company = "presentation-ai";

      for (let index = 0; index < slides.length; index++) {
        const slideData = slides[index];
        if (!slideData) continue;

        const slideElement = getSlideElement(slideData.id);
        if (!slideElement) {
          throw new Error(`Could not find slide ${index + 1} to export`);
        }

        slideElement.scrollIntoView({ block: "center", inline: "nearest" });
        await waitForSlideAssets(slideElement);

        const dataUrl = await toPng(slideElement, {
          cacheBust: true,
          skipFonts: true,
          pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
          backgroundColor:
            getComputedStyle(slideElement).backgroundColor || "#ffffff",
          style: {
            border: "0",
            borderRadius: "0",
            boxShadow: "none",
            outline: "none",
          },
        });

        pptx.addSlide().addImage({
          data: dataUrl,
          x: 0,
          y: 0,
          w: 10,
          h: 5.625,
        });

        setExportProgress({ current: index + 1, total: slides.length });
      }

      const output = await pptx.write({ outputType: "arraybuffer" });
      const blob = new Blob([output as ArrayBuffer], {
        type: PPTX_MIME,
      });

      downloadBlob(blob, safeFileName(presentationTitle));
      toast.success(
        "PPTX export ready with slide visuals captured from the canvas",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to export PPTX",
      );
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  const label = exportProgress
    ? `${exportProgress.current}/${exportProgress.total}`
    : isExporting
      ? "Exporting"
      : "Export";

  return (
    <Button
      variant="ghost"
      className="h-9 gap-1.5"
      title="Export PPTX"
      disabled={!presentationId || slides.length === 0 || isExporting}
      onClick={handleExport}
    >
      <Download className="size-4" />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}
