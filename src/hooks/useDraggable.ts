import { useRef, useState, useCallback } from "react";

interface Pos {
  x: number;
  y: number;
}

// returns a style override (once the person has dragged) and a mousedown handler
// to attach to whatever element should act as the drag handle
export function useDraggable() {
  const [pos, setPos] = useState<Pos | null>(null); // null = use the CSS default position
  const dragging = useRef(false);
  const start = useRef<Pos>({ x: 0, y: 0 });
  const origin = useRef<Pos>({ x: 0, y: 0 });

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // don't start a drag from an interactive control inside the handle (e.g. the collapse button)
      const target = e.target as HTMLElement;
      if (target.closest("button, input, select")) return;
      dragging.current = true;
      start.current = { x: e.clientX, y: e.clientY };
      const el = (e.currentTarget as HTMLElement).closest(".dock, .floating-panel") as HTMLElement | null;
      const rect = el?.getBoundingClientRect();
      origin.current = pos ?? { x: rect?.left ?? 0, y: rect?.top ?? 0 };

      const onMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        const dx = ev.clientX - start.current.x;
        const dy = ev.clientY - start.current.y;
        setPos({ x: origin.current.x + dx, y: origin.current.y + dy });
      };
      const onUp = () => {
        dragging.current = false;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [pos]
  );

  const style: React.CSSProperties | undefined = pos
    ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto", transform: "none" }
    : undefined;

  return { style, onMouseDown, isDragged: pos !== null };
}
