import { type SlateElementProps, SlateElement } from "platejs/static";

import { cn } from "@/lib/utils";

export function PresentationParagraphElementStatic(props: SlateElementProps) {
  // Render as div when element is a list item to avoid invalid <ul> inside <p> HTML nesting
  const hasList = Boolean((props.element as { listStyleType?: unknown }).listStyleType);
  return (
    <SlateElement
      as={hasList ? "div" : "p"}
      {...props}
      className={cn(
        "m-0 px-0 py-1 text-[1em]",
        "leading-[1.6]",
        "text-(--presentation-text)",
        "[font-family:var(--presentation-body-font)]",
        "caret-primary",
        props.className,
      )}
    >
      {props.children}
    </SlateElement>
  );
}


