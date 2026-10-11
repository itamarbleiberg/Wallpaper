import { useState } from "react";
import { Button, Modal } from "./controls";
import { Icon } from "./icons";
import { useStore, type Page } from "./store";

const STEPS: { icon: string; title: string; body: string; page: Page; action: string }[] = [
  { icon: "gallery", title: "Pick a living scene", body: "Choose from 53 offline wallpapers. Double-click any card to apply it immediately.", page: "gallery", action: "Browse wallpapers" },
  { icon: "edit", title: "Edit without destroying the original", body: "The Resolve-style editor gives you source controls, transform, professional color, effects and enhancement. Undo anything with Ctrl+Z.", page: "editor", action: "Open editor" },
  { icon: "displays", title: "Set up every display", body: "Give each monitor its own wallpaper, mirror one scene, or span a single wallpaper across the whole desktop.", page: "displays", action: "Configure displays" },
  { icon: "performance", title: "Games keep all their performance", body: "AquaWall pauses automatically for fullscreen games and can throttle on battery or while your PC is idle.", page: "performance", action: "Review performance" },
];

export function Welcome() {
  const { config, update, go } = useStore();
  const [step, setStep] = useState(0);
  if (!config || config.general.onboardingDone) return null;
  const s = STEPS[step];
  const finish = (page?: Page) => {
    update((c) => { c.general.onboardingDone = true; }, { immediate: true, history: false });
    if (page) go(page);
  };
  return <Modal title="Welcome to AquaWall 4" onClose={() => finish()} footer={<><Button kind="ghost" onClick={() => finish()}>Skip tour</Button>{step > 0 && <Button kind="ghost" onClick={() => setStep(step - 1)}>Back</Button>}{step < STEPS.length - 1 ? <Button kind="primary" onClick={() => setStep(step + 1)}>Next</Button> : <Button kind="primary" icon="check" onClick={() => finish(s.page)}>Start creating</Button>}</>}>
    <div className="welcome-step">
      <div className="welcome-icon"><Icon name={s.icon} size={32} /></div>
      <span className="eyebrow">Step {step + 1} of {STEPS.length}</span>
      <h2>{s.title}</h2>
      <p>{s.body}</p>
      <button className="welcome-link" onClick={() => finish(s.page)}>{s.action} →</button>
      <div className="welcome-dots">{STEPS.map((_, i) => <i key={i} className={i === step ? "on" : ""} />)}</div>
    </div>
  </Modal>;
}
