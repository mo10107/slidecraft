"use client";

import { cn } from "@/lib/utils";
import { NodeApi, PathApi } from "platejs";
import { PlateElement, type PlateElementProps } from "platejs/react";
import { type TProsConsGroupElement } from "../plugins/pros-cons-plugin";
import { getAlignmentClasses } from "../utils";
export const ConsItem = (props: PlateElementProps) => {
  const parentPath = PathApi.parent(props.path);
  const parentElement = NodeApi.get(props.editor, parentPath);
  const { alignment = "left" } = parentElement as TProsConsGroupElement;
  return (
    <div
      className={cn("flex h-full flex-col rounded-lg p-6")}
      data-bg-export="true"
      style={{
        background: "color-mix(in srgb, var(--presentation-primary) 60%, var(--presentation-text) 40%)",
        color: "var(--presentation-background)",
      }}
    >
      <PlateElement {...props} className={cn(getAlignmentClasses(alignment))}>
        {props.children}
      </PlateElement>
    </div>
  );
};
