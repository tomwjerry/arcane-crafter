import { create } from "zustand";
import type {
  ItemId,
  NodeRuntime,
  ProcessPath,
  ProgressState,
  StructureId,
  StructureState,
} from "./types";

export type PanelId = "none" | "inventory" | "build" | "machine" | "map" | "help";

/** Fast-changing per-frame data deliberately kept OUT of React. */
export interface RuntimeState {
  player: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    grounded: boolean;
    attackAnim: number;
    boltAnim: number;
    invuln: number;
  };
  vitals: { hp: number; mana: number; stamina: number };
  cam: { yaw: number; pitch: number };
  nodes: NodeRuntime[];
  nodeIndex: Map<string, NodeRuntime>;
  monsters: import("./types").MonsterRuntime[];
  monsterIndex: Map<string, import("./types").MonsterRuntime>;
  projectiles: import("./types").Projectile[];
  harvest: { nodeId: string; t: number } | null;
  nearestNode: string | null;
  nearestMachine: string | null;
  buildGhost: { defId: StructureId; x: number; z: number; valid: boolean; reason: string } | null;
  hitFlash: number;
}

export const runtime: RuntimeState = {
  player: {
    x: -15,
    y: 6,
    z: -15,
    yaw: 0,
    grounded: true,
    attackAnim: 0,
    boltAnim: 0,
    invuln: 0,
  },
  vitals: { hp: 100, mana: 100, stamina: 100 },
  cam: { yaw: Math.PI * 0.15, pitch: 0.32 },
  nodes: [],
  nodeIndex: new Map(),
  monsters: [],
  monsterIndex: new Map(),
  projectiles: [],
  harvest: null,
  nearestNode: null,
  nearestMachine: null,
  buildGhost: null,
  hitFlash: 0,
};

export interface Toast {
  id: number;
  text: string;
  kind: "info" | "warn" | "good" | "bad";
}

interface GameState {
  ready: boolean;
  /** false while the title screen is up — pauses the whole simulation */
  started: boolean;
  seed: number;
  panel: PanelId;
  selectedMachine: string | null;
  buildChoice: StructureId | null;
  pointerLocked: boolean;

  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  stamina: number;
  maxStamina: number;
  region: string;

  inventory: Partial<Record<ItemId, number>>;
  structures: StructureState[];
  progress: ProgressState;

  log: string[];
  toasts: Toast[];
  deathCount: number;
}

export const useGame = create<GameState>(() => ({
  ready: false,
  started: false,
  seed: 20260922,
  panel: "none",
  selectedMachine: null,
  buildChoice: null,
  pointerLocked: false,

  hp: 100,
  maxHp: 100,
  mana: 100,
  maxMana: 100,
  stamina: 100,
  maxStamina: 100,
  region: "Greenhollow",

  inventory: {},
  structures: [],
  progress: {
    built: [],
    ingotsProduced: 0,
    pathsUsed: [],
    stage: 0,
    won: false,
  },

  log: [],
  toasts: [],
  deathCount: 0,
}));

let toastId = 1;
export function pushToast(text: string, kind: Toast["kind"] = "info") {
  const id = toastId++;
  useGame.setState((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, kind }] }));
  window.setTimeout(() => {
    useGame.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  }, 3600);
}

export function pushLog(text: string) {
  useGame.setState((s) => ({ log: [text, ...s.log].slice(0, 60) }));
}

export const OBJECTIVES: { text: string; hint: string; done: (s: GameState) => boolean }[] = [
  {
    text: "Gather 8 Wood and 12 Stone",
    hint: "Walk up to a tree or boulder and press E",
    done: (s) => (s.inventory.wood ?? 0) >= 8 && (s.inventory.stone ?? 0) >= 12,
  },
  {
    text: "Build a Stone Forge",
    hint: "Press B, pick the Stone Forge, click the ground",
    done: (s) => s.progress.built.includes("forge"),
  },
  {
    text: "Smelt 3 Iron Ingots",
    hint: "Feed the forge ore + fuel, then collect the output",
    done: (s) => s.progress.ingotsProduced >= 3,
  },
  {
    text: "Open a second processing path",
    hint: "Arc-Forge, Rune Circle or Ember Crucible — pick your route",
    done: (s) => s.progress.pathsUsed.length >= 2,
  },
  {
    text: "Forge the Ember Keystone",
    hint: "6 ingots, 4 mana dust, 2 fire crystals — in your inventory panel",
    done: (s) => (s.inventory.keystone ?? 0) >= 1,
  },
];

export const PATH_LABEL: Record<ProcessPath, string> = {
  fuel: "Fuel",
  power: "Electric",
  magic: "Magic",
  fire: "Fire Crystal",
};
