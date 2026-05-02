import { cn } from "@/lib/utils";
import { NodeApi, PathApi } from "platejs";
import { SlateElement, type SlateElementProps } from "platejs/static";
import { getAlignmentClasses } from "../../utils";

export function ConsItemStatic(props: SlateElementProps) {
  const path = props.editor.api.findPath(props.element) ?? [-1];
  const parentPath = PathApi.parent(path);
  const parentElement = NodeApi.get(props.editor, parentPath);
  const { alignment = "left" } = parentElement as {
    alignment?: "left" | "center" | "right";
  };

  return (
    <div
      className={cn("flex h-full flex-col rounded-lg p-6")}
      data-bg-export="true"
      style={{
        background: "color-mix(in srgb, var(--presentation-primary) 60%, var(--presentation-text) 40%)",
        color: "var(--presentation-background)",
      }}
    >
      <SlateElement {...props} className={cn(getAlignmentClasses(alignment))}>
        {props.children}
      </SlateElement>
    </div>
  );
}


