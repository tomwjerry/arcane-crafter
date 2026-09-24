import { useGame, runtime, pushToast, pushLog } from "./store";
import type {
  ItemId,
  MachineDef,
  NodeRuntime,
  ProcessPath,
  SaveGame,
  StructureId,
  StructureState,
} from "./types";
import {
  ITEMS,
  MACHINES,
  NODE_DEFS,
  MONSTER_DEFS,
  HAND_RECIPES,
  generateMonsters,
  generateNodes,
  isBuildable,
} from "./data";
import { SPAWN_X, SPAWN_Z, regionAt, terrainHeight } from "./terrain";

const SAVE_KEY = "emberforge.save.v1";
const SAVE_VERSION = 1;
const SAVE_EVERY_MS = 12000;

let saveTimer = 0;

/* ------------------------------------------------------------ inventory */

export function itemCount(id: ItemId): number {
  return useGame.getState().inventory[id] ?? 0;
}

function addItem(itemId: ItemId, n: number) {
  useGame.setState((s) => {
    const inv = { ...s.inventory };
    const next = (inv[itemId] ?? 0) + n;
    if (next <= 0) delete inv[itemId];
    else inv[itemId] = next;
    return { inventory: inv };
  });
}

function addItems(items: Partial<Record<ItemId, number>>) {
  useGame.setState((s) => {
    const inv = { ...s.inventory };
    for (const k of Object.keys(items) as ItemId[]) {
      const next = (inv[k] ?? 0) + (items[k] ?? 0);
      if (next <= 0) delete inv[k];
      else inv[k] = next;
    }
    return { inventory: inv };
  });
}

function hasItems(items: Partial<Record<ItemId, number>>): boolean {
  const inv = useGame.getState().inventory;
  return Object.keys(items).every((k) => (inv[k as ItemId] ?? 0) >= (items[k as ItemId] ?? 0));
}

function spendItems(items: Partial<Record<ItemId, number>>) {
  addItems(
    Object.fromEntries(
      Object.entries(items).map(([k, v]) => [k, -(v as number)])
    ) as Partial<Record<ItemId, number>>
  );
}

/* --------------------------------------------------------------- helpers */

function setStructures(fn: (list: StructureState[]) => StructureState[]) {
  useGame.setState((s) => ({ structures: fn(s.structures) }));
}

function patchStructure(id: string, patch: Partial<StructureState>) {
  setStructures((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
}

export function slotAccepts(def: MachineDef, slot: "input" | "fuel" | "output", item: ItemId): boolean {
  if (slot === "fuel") {
    if (def.id === "emberCrucible") return item === "fireCrystal";
    if (def.id === "generator") return (ITEMS[item].burn ?? 0) > 0;
    return (ITEMS[item].burn ?? 0) > 0;
  }
  if (slot === "input") {
    return def.recipes.some((r) => (r.input[item] ?? 0) > 0);
  }
  return false;
}

function recipeOf(s: StructureState) {
  const def = MACHINES[s.defId];
  return def.recipes.find((r) => r.id === s.recipeId) ?? def.recipes[0] ?? null;
}

function outputFits(s: StructureState, out: Partial<Record<ItemId, number>>): boolean {
  for (const k of Object.keys(out) as ItemId[]) {
    if ((s.output[k] ?? 0) + (out[k] ?? 0) > 99) return false;
  }
  return true;
}

function hasInput(s: StructureState, input: Partial<Record<ItemId, number>>): boolean {
  return Object.keys(input).every((k) => (s.input[k as ItemId] ?? 0) >= (input[k as ItemId] ?? 0));
}

function takeFrom(map: Partial<Record<ItemId, number>>, req: Partial<Record<ItemId, number>>) {
  const next = { ...map };
  for (const k of Object.keys(req) as ItemId[]) {
    const v = (next[k] ?? 0) - (req[k] ?? 0);
    if (v <= 0) delete next[k];
    else next[k] = v;
  }
  return next;
}

function grantMachinePath(path: ProcessPath) {
  useGame.setState((s) => {
    if (s.progress.pathsUsed.includes(path)) return {};
    const pathsUsed = [...s.progress.pathsUsed, path];
    if (pathsUsed.length >= 2 && s.progress.stage < 3) {
      pushToast("Second path online — the puzzle opens up", "good");
    }
    return { progress: { ...s.progress, pathsUsed } };
  });
}

function grantIngot() {
  useGame.setState((s) => ({
    progress: { ...s.progress, ingotsProduced: s.progress.ingotsProduced + 1 },
  }));
}

/* -------------------------------------------------------------- world gen */

function buildWorld(seed: number) {
  const places = generateNodes(seed);
  const nodes: NodeRuntime[] = places.map((p) => ({
    id: p.id,
    typeId: p.typeId,
    x: p.x,
    y: terrainHeight(p.x, p.z),
    z: p.z,
    rot: p.rot,
    scale: p.scale,
    amount: NODE_DEFS[p.typeId].yield,
    depletedAt: null,
  }));

  const monsters = generateMonsters(seed, places).map((m) => ({
    id: m.id,
    typeId: m.typeId,
    x: m.x,
    y: terrainHeight(m.x, m.z),
    z: m.z,
    yaw: Math.random() * Math.PI * 2,
    hp: MONSTER_DEFS[m.typeId].hp,
    alive: true,
    homeX: m.x,
    homeZ: m.z,
    guardNodeId: m.guardNodeId,
    state: "patrol" as const,
    targetX: m.x,
    targetZ: m.z,
    think: Math.random() * 2,
    attackCd: 0,
    hurt: 0,
  }));

  runtime.nodes = nodes;
  runtime.monsters = monsters;
  runtime.nodeIndex = new Map(nodes.map((n) => [n.id, n]));
  runtime.monsterIndex = new Map(monsters.map((m) => [m.id, m]));
}

/* ------------------------------------------------------------------ host */

export const host = {
  /** Load the local save (or seed a fresh world) and publish it to the UI store. */
  async init(): Promise<void> {
    const raw = localStorage.getItem(SAVE_KEY);
    let loaded: SaveGame | null = null;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as SaveGame;
        if (parsed.version === SAVE_VERSION) loaded = parsed;
      } catch {
        loaded = null;
      }
    }

    const seed = loaded?.seed ?? 20260922;
    buildWorld(seed);

    const spawnY = terrainHeight(SPAWN_X, SPAWN_Z);
    runtime.player.x = loaded?.player.x ?? SPAWN_X;
    runtime.player.z = loaded?.player.z ?? SPAWN_Z;
    runtime.player.y = loaded ? loaded.player.y : spawnY + 2;
    runtime.vitals.hp = loaded?.player.hp ?? 100;
    runtime.vitals.mana = loaded?.player.mana ?? 100;
    runtime.vitals.stamina = loaded?.player.stamina ?? 100;

    if (loaded) {
      for (const n of loaded.nodes) {
        const node = runtime.nodeIndex.get(n.id);
        if (node) {
          node.amount = n.amount;
          node.depletedAt = n.depletedAt;
        }
      }
      for (const m of loaded.monsters) {
        const mon = runtime.monsterIndex.get(m.id);
        if (mon) {
          mon.hp = m.hp;
          mon.alive = m.alive;
          mon.x = m.x;
          mon.z = m.z;
        }
      }
    }

    useGame.setState({
      ready: true,
      seed,
      inventory: loaded?.inventory ?? {},
      structures: loaded?.structures ?? [],
      progress: loaded?.progress ?? {
        built: [],
        ingotsProduced: 0,
        pathsUsed: [],
        stage: 0,
        won: false,
      },
      region: regionAt(runtime.player.x, runtime.player.z),
      hp: runtime.vitals.hp,
      mana: runtime.vitals.mana,
      stamina: runtime.vitals.stamina,
    });

    if (loaded) pushToast("Save restored", "good");
    else pushToast("A new expedition begins", "info");
  },

  async save(): Promise<void> {
    const s = useGame.getState();
    const payload: SaveGame = {
      version: SAVE_VERSION,
      seed: s.seed,
      savedAt: Date.now(),
      player: {
        x: runtime.player.x,
        z: runtime.player.z,
        y: runtime.player.y,
        hp: runtime.vitals.hp,
        mana: runtime.vitals.mana,
        stamina: runtime.vitals.stamina,
      } as SaveGame["player"],
      inventory: s.inventory,
      structures: s.structures,
      nodes: runtime.nodes.map((n) => ({
        id: n.id,
        amount: n.amount,
        depletedAt: n.depletedAt,
      })),
      monsters: runtime.monsters.map((m) => ({
        id: m.id,
        hp: m.hp,
        alive: m.alive,
        x: m.x,
        z: m.z,
      })),
      progress: s.progress,
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    } catch {
      /* storage may be unavailable — the session still plays fine */
    }
  },

  async hasSave(): Promise<boolean> {
    return localStorage.getItem(SAVE_KEY) !== null;
  },

  async wipe(): Promise<void> {
    localStorage.removeItem(SAVE_KEY);
    location.reload();
  },

  /** Autosave heartbeat, driven by the game loop. */
  tickSave(now: number) {
    if (now - saveTimer > SAVE_EVERY_MS) {
      saveTimer = now;
      void host.save();
    }
  },

  /* ---------------------------------------------------------- gathering */

  completeHarvest(nodeId: string) {
    const node = runtime.nodeIndex.get(nodeId);
    if (!node || node.amount <= 0) return;
    const def = NODE_DEFS[node.typeId];
    node.amount -= 1;
    addItems(def.items);
    const gained = Object.entries(def.items)
      .map(([k, v]) => `${v}× ${ITEMS[k as ItemId].name}`)
      .join(", ");
    pushToast(`+ ${gained}`, "good");
    if (node.amount <= 0) {
      node.depletedAt = Date.now();
      pushToast(`${def.name} depleted — it will regrow`, "info");
    }
    void host.save();
  },

  tickNodes(now: number) {
    for (const n of runtime.nodes) {
      if (n.depletedAt !== null && now - n.depletedAt > NODE_DEFS[n.typeId].respawn * 1000) {
        n.amount = NODE_DEFS[n.typeId].yield;
        n.depletedAt = null;
      }
    }
  },

  /* ----------------------------------------------------------- building */

  canAfford(cost: Partial<Record<ItemId, number>>): boolean {
    return hasItems(cost);
  },

  async placeStructure(
    defId: StructureId,
    x: number,
    z: number
  ): Promise<{ ok: boolean; reason: string }> {
    const def = MACHINES[defId];
    if (!def) return { ok: false, reason: "Unknown structure" };
    if (!isBuildable(x, z)) return { ok: false, reason: "Ground is too steep here" };
    if (!hasItems(def.cost)) {
      return {
        ok: false,
        reason: "Missing " + Object.entries(def.cost)
          .filter(([k, v]) => (useGame.getState().inventory[k as ItemId] ?? 0) < (v as number))
          .map(([k]) => ITEMS[k as ItemId].name)
          .join(", "),
      };
    }

    const s = useGame.getState();
    const sep = def.radius + 0.5;
    for (const o of s.structures) {
      if (Math.hypot(o.x - x, o.z - z) < MACHINES[o.defId].radius + sep) {
        return { ok: false, reason: "Too close to another structure" };
      }
    }
    for (const n of runtime.nodes) {
      if (n.amount > 0 && Math.hypot(n.x - x, n.z - z) < NODE_CLEARANCE + def.radius) {
        return { ok: false, reason: "Blocked by a resource node" };
      }
    }
    for (const m of runtime.monsters) {
      if (m.alive && Math.hypot(m.x - x, m.z - z) < 2 + def.radius) {
        return { ok: false, reason: "A monster is standing there" };
      }
    }

    spendItems(def.cost);

    const structure: StructureState = {
      id: `s${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
      defId,
      x,
      z,
      rot: Math.random() * Math.PI * 2,
      input: {},
      fuel: {},
      output: {},
      recipeId: def.recipes[0]?.id ?? null,
      active: false,
      progress: 0,
      burn: 0,
      charge: 0,
      mana: 0,
      running: false,
      status: def.recipes.length ? "Idle" : "Standby",
    };

    setStructures((list) => [...list, structure]);

    useGame.setState((st) =>
      st.progress.built.includes(defId)
        ? {}
        : { progress: { ...st.progress, built: [...st.progress.built, defId] } }
    );

    pushToast(`${def.name} built`, "good");
    pushLog(`Built ${def.name} at ${x.toFixed(0)}, ${z.toFixed(0)}`);
    void host.save();
    return { ok: true, reason: "" };
  },

  async demolish(id: string): Promise<void> {
    const s = useGame.getState();
    const structure = s.structures.find((st) => st.id === id);
    if (!structure) return;
    const def = MACHINES[structure.defId];
    const refund: Partial<Record<ItemId, number>> = {};
    for (const k of Object.keys(def.cost) as ItemId[]) {
      refund[k] = Math.max(1, Math.floor((def.cost[k] ?? 0) / 2));
    }
    addItems(refund);
    setStructures((list) => list.filter((st) => st.id !== id));
    if (s.selectedMachine === id) useGame.setState({ selectedMachine: null, panel: "none" });
    pushToast(`${def.name} dismantled — half the materials returned`, "info");
    void host.save();
  },

  /* --------------------------------------------------------- machine IO */

  async deposit(structureId: string, slot: "input" | "fuel", itemId: ItemId, count: number) {
    const s = useGame.getState();
    const structure = s.structures.find((st) => st.id === structureId);
    if (!structure) return;
    const def = MACHINES[structure.defId];
    if (!slotAccepts(def, slot, itemId)) {
      pushToast(`${def.name} will not take ${ITEMS[itemId].name} in that slot`, "warn");
      return;
    }
    const have = itemCount(itemId);
    const n = Math.min(count, have);
    if (n <= 0) return;
    spendItems({ [itemId]: n } as Partial<Record<ItemId, number>>);
    setStructures((list) =>
      list.map((st) => {
        if (st.id !== structureId) return st;
        const bag = { ...st[slot] };
        bag[itemId] = (bag[itemId] ?? 0) + n;
        return { ...st, [slot]: bag };
      })
    );
    void host.save();
  },

  async withdraw(structureId: string, slot: "input" | "fuel" | "output", itemId: ItemId, count: number) {
    const s = useGame.getState();
    const structure = s.structures.find((st) => st.id === structureId);
    if (!structure) return;
    const have = structure[slot][itemId] ?? 0;
    const n = Math.min(count, have);
    if (n <= 0) return;
    addItems({ [itemId]: n } as Partial<Record<ItemId, number>>);
    setStructures((list) =>
      list.map((st) => {
        if (st.id !== structureId) return st;
        const bag = { ...st[slot] };
        const next = (bag[itemId] ?? 0) - n;
        if (next <= 0) delete bag[itemId];
        else bag[itemId] = next;
        return { ...st, [slot]: bag };
      })
    );
    if (itemId === "ironIngot" && slot === "output") grantIngot();
    void host.save();
  },

  async collectAll(structureId: string) {
    const s = useGame.getState();
    const structure = s.structures.find((st) => st.id === structureId);
    if (!structure) return;
    const keys = Object.keys(structure.output) as ItemId[];
    if (!keys.length) return;
    for (const k of keys) {
      await host.withdraw(structureId, "output", k, structure.output[k] ?? 0);
    }
  },

  async setRecipe(structureId: string, recipeId: string) {
    setStructures((list) =>
      list.map((st) =>
        st.id === structureId ? { ...st, recipeId, active: false, progress: 0 } : st
      )
    );
  },

  /* -------------------------------------------------------- hand crafting */

  async craft(recipeId: string, times = 1) {
    const recipe = HAND_RECIPES.find((r) => r.id === recipeId);
    if (!recipe) return;
    let made = 0;
    for (let i = 0; i < times; i++) {
      if (!hasItems(recipe.input)) break;
      spendItems(recipe.input);
      addItems(recipe.output);
      made++;
    }
    if (!made) {
      pushToast("Missing materials", "warn");
      return;
    }
    const out = Object.entries(recipe.output)
      .map(([k, v]) => `${(v as number) * made}× ${ITEMS[k as ItemId].name}`)
      .join(", ");
    pushToast(`${recipe.name}: ${out}`, "good");
    if (recipe.id === "keystone") {
      useGame.setState((s) => ({ progress: { ...s.progress, won: true } }));
      pushLog("The Ember Keystone is forged. The expedition is complete.");
    }
    void host.save();
  },

  /* --------------------------------------------------------------- player */

  damagePlayer(amount: number) {
    if (runtime.player.invuln > 0) return;
    runtime.vitals.hp = Math.max(0, runtime.vitals.hp - amount);
    runtime.player.invuln = 0.45;
    runtime.hitFlash = 1;
    if (runtime.vitals.hp <= 0) host.respawn();
  },

  respawn() {
    runtime.vitals.hp = 100;
    runtime.vitals.mana = Math.max(runtime.vitals.mana, 50);
    runtime.vitals.stamina = 100;
    runtime.player.x = SPAWN_X;
    runtime.player.z = SPAWN_Z;
    runtime.player.y = terrainHeight(SPAWN_X, SPAWN_Z) + 3;
    runtime.player.invuln = 3;
    useGame.setState((s) => ({ deathCount: s.deathCount + 1 }));
    pushToast("You woke back at camp — nothing was lost", "bad");
    void host.save();
  },

  killMonster(id: string) {
    const m = runtime.monsterIndex.get(id);
    if (!m || !m.alive) return;
    m.alive = false;
    m.hp = 0;
    const def = MONSTER_DEFS[m.typeId];
    addItems(def.drops);
    const drop = Object.entries(def.drops)
      .map(([k, v]) => `${v}× ${ITEMS[k as ItemId].name}`)
      .join(", ");
    pushToast(`${def.name} defeated — ${drop}`, "good");
    pushLog(`Defeated a ${def.name}.`);
    void host.save();
  },
};

const NODE_CLEARANCE = 2.2;
