import type {
  ItemDef,
  ItemId,
  MachineDef,
  MonsterTypeId,
  NodeTypeId,
  RegionId,
} from "./types";
import { regionAt, terrainSlope, terrainHeight, HALF, fbm } from "./terrain";

/* ------------------------------------------------------------------ items */

export const ITEMS: Record<ItemId, ItemDef> = {
  wood: {
    id: "wood",
    name: "Wood",
    color: "#a9803f",
    desc: "Common fuel. Slow, cheap, everywhere.",
    burn: 9,
  },
  stone: { id: "stone", name: "Stone", color: "#a09a90", desc: "The bones of every structure." },
  coal: {
    id: "coal",
    name: "Coal",
    color: "#55555f",
    desc: "Dense fuel. Burns far longer than wood.",
    burn: 24,
  },
  ironOre: {
    id: "ironOre",
    name: "Iron Ore",
    color: "#c09268",
    desc: "Raw iron. Four different ways to melt it.",
  },
  fireCrystal: {
    id: "fireCrystal",
    name: "Fire Crystal",
    color: "#ff6a2b",
    desc: "Scarce bottled heat. The Ember Crucible runs on nothing else.",
    burn: 50,
  },
  manaDust: {
    id: "manaDust",
    name: "Mana Dust",
    color: "#a98bff",
    desc: "Feeds a Mana Reactor, which feeds the Rune Circle.",
  },
  ironIngot: {
    id: "ironIngot",
    name: "Iron Ingot",
    color: "#dcd6cc",
    desc: "Refined metal. Wire, forges and the Keystone all start here.",
  },
  wire: {
    id: "wire",
    name: "Copper Wire",
    color: "#e0913f",
    desc: "Hand-drawn from one ingot. Links generators to machines.",
  },
  keystone: {
    id: "keystone",
    name: "Ember Keystone",
    color: "#ffd27a",
    desc: "Forged from every path at once. Proof you mastered the forge.",
  },
};

/* --------------------------------------------------------------- machines */

const SMELT_FUEL = {
  id: "smelt_fuel",
  name: "Smelt Iron",
  input: { ironOre: 1 } as Partial<Record<ItemId, number>>,
  output: { ironIngot: 1 } as Partial<Record<ItemId, number>>,
  duration: 6.5,
  needs: "fuel" as const,
};

const SMELT_POWER = {
  id: "smelt_power",
  name: "Arc Smelt",
  input: { ironOre: 1 } as Partial<Record<ItemId, number>>,
  output: { ironIngot: 1 } as Partial<Record<ItemId, number>>,
  duration: 3.4,
  needs: "power" as const,
};

const SMELT_MAGIC = {
  id: "smelt_magic",
  name: "Transmute Iron",
  input: { ironOre: 1 } as Partial<Record<ItemId, number>>,
  output: { ironIngot: 1 } as Partial<Record<ItemId, number>>,
  duration: 4.6,
  needs: "magic" as const,
  consumesMana: 25,
};

const SMELT_FIRE = {
  id: "smelt_fire",
  name: "Flash Smelt",
  input: { ironOre: 1 } as Partial<Record<ItemId, number>>,
  output: { ironIngot: 1 } as Partial<Record<ItemId, number>>,
  duration: 2.2,
  needs: "fire" as const,
};

const REACT_CHARGE = {
  id: "react_charge",
  name: "Channelling",
  input: { manaDust: 1 } as Partial<Record<ItemId, number>>,
  output: {} as Partial<Record<ItemId, number>>,
  duration: 4,
  needs: "fuel" as const,
  producesMana: 45,
};

export const MACHINES: Record<string, MachineDef> = {
  forge: {
    id: "forge",
    name: "Stone Forge",
    blurb:
      "The honest way. Drop in wood, coal — even a fire crystal — and wait. Slow, cheap, and it never asks for wiring.",
    path: "fuel",
    cost: { stone: 8, wood: 4 },
    radius: 1.6,
    height: 2.0,
    connect: 0,
    slots: ["input", "fuel", "output"],
    recipes: [SMELT_FUEL],
  },
  generator: {
    id: "generator",
    name: "Combustion Generator",
    blurb:
      "Burns fuel to push current down the wire. It does nothing on its own — you have to plan where the power goes.",
    path: "power",
    cost: { stone: 6, wood: 6 },
    radius: 1.5,
    height: 2.2,
    connect: 4.5,
    slots: ["fuel"],
    powerGen: 70,
    recipes: [],
  },
  wirePost: {
    id: "wirePost",
    name: "Wire Run",
    blurb:
      "A linked span of copper. Runs chain to each other and to machines — every hop must stay inside reach or the grid breaks.",
    path: "power",
    cost: { wire: 1 },
    radius: 0.35,
    height: 1.6,
    connect: 7,
    slots: [],
    recipes: [],
  },
  electricForge: {
    id: "electricForge",
    name: "Arc-Forge",
    blurb:
      "The fastest smelter, but it eats 60 W. If a single link in the chain is missing, it sits dead.",
    path: "power",
    cost: { ironIngot: 2, stone: 4 },
    radius: 1.6,
    height: 2.0,
    connect: 4.5,
    slots: ["input", "output"],
    powerDraw: 60,
    recipes: [SMELT_POWER],
  },
  manaReactor: {
    id: "manaReactor",
    name: "Mana Reactor",
    blurb:
      "Devours mana dust and stores raw arcane charge. Any Rune Circle within its link radius can draw on that pool.",
    path: "magic",
    cost: { stone: 6, manaDust: 4 },
    radius: 1.4,
    height: 2.4,
    connect: 0,
    slots: ["input"],
    manaCapacity: 200,
    recipes: [REACT_CHARGE],
  },
  runeCircle: {
    id: "runeCircle",
    name: "Rune Circle",
    blurb:
      "Transmutes ore with no fuel at all — provided a Mana Reactor sits inside its ring. Positioning is the whole puzzle.",
    path: "magic",
    cost: { manaDust: 3, stone: 4 },
    radius: 2.0,
    height: 0.4,
    connect: 0,
    slots: ["input", "output"],
    linkRange: 13,
    recipes: [SMELT_MAGIC],
  },
  emberCrucible: {
    id: "emberCrucible",
    name: "Ember Crucible",
    blurb:
      "Consumes fire crystals outright. Blisteringly fast, and every run burns something you cannot easily replace.",
    path: "fire",
    cost: { fireCrystal: 1, stone: 6 },
    radius: 1.5,
    height: 1.9,
    connect: 0,
    slots: ["input", "fuel", "output"],
    recipes: [SMELT_FIRE],
  },
};

export const MACHINE_LIST: MachineDef[] = [
  MACHINES.forge,
  MACHINES.generator,
  MACHINES.wirePost,
  MACHINES.electricForge,
  MACHINES.manaReactor,
  MACHINES.runeCircle,
  MACHINES.emberCrucible,
];

/** Hand crafts performed from the inventory panel (no machine required). */
export const HAND_RECIPES: {
  id: string;
  name: string;
  input: Partial<Record<ItemId, number>>;
  output: Partial<Record<ItemId, number>>;
  note: string;
}[] = [
  {
    id: "draw_wire",
    name: "Draw Copper Wire",
    input: { ironIngot: 1 },
    output: { wire: 4 },
    note: "One ingot, four wire runs. The entry ticket to electrification.",
  },
  {
    id: "keystone",
    name: "Forge the Ember Keystone",
    input: { ironIngot: 6, manaDust: 4, fireCrystal: 2 },
    output: { keystone: 1 },
    note: "Requires metal, magic and fire at once — the final proof of mastery.",
  },
];

/* ------------------------------------------------------------------ nodes */

export interface NodeDef {
  id: NodeTypeId;
  name: string;
  items: Partial<Record<ItemId, number>>;
  yield: number;
  harvestTime: number;
  respawn: number;
  guarded: boolean;
}

export const NODE_DEFS: Record<NodeTypeId, NodeDef> = {
  tree: {
    id: "tree",
    name: "Ironbark Pine",
    items: { wood: 3 },
    yield: 3,
    harvestTime: 0.7,
    respawn: 60,
    guarded: false,
  },
  rock: {
    id: "rock",
    name: "Boulder",
    items: { stone: 4 },
    yield: 3,
    harvestTime: 0.7,
    respawn: 60,
    guarded: false,
  },
  ironVein: {
    id: "ironVein",
    name: "Iron Vein",
    items: { ironOre: 3 },
    yield: 3,
    harvestTime: 1.1,
    respawn: 85,
    guarded: false,
  },
  coalVein: {
    id: "coalVein",
    name: "Coal Seam",
    items: { coal: 3 },
    yield: 3,
    harvestTime: 0.9,
    respawn: 85,
    guarded: false,
  },
  fireCrystal: {
    id: "fireCrystal",
    name: "Fire Crystal Cluster",
    items: { fireCrystal: 2 },
    yield: 2,
    harvestTime: 1.6,
    respawn: 150,
    guarded: true,
  },
  manaShard: {
    id: "manaShard",
    name: "Mana Shard",
    items: { manaDust: 3 },
    yield: 3,
    harvestTime: 1.3,
    respawn: 120,
    guarded: true,
  },
};

/* --------------------------------------------------------------- monsters */

export interface MonsterDef {
  id: MonsterTypeId;
  name: string;
  hp: number;
  speed: number;
  damage: number;
  aggro: number;
  leash: number;
  guard: boolean;
  color: string;
  scale: number;
  drops: Partial<Record<ItemId, number>>;
}

export const MONSTER_DEFS: Record<MonsterTypeId, MonsterDef> = {
  crawler: {
    id: "crawler",
    name: "Mire Crawler",
    hp: 60,
    speed: 4.4,
    damage: 8,
    aggro: 15,
    leash: 46,
    guard: false,
    color: "#7fbf5a",
    scale: 1,
    drops: { coal: 2 },
  },
  sentinel: {
    id: "sentinel",
    name: "Stone Sentinel",
    hp: 150,
    speed: 3.1,
    damage: 15,
    aggro: 13,
    leash: 17,
    guard: true,
    color: "#a49b8e",
    scale: 1.35,
    drops: { stone: 4, ironOre: 2 },
  },
  hound: {
    id: "hound",
    name: "Ember Hound",
    hp: 85,
    speed: 6.1,
    damage: 12,
    aggro: 17,
    leash: 48,
    guard: false,
    color: "#ff7043",
    scale: 0.9,
    drops: { fireCrystal: 1 },
  },
};

/* ---------------------------------------------------------------- regions */

export const REGIONS: Record<
  RegionId,
  { name: string; tag: string; color: string; blurb: string }
> = {
  greenhollow: {
    name: "Greenhollow",
    tag: "Meadow",
    color: "#6ea24d",
    blurb: "Soft hills, timber and stone. Where every expedition starts.",
  },
  ironscar: {
    name: "Ironscar Basin",
    tag: "Quarry",
    color: "#b58a5c",
    blurb: "Ripped open by old machines. Iron and coal in the open rock.",
  },
  emberfall: {
    name: "Emberfall Rift",
    tag: "Volcanic",
    color: "#ff7043",
    blurb: "Glassy ash and crystal heat, guarded by things that like the dark.",
  },
  aethermoor: {
    name: "Aethermoor",
    tag: "Arcane",
    color: "#a98bff",
    blurb: "Thin ground, thin light. Mana collects in the hollows.",
  },
};

export const REGION_LIST: RegionId[] = [
  "greenhollow",
  "ironscar",
  "emberfall",
  "aethermoor",
];

/* ------------------------------------------------------- deterministic RNG */

export function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Placement {
  id: string;
  typeId: NodeTypeId;
  x: number;
  z: number;
  rot: number;
  scale: number;
}

const NODE_QUOTAS: Record<RegionId, [NodeTypeId, number][]> = {
  greenhollow: [
    ["tree", 34],
    ["rock", 20],
    ["ironVein", 9],
    ["coalVein", 7],
  ],
  ironscar: [
    ["tree", 8],
    ["rock", 26],
    ["ironVein", 24],
    ["coalVein", 16],
  ],
  emberfall: [
    ["rock", 20],
    ["ironVein", 8],
    ["coalVein", 12],
    ["fireCrystal", 13],
  ],
  aethermoor: [
    ["tree", 12],
    ["rock", 18],
    ["ironVein", 9],
    ["manaShard", 15],
  ],
};

const REGION_CENTERS: Record<RegionId, [number, number]> = {
  greenhollow: [-65, -65],
  ironscar: [65, -65],
  emberfall: [65, 65],
  aethermoor: [-65, 65],
};

const SPAWN_SAFE = { x: -15, z: -15 };

/** Deterministic scatter of harvestable nodes across the four regions. */
export function generateNodes(seed: number): Placement[] {
  const rng = makeRng(seed);
  const out: Placement[] = [];
  const taken: [number, number][] = [];
  let counter = 0;

  for (const region of REGION_LIST) {
    const [cx, cz] = REGION_CENTERS[region];
    for (const [typeId, count] of NODE_QUOTAS[region]) {
      let placed = 0;
      let guard = 0;
      while (placed < count && guard < count * 60) {
        guard++;
        const ang = rng() * Math.PI * 2;
        const rad = Math.pow(rng(), 0.65) * 58;
        const x = cx + Math.cos(ang) * rad;
        const z = cz + Math.sin(ang) * rad;
        if (Math.abs(x) > HALF - 14 || Math.abs(z) > HALF - 14) continue;
        if (regionAt(x, z) !== region) continue;
        if (Math.hypot(x - SPAWN_SAFE.x, z - SPAWN_SAFE.z) < 13) continue;
        if (terrainSlope(x, z) > 0.72) continue;
        let tooClose = false;
        for (const t of taken) {
          if (Math.hypot(t[0] - x, t[1] - z) < (NODE_DEFS[typeId].guarded ? 9 : 4.6)) {
            tooClose = true;
            break;
          }
        }
        if (tooClose) continue;
        taken.push([x, z]);
        out.push({
          id: `n${counter++}`,
          typeId,
          x,
          z,
          rot: rng() * Math.PI * 2,
          scale: 0.82 + rng() * 0.5,
        });
        placed++;
      }
    }
  }
  return out;
}

export interface MonsterPlacement {
  id: string;
  typeId: MonsterTypeId;
  x: number;
  z: number;
  guardNodeId: string | null;
}

/** Roaming hunters, node guardians and rift hounds. */
export function generateMonsters(seed: number, nodes: Placement[]): MonsterPlacement[] {
  const rng = makeRng(seed ^ 0x9e3779b9);
  const out: MonsterPlacement[] = [];
  let counter = 0;

  // Every guarded node gets a sentinel standing over it.
  for (const n of nodes) {
    if (!NODE_DEFS[n.typeId].guarded) continue;
    const ang = rng() * Math.PI * 2;
    out.push({
      id: `m${counter++}`,
      typeId: "sentinel",
      x: n.x + Math.cos(ang) * 3.4,
      z: n.z + Math.sin(ang) * 3.4,
      guardNodeId: n.id,
    });
  }

  const roam: MonsterPlacement[] = [];
  const addRoam = (typeId: MonsterTypeId, region: RegionId, count: number) => {
    const [cx, cz] = REGION_CENTERS[region];
    for (let i = 0; i < count; i++) {
      let x = 0;
      let z = 0;
      for (let tries = 0; tries < 60; tries++) {
        const ang = rng() * Math.PI * 2;
        const rad = 16 + Math.pow(rng(), 0.7) * 54;
        x = cx + Math.cos(ang) * rad;
        z = cz + Math.sin(ang) * rad;
        if (Math.abs(x) < HALF - 14 && Math.abs(z) < HALF - 14) break;
      }
      roam.push({ id: `m${counter++}`, typeId, x, z, guardNodeId: null });
    }
  };

  addRoam("crawler", "greenhollow", 3);
  addRoam("crawler", "ironscar", 4);
  addRoam("crawler", "aethermoor", 3);
  addRoam("hound", "emberfall", 6);

  return [...out, ...roam];
}

/** Flat spot used by the build ghost / placement validity test. */
export function isBuildable(x: number, z: number): boolean {
  if (Math.abs(x) > HALF - 8 || Math.abs(z) > HALF - 8) return false;
  return terrainSlope(x, z) < 0.62;
}

export function surfaceY(x: number, z: number): number {
  return terrainHeight(x, z);
}
