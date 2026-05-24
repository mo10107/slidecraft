import { type PlateSlide } from "@/components/notebook/presentation/utils/parser";
import { createPresentationPptx } from "@/lib/presentation/pptx-export";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { canReadDocument } from "@/server/share/authorization";
import { normalizeShareEmail } from "@/server/share/utils";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type PresentationContent = {
  slides?: PlateSlide[];
};

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
  const session = await auth();

  const canRead = await canReadDocument(id, {
    userId: session?.user.id ?? null,
    userEmail: normalizeShareEmail(session?.user.email),
  });

  if (!canRead) {
    return NextResponse.json({ error: "Presentation not found" }, { status: 404 });
  }

  const document = await db.baseDocument.findUnique({
    where: { id },
    select: {
      title: true,
      presentation: {
        select: {
          content: true,
          theme: true,
        },
      },
    },
  });

  const content = document?.presentation?.content as PresentationContent | null;
  const slides = content?.slides ?? [];

  if (!document?.presentation || slides.length === 0) {
    return NextResponse.json(
      { error: "No slides available to export" },
      { status: 400 },
    );
  }

  const { buffer, filename } = await createPresentationPptx({
    slides,
    title: document.title,
    themeName: document.presentation.theme,
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "no-store",
    },
  });
}
