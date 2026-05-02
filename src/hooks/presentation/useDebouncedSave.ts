import { updatePresentation } from "@/app/_actions/notebook/presentation/presentationActions";
import { type PlateSlide } from "@/components/notebook/presentation/utils/parser";
import { buildPresentationCustomization } from "@/lib/presentation/customization";
import { usePresentationState } from "@/states/presentation-state";
import debounce from "lodash.debounce";
import { useCallback, useEffect } from "react";

/**
 * Strip base64 data URLs from slide root images before persisting.
 * The data URL can be several MB; we only need the reference URL
 * (which is the same value once stored in the DB).
 * Any slide whose rootImage.url is a data URL gets it cleared so
 * the editor re-renders it from the DB-backed record.
 */
function slidesForPersistence(slides: PlateSlide[]): PlateSlide[] {
  return slides.map((slide) => {
    if (slide.rootImage?.url?.startsWith("data:")) {
      return {
        ...slide,
        rootImage: { ...slide.rootImage, url: "" },
      };
    }
    return slide;
  });
}

interface UseDebouncedSaveOptions {
  /**
   * Debounce delay in milliseconds
   * @default 1000
   */
  delay?: number;
}

/**
 * Custom hook for debounced saving of presentation slides
 * Automatically saves when slides are changed after the specified delay
 * Will not save while content is being generated
 */
export const useDebouncedSave = (options: UseDebouncedSaveOptions = {}) => {
  const { delay = 1000 } = options;
  const { setSavingStatus } = usePresentationState();

  // Create debounced save function
  const debouncedSave = useCallback(
    debounce(
      async () => {
        // Get the latest state directly from the store
        const {
          slides,
          currentPresentationId,
          currentPresentationTitle,
          outline,
          imageSource,
          presentationStyle,
          language,
          pageBackground,
          thumbnailUrl,
          customThemeData,
          pageStyle,
          textContent,
          tone,
          audience,
          scenario,
        } = usePresentationState.getState();

        // Don't save if there's no presentation or slides
        if (!currentPresentationId || slides.length === 0) return;
        try {
          setSavingStatus("saving");

          await updatePresentation({
            id: currentPresentationId,
            content: {
              slides: slidesForPersistence(slides),
            },
            title: currentPresentationTitle ?? "",
            outline,
            imageSource,
            presentationStyle,
            language,
            thumbnailUrl,
            customization: buildPresentationCustomization({
              customThemeData,
              pageStyle,
              presentationStyle: presentationStyle ?? "",
              textContent,
              tone,
              audience,
              scenario,
              pageBackground,
            }),
          });

          setSavingStatus("saved");
          // Reset to idle after 2 seconds
          setTimeout(() => {
            setSavingStatus("idle");
          }, 2000);
        } catch (error) {
          console.error("Failed to save presentation:", error);
          setSavingStatus("idle");
        }
      },
      delay,
      { maxWait: delay * 2 },
    ),
    [],
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSave.cancel();
    };
  }, [debouncedSave]);

  // Save slides immediately (useful for manual saves)
  const saveImmediately = useCallback(async () => {
    debouncedSave.cancel();

    // Get the latest state directly from the store
    const {
      slides,
      currentPresentationId,
      currentPresentationTitle,
      outline,
      imageSource,
      presentationStyle,
      language,
      pageBackground,
      thumbnailUrl,
      customThemeData,
      pageStyle,
      textContent,
      tone,
      audience,
      scenario,
    } = usePresentationState.getState();

    // Don't save if there's no presentation
    if (!currentPresentationId || slides.length === 0) return;

    try {
      setSavingStatus("saving");

      await updatePresentation({
        id: currentPresentationId,
        content: {
          slides: slidesForPersistence(slides),
        },
        title: currentPresentationTitle ?? "",
        outline,
        language,
        imageSource,
        presentationStyle,
        thumbnailUrl,
        customization: buildPresentationCustomization({
          customThemeData,
          pageStyle,
          presentationStyle: presentationStyle ?? "",
          textContent,
          tone,
          audience,
          scenario,
          pageBackground,
        }),
      });

      setSavingStatus("saved");
      // Reset to idle after 2 seconds
      setTimeout(() => {
        setSavingStatus("idle");
      }, 2000);
    } catch (error) {
      console.error("Failed to save presentation:", error);
      setSavingStatus("idle");
    }
  }, [debouncedSave, setSavingStatus]);

  // Trigger save function
  const save = useCallback(() => {
    setSavingStatus("saving");
    void debouncedSave();
  }, [debouncedSave, setSavingStatus]);

  return {
    save,
    saveImmediately,
  };
};
