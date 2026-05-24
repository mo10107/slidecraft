import type PptxGenJS from "pptxgenjs";
import PptxGen from "pptxgenjs";

import {
  type LayoutType,
  type PlateNode,
  type PlateSlide,
} from "@/components/notebook/presentation/utils/parser";
import { themes, type ThemeProperties } from "@/lib/presentation/themes";

const SLIDE_W = 13.333;
const SLIDE_H = 7.5;
const MARGIN = 0.65;

type SlideBlock = {
  text: string;
  type: string;
};

type RawNode = {
  type?: string;
  children?: unknown[];
  color?: string;
};

type ExportTheme = {
  background: string;
  text: string;
  heading: string;
  accent: string;
  cardBackground: string;
  headingFont: string;
  bodyFont: string;
};

function stripHash(color: string | undefined, fallback: string): string {
  const value = color?.trim() || fallback;
  const match = value.match(/#?([0-9a-fA-F]{6})/);
  return (match?.[1] ?? fallback.replace("#", "")).toUpperCase();
}

function getTheme(themeName?: string): ExportTheme {
  const theme = themes[(themeName ?? "mystique") as keyof typeof themes] as
    | ThemeProperties
    | undefined;

  return {
    background: stripHash(theme?.colors.background, "#0F172A"),
    text: stripHash(theme?.colors.text, "#E5E7EB"),
    heading: stripHash(theme?.colors.heading, "#FFFFFF"),
    accent: stripHash(theme?.colors.accent, "#8B5CF6"),
    cardBackground: stripHash(theme?.colors.cardBackground, "#111827"),
    headingFont: theme?.fonts.heading ?? "Aptos Display",
    bodyFont: theme?.fonts.body ?? "Aptos",
  };
}

function getTextFromNode(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const record = node as { text?: unknown; children?: unknown };
  if (typeof record.text === "string") return record.text;
  if (Array.isArray(record.children)) {
    return record.children.map(getTextFromNode).filter(Boolean).join(" ");
  }
  return "";
}

function extractBlocks(nodes: PlateNode[] | undefined): SlideBlock[] {
  const blocks: SlideBlock[] = [];
  const textBlockTypes = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li"]);

  function visit(node: unknown) {
    if (!node || typeof node !== "object") return;
    const record = node as { type?: string; children?: unknown[] };
    const type = record.type ?? "p";
    const text = getTextFromNode(node).replace(/\s+/g, " ").trim();

    if (text && textBlockTypes.has(type)) {
      blocks.push({ text, type });
      return;
    }

    if (Array.isArray(record.children)) {
      for (const child of record.children) {
        if (child && typeof child === "object" && "type" in child) {
          visit(child);
        }
      }
    }
  }

  for (const node of nodes ?? []) visit(node);

  const seen = new Set<string>();
  return blocks.filter((block) => {
    const key = `${block.type}:${block.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function findNodeByType(nodes: PlateNode[] | undefined, type: string) {
  return (nodes ?? []).find((node) => (node as RawNode).type === type) as
    | RawNode
    | undefined;
}

function getDirectChildBlock(node: RawNode | undefined, type: string) {
  return node?.children?.find((child) => (child as RawNode).type === type) as
    | RawNode
    | undefined;
}

function getImageData(url?: string) {
  if (!url) return undefined;
  if (url.startsWith("data:")) return { data: url };
  return { path: url };
}

function imageRegion(layoutType?: LayoutType) {
  switch (layoutType) {
    case "left":
      return { x: 0, y: 0, w: 5.2, h: SLIDE_H };
    case "right":
      return { x: 8.13, y: 0, w: 5.2, h: SLIDE_H };
    case "vertical":
      return { x: 0, y: 0, w: SLIDE_W, h: 2.25 };
    case "background":
      return { x: 0, y: 0, w: SLIDE_W, h: SLIDE_H };
    default:
      return undefined;
  }
}

function textRegion(layoutType?: LayoutType) {
  switch (layoutType) {
    case "left":
      return { x: 5.75, y: 0.7, w: 6.9, h: 6.1 };
    case "right":
      return { x: 0.7, y: 0.7, w: 6.9, h: 6.1 };
    case "vertical":
      return { x: 0.85, y: 2.7, w: 11.65, h: 4.15 };
    case "background":
      return { x: 0.85, y: 0.85, w: 11.65, h: 5.9 };
    default:
      return { x: MARGIN, y: 0.75, w: SLIDE_W - MARGIN * 2, h: 6 };
  }
}

function addStaircaseContent(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  plateSlide: PlateSlide,
  theme: ExportTheme,
) {
  const staircase = findNodeByType(plateSlide.content, "staircase");
  const items =
    staircase?.children?.filter((child) => (child as RawNode).type === "stair-item") ??
    [];

  if (items.length === 0) return false;

  const region = textRegion(plateSlide.layoutType);
  const itemCount = Math.min(items.length, 4);
  const rowGap = 0.12;
  const rowH = Math.min(1.7, (region.h - rowGap * (itemCount - 1)) / itemCount);
  const baseNumberW = 0.9;
  const maxNumberW = Math.min(2.65, region.w * 0.36);
  const numberStep = itemCount > 1 ? (maxNumberW - baseNumberW) / (itemCount - 1) : 0;
  let y = Math.max(0.05, region.y - 0.55);

  items.slice(0, itemCount).forEach((rawItem, index) => {
    const item = rawItem as RawNode;
    const heading = getTextFromNode(getDirectChildBlock(item, "h3"));
    const paragraph = getTextFromNode(getDirectChildBlock(item, "p"));
    const numberW = baseNumberW + numberStep * index;
    const textX = region.x + numberW + 0.22;
    const textW = Math.max(1.5, region.w - numberW - 0.22);

    slide.addShape(pptx.ShapeType.roundRect, {
      x: region.x,
      y,
      w: numberW,
      h: rowH,
      rectRadius: 0.08,
      fill: { color: "E5E7EB" },
      line: { color: "E5E7EB", transparency: 100 },
    });
    slide.addText(String(index + 1), {
      x: region.x,
      y,
      w: numberW,
      h: rowH,
      margin: 0,
      align: "center",
      valign: "middle",
      color: stripHash(staircase?.color, theme.background),
      fontFace: theme.headingFont,
      fontSize: 16,
      bold: true,
    });
    slide.addText(heading, {
      x: textX,
      y: y + 0.05,
      w: textW,
      h: 0.42,
      margin: 0,
      color: theme.heading,
      fontFace: theme.headingFont,
      fontSize: 17,
      bold: true,
      fit: "shrink",
    });
    slide.addText(paragraph, {
      x: textX,
      y: y + 0.55,
      w: textW,
      h: Math.max(0.65, rowH - 0.62),
      margin: 0,
      color: theme.text,
      fontFace: theme.bodyFont,
      fontSize: 11.5,
      breakLine: false,
      fit: "shrink",
    });
    if (index < itemCount - 1) {
      slide.addShape(pptx.ShapeType.line, {
        x: textX,
        y: y + rowH + rowGap / 2,
        w: textW,
        h: 0,
        line: { color: theme.accent, transparency: 70, width: 0.6 },
      });
    }
    y += rowH + rowGap;
  });

  return true;
}

function addStructuredContent(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  plateSlide: PlateSlide,
  theme: ExportTheme,
) {
  if (findNodeByType(plateSlide.content, "staircase")) {
    return addStaircaseContent(pptx, slide, plateSlide, theme);
  }

  return false;
}

function addRootImage(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  plateSlide: PlateSlide,
) {
  const image = getImageData(plateSlide.rootImage?.url);
  const region = imageRegion(plateSlide.layoutType);
  if (!image || !region) return;

  slide.addImage({
    ...image,
    ...region,
    sizing: {
      type: plateSlide.layoutType === "background" ? "cover" : "cover",
      ...region,
    },
    altText: plateSlide.rootImage?.query ?? "Slide image",
  });

  if (plateSlide.layoutType === "background") {
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: SLIDE_W,
      h: SLIDE_H,
      fill: { color: "000000", transparency: 45 },
      line: { color: "000000", transparency: 100 },
    });
  }
}

function addContentBlocks(
  slide: PptxGenJS.Slide,
  blocks: SlideBlock[],
  plateSlide: PlateSlide,
  theme: ExportTheme,
) {
  const region = textRegion(plateSlide.layoutType);
  const heading = blocks.find((b) => /^h[1-3]$/.test(b.type));
  const bodyBlocks = blocks.filter((b) => b !== heading).slice(0, 8);
  const titleText = heading?.text || bodyBlocks.shift()?.text || "Untitled Slide";

  slide.addText(titleText, {
    x: region.x,
    y: region.y,
    w: region.w,
    h: titleText.length > 50 ? 0.9 : 0.62,
    margin: 0,
    color: theme.heading,
    fontFace: theme.headingFont,
    fontSize: plateSlide.layoutType === "vertical" ? 28 : 24,
    bold: true,
    fit: "shrink",
    breakLine: false,
  });

  let y = region.y + (titleText.length > 50 ? 1.05 : 0.8);
  const lineGap = plateSlide.layoutType === "vertical" ? 0.5 : 0.56;
  for (const block of bodyBlocks) {
    const isSubhead = /^h[2-6]$/.test(block.type);
    const text = block.text.length > 165 ? `${block.text.slice(0, 162)}...` : block.text;
    slide.addText(text, {
      x: region.x,
      y,
      w: region.w,
      h: isSubhead ? 0.36 : 0.42,
      margin: 0,
      color: isSubhead ? theme.heading : theme.text,
      fontFace: isSubhead ? theme.headingFont : theme.bodyFont,
      fontSize: isSubhead ? 15 : 12.5,
      bold: isSubhead,
      fit: "shrink",
      breakLine: false,
      bullet: isSubhead ? undefined : { type: "bullet" },
      paraSpaceAfter: 2,
    });
    y += lineGap;
    if (y > region.y + region.h - 0.35) break;
  }
}

function safeFilename(name: string): string {
  return (
    name
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 80) || "presentation"
  );
}

export async function createPresentationPptx({
  slides,
  title,
  themeName,
}: {
  slides: PlateSlide[];
  title: string;
  themeName?: string;
}) {
  const pptx = new PptxGen();
  const exportTheme = getTheme(themeName);

  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "presentation-ai";
  pptx.company = "presentation-ai";
  pptx.subject = title;
  pptx.title = title;
  pptx.theme = {
    headFontFace: exportTheme.headingFont,
    bodyFontFace: exportTheme.bodyFont,
  };

  for (const plateSlide of slides) {
    const pptSlide = pptx.addSlide();
    pptSlide.background = { color: stripHash(plateSlide.bgColor, exportTheme.background) };
    pptSlide.color = exportTheme.text;

    addRootImage(pptx, pptSlide, plateSlide);

    const blocks = extractBlocks(plateSlide.content);
    if (!addStructuredContent(pptx, pptSlide, plateSlide, exportTheme)) {
      addContentBlocks(pptSlide, blocks, plateSlide, exportTheme);
    }

    pptSlide.addNotes(
      blocks
        .map((block) => block.text)
        .filter(Boolean)
        .join("\n"),
    );
  }

  const output = await pptx.write({
    outputType: "nodebuffer",
    compression: true,
  });

  return {
    buffer: Buffer.isBuffer(output) ? output : Buffer.from(output as ArrayBuffer),
    filename: `${safeFilename(title)}.pptx`,
  };
}
