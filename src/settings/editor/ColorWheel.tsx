import { useCallback, useRef } from "react";
import type { Wheel } from "../../shared/types";

interface Props {
  label: string;
  value: Wheel;
  onChange: (w: Wheel) => void;
}

/**
 * A DaVinci-style color wheel: drag the puck for R/G/B balance, the ring slider
 * underneath sets the master (luminance) for that range.
 */
export function ColorWheel({ label, value, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // puck position: map r/g/b to a 2D point (red up-right, green up-left, blue down)
  const ax = (value.r - (value.g + value.b) / 2);
  const ay = (value.g - value.b) * 0.866 - 0; // not used directly; compute below
  // Use a hue-chroma mapping: angle from channel mix.
  const x = (value.r * Math.cos(-Math.PI / 6) + value.g * Math.cos((7 * Math.PI) / 6) + value.b * Math.cos(Math.PI / 2));
  const y = (value.r * Math.sin(-Math.PI / 6) + value.g * Math.sin((7 * Math.PI) / 6) + value.b * Math.sin(Math.PI / 2));
  void ax; void ay;
  const px = 50 + Math.max(-1, Math.min(1, x)) * 42;
  const py = 50 + Math.max(-1, Math.min(1, y)) * 42;

  const setFromXY = useCallback((cx: number, cy: number) => {
    const el = ref.current!;
    const b = el.getBoundingClientRect();
    let nx = ((cx - b.left) / b.width - 0.5) * 2;
    let ny = ((cy - b.top) / b.height - 0.5) * 2;
    const r = Math.hypot(nx, ny);
    if (r > 1) { nx /= r; ny /= r; }
    // invert the 3->2 mapping: project onto the three channel axes
    const red = nx * Math.cos(-Math.PI / 6) + ny * Math.sin(-Math.PI / 6);
    const grn = nx * Math.cos((7 * Math.PI) / 6) + ny * Math.sin((7 * Math.PI) / 6);
    const blu = nx * Math.cos(Math.PI / 2) + ny * Math.sin(Math.PI / 2);
    const scale = 0.5;
    onChange({ ...value, r: red * scale, g: grn * scale, b: blu * scale });
  }, [onChange, value]);

  const onDown = (e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setFromXY(e.clientX, e.clientY);
  };
  const onMove = (e: React.PointerEvent) => {
    if (dragging.current) setFromXY(e.clientX, e.clientY);
  };
  const onUp = () => { dragging.current = false; };
  const reset = () => onChange({ r: 0, g: 0, b: 0, master: 0 });

  return (
    <div className="cwheel">
      <div
        ref={ref}
        className="cwheel-disc"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onDoubleClick={reset}
        title="Drag to balance R/G/B · double-click to reset"
      >
        <div className="cwheel-puck" style={{ left: `${px}%`, top: `${py}%` }} />
      </div>
      <input
        className="cwheel-master"
        type="range"
        min={-0.5}
        max={0.5}
        step={0.005}
        value={value.master}
        onChange={(e) => onChange({ ...value, master: Number(e.target.value) })}
        onDoubleClick={() => onChange({ ...value, master: 0 })}
        title="Master (brightness) for this range"
      />
      <span className="cwheel-label">{label}</span>
    </div>
  );
}
