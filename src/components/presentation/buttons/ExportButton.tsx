"use client";

import { Button } from "@/components/ui/button";
import { usePresentationState } from "@/states/presentation-state";
import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function ExportButton() {
  const presentationId = usePresentationState((s) => s.currentPresentationId);
  const presentationTitle = usePresentationState(
    (s) => s.currentPresentationTitle,
  );
  const slides = usePresentationState((s) => s.slides);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!presentationId || isExporting || slides.length === 0) return;

    setIsExporting(true);
    try {
      const { scanAllSlides, exportPresentationToPptx, downloadBlob } =
        await import("../export");

      toast.info("Scanning slides...");

      const scanResults = await scanAllSlides(slides);

      if (scanResults.length === 0) {
        throw new Error(
          "Failed to scan slides. Please ensure all slides are visible on the page.",
        );
      }

      toast.info("Generating PowerPoint...");

      const result = await exportPresentationToPptx(
        scanResults,
        slides,
        presentationTitle ?? "presentation",
      );

      downloadBlob(result.blob, result.fileName);
      toast.success("Presentation exported successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to export PPTX",
      );
      console.error("Export error:", error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant="ghost"
      className="h-9 gap-1.5"
      title="Export PowerPoint"
      disabled={!presentationId || slides.length === 0 || isExporting}
      onClick={handleExport}
    >
      <Download className="size-4" />
      <span className="hidden sm:inline">
        {isExporting ? "Exporting..." : "Export"}
      </span>
    </Button>
  );
}
