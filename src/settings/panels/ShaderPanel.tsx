import { useEffect, useState } from "react";
import { BUILTIN_SHADERS } from "../../engine/builtinShaders";
import { Section, Select, Slider, Toggle, times } from "../controls";
import { useStore } from "../store";

export function ShaderPanel() {
  const { selected, updatePreset, previewError } = useStore();
  const p = selected();
  const [draft, setDraft] = useState(p?.shader.code ?? "");
  useEffect(() => setDraft(p?.shader.code ?? ""), [p?.id, p?.shader.code]);
  if (!p) return null;
  if (p.kind !== "shader") return <Section title="Shader"><p className="dim">Select a shader wallpaper in the Library, or create one with “New shader”.</p></Section>;
  const s = p.shader;

  return (
    <>
      <Section title="Shader">
        <div className="row"><span className="row-label">Name</span><input className="text" value={p.name} onChange={(e) => updatePreset((x) => { x.name = e.target.value; })} /></div>
        <Select
          label="Start from"
          value={s.builtinId || "custom"}
          onChange={(id) => updatePreset((x) => {
            const b = BUILTIN_SHADERS.find((y) => y.id === id);
            x.shader.builtinId = b ? b.id : "";
            if (b) x.shader.code = b.code;
          })}
          options={[{ value: "custom", label: "Custom code" }, ...BUILTIN_SHADERS.map((b) => ({ value: b.id, label: b.name }))]}
        />
        <Slider label="Animation speed" value={s.speed} min={0} max={3} onChange={(v) => updatePreset((x) => { x.shader.speed = v; })} format={times} />
        <Toggle label="Follow mouse (iMouse)" value={s.mouse} onChange={(v) => updatePreset((x) => { x.shader.mouse = v; })} />
      </Section>
      <Section
        title="GLSL code (Shadertoy compatible)"
        right={<button className="btn primary small" disabled={draft === s.code} onClick={() => updatePreset((x) => { x.shader.code = draft; x.shader.builtinId = ""; })}>Compile &amp; apply (Ctrl+Enter)</button>}
      >
        <p className="dim small">Write a <code>mainImage(out vec4 fragColor, in vec2 fragCoord)</code> function. Available: <code>iResolution, iTime, iTimeDelta, iFrame, iMouse, iDate</code> and <code>iChannel0</code> (64×1 live audio spectrum when the visualizer is on).</p>
        <textarea
          className="code"
          spellCheck={false}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) updatePreset((x) => { x.shader.code = draft; x.shader.builtinId = ""; });
            if (e.key === "Tab") {
              e.preventDefault();
              const t = e.currentTarget;
              const a = t.selectionStart;
              setDraft(draft.slice(0, a) + "  " + draft.slice(t.selectionEnd));
              requestAnimationFrame(() => t.setSelectionRange(a + 2, a + 2));
            }
          }}
        />
        {previewError.shader && <pre className="error-box">{previewError.shader}</pre>}
      </Section>
    </>
  );
}
