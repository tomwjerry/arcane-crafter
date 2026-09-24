import { useGame, type PanelId } from "./store";

export const keys = new Set<string>();

const PANEL_KEYS: Record<string, PanelId> = {
  KeyB: "build",
  KeyI: "inventory",
  KeyM: "map",
  KeyH: "help",
};
export const mouse = { left: false, right: false };
const pressed = new Set<string>();

/** Consumable edge-triggered presses (so one keydown = one action). */
export function consume(key: string): boolean {
  if (pressed.has(key)) {
    pressed.delete(key);
    return true;
  }
  return false;
}

export function pointerTarget(): HTMLElement | null {
  return document.getElementById("game-root");
}

export function lockPointer() {
  const el = pointerTarget();
  if (!el) return;
  const locked = document.pointerLockElement === el;
  if (!locked) {
    const p = el.requestPointerLock() as unknown as Promise<void> | undefined;
    if (p && typeof p.catch === "function") p.catch(() => undefined);
  }
}

export function unlockPointer() {
  if (document.pointerLockElement) document.exitPointerLock();
}

export function panelOpen(): boolean {
  return useGame.getState().panel !== "none";
}

/** Open a HUD panel: releases the cursor and drops any pending build ghost. */
export function openPanel(panel: PanelId) {
  useGame.setState({ panel, selectedMachine: null, buildChoice: null });
  unlockPointer();
}

/** Close whatever panel is open and hand the cursor back to the game. */
export function closePanel() {
  useGame.setState({ panel: "none", selectedMachine: null });
  lockPointer();
}

export function installInput() {
  const onKeyDown = (e: KeyboardEvent) => {
    const code = e.code;
    if (
      [
        "Space",
        "Tab",
        "KeyE",
        "KeyB",
        "KeyI",
        "KeyM",
        "KeyH",
        "Digit1",
        "Digit2",
        "Digit3",
        "Digit4",
        "Digit5",
        "Digit6",
        "Digit7",
        "Digit8",
        "Digit9",
      ].includes(code) ||
      code.startsWith("Arrow")
    ) {
      e.preventDefault();
    }
    const first = !keys.has(code);
    if (first) {
      pressed.add(code);
      const g = useGame.getState();
      if (g.started) {
        if (code === "Escape") {
          if (g.panel !== "none") closePanel();
          else if (g.buildChoice) useGame.setState({ buildChoice: null });
        } else if (code === "KeyE" && g.panel === "machine") {
          pressed.delete(code);
          closePanel();
        } else {
          const target = PANEL_KEYS[code];
          if (target) {
            if (g.panel === target) closePanel();
            else openPanel(target);
          }
        }
      }
    }
    keys.add(code);
  };

  const onKeyUp = (e: KeyboardEvent) => {
    keys.delete(e.code);
  };

  const onMouseMove = (e: MouseEvent) => {
    if (document.pointerLockElement !== pointerTarget()) return;
    const sens = 0.0022;
    const cam = useGame.getState();
    void cam;
    const rt = getRuntimeCam();
    rt.yaw -= e.movementX * sens;
    rt.pitch = Math.max(-0.55, Math.min(1.05, rt.pitch + e.movementY * sens));
  };

  const onMouseDown = (e: MouseEvent) => {
    if (document.pointerLockElement !== pointerTarget()) return;
    if (e.button === 0) mouse.left = true;
    if (e.button === 2) mouse.right = true;
  };

  const onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) mouse.left = false;
    if (e.button === 2) mouse.right = false;
  };

  const onContext = (e: Event) => e.preventDefault();

  const onPointerLockChange = () => {
    const locked = document.pointerLockElement === pointerTarget();
    useGame.setState({ pointerLocked: locked });
    if (!locked) {
      keys.clear();
      mouse.left = false;
      mouse.right = false;
      // Losing the cursor while placement mode is armed would strand the ghost.
      const s = useGame.getState();
      if (s.buildChoice) useGame.setState({ buildChoice: null });
    }
  };

  const onBlur = () => {
    keys.clear();
    mouse.left = false;
    mouse.right = false;
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("contextmenu", onContext);
  document.addEventListener("pointerlockchange", onPointerLockChange);
  window.addEventListener("blur", onBlur);

  return () => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mousedown", onMouseDown);
    window.removeEventListener("mouseup", onMouseUp);
    window.removeEventListener("contextmenu", onContext);
    document.removeEventListener("pointerlockchange", onPointerLockChange);
    window.removeEventListener("blur", onBlur);
  };
}

/* The camera runtime lives outside React; kept here to avoid a cycle. */
import { runtime } from "./store";
function getRuntimeCam() {
  return runtime.cam;
}
