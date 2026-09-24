export type ItemId =
  | "wood"
  | "stone"
  | "coal"
  | "ironOre"
  | "fireCrystal"
  | "manaDust"
  | "ironIngot"
  | "wire"
  | "keystone";

export type StructureId =
  | "forge"
  | "generator"
  | "wirePost"
  | "electricForge"
  | "manaReactor"
  | "runeCircle"
  | "emberCrucible";

export type ProcessPath = "fuel" | "power" | "magic" | "fire";

export type NodeTypeId =
  | "tree"
  | "rock"
  | "ironVein"
  | "coalVein"
  | "fireCrystal"
  | "manaShard";

export type MonsterTypeId = "crawler" | "sentinel" | "hound";

export type RegionId = "greenhollow" | "ironscar" | "emberfall" | "aethermoor";

export type SlotId = "input" | "fuel" | "output";

export interface ItemDef {
  id: ItemId;
  name: string;
  color: string;
  desc: string;
  /** burn time in seconds when used as furnace/generator fuel */
  burn?: number;
}

export interface RecipeDef {
  id: string;
  name: string;
  input: Partial<Record<ItemId, number>>;
  output: Partial<Record<ItemId, number>>;
  duration: number;
  /** what the machine needs for this recipe to run */
  needs: ProcessPath;
  /** mana produced per craft (Mana Reactor) */
  producesMana?: number;
  /** mana consumed per craft (Rune Circle) */
  consumesMana?: number;
}

export interface MachineDef {
  id: StructureId;
  name: string;
  blurb: string;
  path: ProcessPath | "infra";
  cost: Partial<Record<ItemId, number>>;
  /** footprint radius used for placement overlap + connection tests */
  radius: number;
  height: number;
  connect: number;
  slots: SlotId[];
  powerGen?: number;
  powerDraw?: number;
  manaCapacity?: number;
  linkRange?: number;
  recipes: RecipeDef[];
}

export interface StructureState {
  id: string;
  defId: StructureId;
  x: number;
  z: number;
  rot: number;
  input: Partial<Record<ItemId, number>>;
  fuel: Partial<Record<ItemId, number>>;
  output: Partial<Record<ItemId, number>>;
  recipeId: string | null;
  active: boolean;
  progress: number;
  burn: number;
  charge: number;
  mana: number;
  running: boolean;
  status: string;
}

export interface NodeRuntime {
  id: string;
  typeId: NodeTypeId;
  x: number;
  y: number;
  z: number;
  rot: number;
  scale: number;
  amount: number;
  depletedAt: number | null;
}

export interface MonsterRuntime {
  id: string;
  typeId: MonsterTypeId;
  x: number;
  y: number;
  z: number;
  yaw: number;
  hp: number;
  alive: boolean;
  homeX: number;
  homeZ: number;
  guardNodeId: string | null;
  state: "idle" | "patrol" | "chase" | "return" | "flee";
  targetX: number;
  targetZ: number;
  think: number;
  attackCd: number;
  hurt: number;
}

export interface Projectile {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  friendly: boolean;
}

export interface SaveGame {
  version: number;
  seed: number;
  savedAt: number;
  player: {
    x: number;
    y: number;
    z: number;
    hp: number;
    mana: number;
    stamina: number;
  };
  inventory: Partial<Record<ItemId, number>>;
  structures: StructureState[];
  nodes: { id: string; amount: number; depletedAt: number | null }[];
  monsters: { id: string; hp: number; alive: boolean; x: number; z: number }[];
  progress: ProgressState;
}

export interface ProgressState {
  built: StructureId[];
  ingotsProduced: number;
  pathsUsed: ProcessPath[];
  stage: number;
  won: boolean;
}
