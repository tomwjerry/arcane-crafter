import { useGame } from "./store";
import type { ItemId, ProcessPath, StructureState } from "./types";
import { ITEMS, MACHINES } from "./data";

/* Four independent processing paths, each with its own prerequisites and
   its own way of failing. Everything is driven by the MACHINES table. */

interface Component {
  forges: StructureState[];
  generators: StructureState[];
  posts: StructureState[];
}

/** Union the electric graph: generator — wire — wire — machine.
 *  Wire posts act as pass-through nodes, so the chain must be planned. */
function buildGrid(list: StructureState[]): Component[] {
  const nodes = list.filter((s) => {
    const def = MACHINES[s.defId];
    return def.powerGen !== undefined || def.powerDraw !== undefined || def.connect > 0;
  });
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    let p = parent.get(id) ?? id;
    if (p !== id) {
      p = find(p);
      parent.set(id, p);
    }
    return p;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const n of nodes) if (!parent.has(n.id)) parent.set(n.id, n.id);

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const reach = Math.max(MACHINES[a.defId].connect, MACHINES[b.defId].connect);
      if (reach > 0 && Math.hypot(a.x - b.x, a.z - b.z) <= reach) union(a.id, b.id);
    }
  }

  const groups = new Map<string, Component>();
  for (const n of nodes) {
    const root = find(n.id);
    let g = groups.get(root);
    if (!g) {
      g = { forges: [], generators: [], posts: [] };
      groups.set(root, g);
    }
    const def = MACHINES[n.defId];
    if (def.powerDraw !== undefined) g.forges.push(n);
    else if (def.powerGen !== undefined) g.generators.push(n);
    else g.posts.push(n);
  }
  return [...groups.values()];
}

function burnableIn(bag: Partial<Record<ItemId, number>>): ItemId | null {
  for (const k of Object.keys(bag) as ItemId[]) {
    if ((bag[k] ?? 0) > 0 && (ITEMS[k].burn ?? 0) > 0) return k;
  }
  return null;
}

function feedBurner(s: StructureState): boolean {
  if (s.burn > 0) return true;
  const fuel = burnableIn(s.fuel);
  if (!fuel) return false;
  const bag = { ...s.fuel };
  const left = (bag[fuel] ?? 0) - 1;
  if (left <= 0) delete bag[fuel];
  else bag[fuel] = left;
  s.fuel = bag;
  s.burn = ITEMS[fuel].burn ?? 6;
  return true;
}

function hasInput(s: StructureState, input: Partial<Record<ItemId, number>>) {
  return Object.keys(input).every(
    (k) => (s.input[k as ItemId] ?? 0) >= (input[k as ItemId] ?? 0)
  );
}

function outputFits(s: StructureState, out: Partial<Record<ItemId, number>>) {
  for (const k of Object.keys(out) as ItemId[]) {
    if ((s.output[k] ?? 0) + (out[k] ?? 0) > 99) return false;
  }
  return true;
}

function takeFrom(
  map: Partial<Record<ItemId, number>>,
  req: Partial<Record<ItemId, number>>
) {
  const next = { ...map };
  for (const k of Object.keys(req) as ItemId[]) {
    const v = (next[k] ?? 0) - (req[k] ?? 0);
    if (v <= 0) delete next[k];
    else next[k] = v;
  }
  return next;
}

function selectedRecipe(s: StructureState) {
  const def = MACHINES[s.defId];
  return def.recipes.find((r) => r.id === s.recipeId) ?? def.recipes[0] ?? null;
}

function wantsToRun(s: StructureState): boolean {
  if (s.active) return true;
  const recipe = selectedRecipe(s);
  if (!recipe) return false;
  return hasInput(s, recipe.input) && outputFits(s, recipe.output);
}

/** Mana reactors close enough to feed one rune circle. */
function linkedReactors(s: StructureState, all: StructureState[]): StructureState[] {
  const range = MACHINES[s.defId].linkRange ?? 0;
  if (range <= 0) return [];
  return all.filter(
    (o) =>
      o.defId === "manaReactor" &&
      Math.hypot(o.x - s.x, o.z - s.z) <= range &&
      o.mana > 0
  );
}

function notePathUsed(path: ProcessPath) {
  useGame.setState((st) =>
    st.progress.pathsUsed.includes(path)
      ? {}
      : { progress: { ...st.progress, pathsUsed: [...st.progress.pathsUsed, path] } }
  );
}

function noteIngots(n: number) {
  useGame.setState((st) => ({
    progress: { ...st.progress, ingotsProduced: st.progress.ingotsProduced + n },
  }));
}

/** Advance every structure by `dt` seconds, then publish once if anything moved. */
export function tickMachines(dt: number) {
  const state = useGame.getState();
  if (!state.structures.length) return;

  const next = state.structures.map((s) => ({
    ...s,
    input: { ...s.input },
    fuel: { ...s.fuel },
    output: { ...s.output },
  }));

  /* --- electric grid: settle supply/demand before burning any fuel --- */
  const poweredIds = new Set<string>();
  for (const comp of buildGrid(next)) {
    const wanting = comp.forges.filter((f) => wantsToRun(f));
    let demand = 0;
    for (const f of wanting) demand += MACHINES[f.defId].powerDraw ?? 0;

    let generated = 0;
    if (demand > 0) {
      for (const g of comp.generators) {
        if (feedBurner(g)) {
          g.burn = Math.max(0, g.burn - dt);
          if (g.burn > 0) generated += MACHINES[g.defId].powerGen ?? 0;
        }
      }
    }
    const enough = demand > 0 && generated >= demand;
    if (enough) for (const f of comp.forges) poweredIds.add(f.id);

    const anyFuel = comp.generators.some(
      (g) => g.burn > 0 || burnableIn(g.fuel) !== null
    );

    for (const g of comp.generators) {
      g.running = g.burn > 0;
      g.status =
        g.burn > 0
          ? `Generating ${MACHINES[g.defId].powerGen} W`
          : comp.forges.length === 0
            ? "Idle — no load"
            : anyFuel
              ? "Ready — load detected"
              : "No fuel";
    }
    for (const p of comp.posts) {
      p.running = enough;
      p.status = enough ? "Carrying current" : comp.generators.length === 0 ? "No generator on this run" : "No current";
    }
    if (!enough) {
      for (const f of comp.forges) {
        if (f.active) continue;
        f.running = false;
        f.status =
          comp.generators.length === 0
            ? "Not connected to a generator"
            : !anyFuel
              ? "Generator out of fuel"
              : "Overloaded — add a generator";
      }
    }
  }

  /* --- per-structure processing -------------------------------------- */
  for (const s of next) {
    const def = MACHINES[s.defId];

    if (s.defId === "generator" || s.defId === "wirePost") continue;

    if (s.defId === "manaReactor") {
      const cap = def.manaCapacity ?? 200;
      const recipe = def.recipes[0];
      if (s.mana >= cap) {
        s.status = `Fully charged — ${cap} mana`;
        s.running = false;
        s.progress = 0;
      } else if ((s.input.manaDust ?? 0) <= 0) {
        s.status = "Needs mana dust";
        s.running = false;
        s.progress = 0;
      } else {
        s.progress += dt;
        s.running = true;
        s.status = `Channelling — ${Math.floor(s.mana)}/${cap} mana`;
        if (s.progress >= recipe.duration) {
          s.progress = 0;
          s.input = takeFrom(s.input, recipe.input);
          s.mana = Math.min(cap, s.mana + (recipe.producesMana ?? 0));
        }
      }
      continue;
    }

    const recipe = selectedRecipe(s);
    if (!recipe) {
      s.status = "No recipe";
      s.running = false;
      continue;
    }

    if (s.active) {
      if (recipe.needs === "fuel") {
        if (s.burn <= 0 && !feedBurner(s)) {
          s.status = "No fuel";
          s.running = false;
          continue;
        }
        s.burn = Math.max(0, s.burn - dt);
      } else if (recipe.needs === "power") {
        if (!poweredIds.has(s.id)) {
          s.status = "Power lost — grid overloaded";
          s.running = false;
          continue;
        }
      }
      s.progress += dt;
      s.running = true;
      s.status = `Processing — ${Math.min(99, Math.floor((s.progress / recipe.duration) * 100))}%`;

      if (s.progress >= recipe.duration) {
        s.progress = 0;
        s.active = false;
        s.running = false;
        s.status = "Idle";
        for (const k of Object.keys(recipe.output) as ItemId[]) {
          s.output[k] = (s.output[k] ?? 0) + (recipe.output[k] ?? 0);
        }
        if (recipe.needs === "fire") s.charge = Math.max(0, s.charge - 1);
        if (recipe.output.ironIngot) {
          noteIngots(recipe.output.ironIngot);
          notePathUsed(recipe.needs);
        }
      }
      continue;
    }

    /* Not crafting yet — check every prerequisite, then commit. */
    if (!hasInput(s, recipe.input)) {
      s.status = "Waiting for ore";
      s.running = false;
      continue;
    }
    if (!outputFits(s, recipe.output)) {
      s.status = "Output full";
      s.running = false;
      continue;
    }
    if (recipe.needs === "fuel" && s.burn <= 0 && !feedBurner(s)) {
      s.status = s.defId === "emberCrucible" ? "Fire crystals exhausted" : "No fuel";
      s.running = false;
      continue;
    }
    if (recipe.needs === "power" && !poweredIds.has(s.id)) {
      s.running = false;
      continue; // status already written by the grid pass
    }
    if (recipe.needs === "magic") {
      const reactors = linkedReactors(s, next);
      const cost = recipe.consumesMana ?? 0;
      if (!reactors.length) {
        s.status = "No Mana Reactor in range";
        s.running = false;
        continue;
      }
      const total = reactors.reduce((a, r) => a + r.mana, 0);
      if (total < cost) {
        s.status = "Reactor out of mana";
        s.running = false;
        continue;
      }
      let left = cost;
      for (const r of reactors) {
        const take = Math.min(r.mana, left);
        r.mana -= take;
        left -= take;
        if (left <= 0) break;
      }
    }
    if (recipe.needs === "fire") {
      if (s.charge <= 0) {
        const crystal = s.fuel.fireCrystal ?? 0;
        if (crystal <= 0) {
          s.status = "Fire crystals exhausted";
          s.running = false;
          continue;
        }
        const leftCrystal = crystal - 1;
        const bag = { ...s.fuel };
        if (leftCrystal <= 0) delete bag.fireCrystal;
        else bag.fireCrystal = leftCrystal;
        s.fuel = bag;
        s.charge = 4;
      }
    }

    s.input = takeFrom(s.input, recipe.input);
    s.active = true;
    s.progress = 0;
    s.running = true;
    s.status = "Starting";
  }

  const changed = next.some((s, i) => {
    const o = state.structures[i];
    return (
      !o ||
      o.status !== s.status ||
      o.running !== s.running ||
      o.active !== s.active ||
      Math.floor(o.progress * 5) !== Math.floor(s.progress * 5) ||
      Math.floor(o.burn) !== Math.floor(s.burn) ||
      Math.floor(o.mana) !== Math.floor(s.mana) ||
      o.charge !== s.charge ||
      JSON.stringify(o.input) !== JSON.stringify(s.input) ||
      JSON.stringify(o.fuel) !== JSON.stringify(s.fuel) ||
      JSON.stringify(o.output) !== JSON.stringify(s.output)
    );
  });

  if (changed) useGame.setState({ structures: next });
}
