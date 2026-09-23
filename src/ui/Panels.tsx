import type { MouseEvent } from "react";
import { useGame, runtime, PATH_LABEL } from "../game/store";
import {
  MACHINES,
  MACHINE_LIST,
  ITEMS,
  HAND_RECIPES,
  REGIONS,
  REGION_LIST,
  MONSTER_DEFS,
  NODE_DEFS,
} from "../game/data";
import { host, slotAccepts } from "../game/host";
import { closePanel, lockPointer } from "../game/input";
import { HALF, WORLD_SIZE } from "../game/terrain";
import type { ItemId, MachineDef, ProcessPath, RegionId, SlotId } from "../game/types";

/** Central switch — the HUD renders exactly one panel at a time. */
export function Panels() {
  const panel = useGame((s) => s.panel);
  if (panel === "build") return <BuildPanel />;
  if (panel === "inventory") return <InventoryPanel />;
  if (panel === "machine") return <MachinePanel />;
  if (panel === "map") return <MapPanel />;
  if (panel === "help") return <HelpPanel />;
  return null;
}

const backdrop = (e: MouseEvent) => {
  if (e.target === e.currentTarget) closePanel();
};

function Head({ title, eyebrow }: { title: string; eyebrow: string }) {
  return (
    <header className="panel-head">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      <button className="icon-btn" onClick={closePanel} title="Close (Esc)">
        ✕
      </button>
    </header>
  );
}

function pathLabel(path: MachineDef["path"]): string {
  return path === "infra" ? "Logistics" : PATH_LABEL[path as ProcessPath];
}

function CostRow({
  cost,
  inventory,
}: {
  cost: Partial<Record<ItemId, number>>;
  inventory: Partial<Record<ItemId, number>>;
}) {
  return (
    <div className="cost">
      {Object.entries(cost).map(([k, v]) => {
        const id = k as ItemId;
        const have = inventory[id] ?? 0;
        const ok = have >= (v as number);
        return (
          <span key={k} className={`cost-tag ${ok ? "ok" : "no"}`}>
            <i style={{ background: ITEMS[id].color }} />
            {have}/{v} {ITEMS[id].name}
          </span>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------- build menu */

function BuildPanel() {
  const inventory = useGame((s) => s.inventory);
  const buildChoice = useGame((s) => s.buildChoice);

  const startPlace = (id: (typeof MACHINE_LIST)[number]["id"]) => {
    useGame.setState({ buildChoice: id, panel: "none", selectedMachine: null });
    lockPointer();
  };

  return (
    <div className="overlay" onPointerDown={backdrop}>
      <div className="panel build-panel">
        <Head eyebrow="Construction · B" title="Build Menu" />
        <div className="build-grid">
          {MACHINE_LIST.map((def) => {
            const afford = host.canAfford(def.cost);
            return (
              <article key={def.id} className={`build-card ${buildChoice === def.id ? "sel" : ""}`}>
                <header>
                  <span className={`chip path ${def.path}`}>{pathLabel(def.path)}</span>
                  {def.powerGen ? (
                    <span className="chip">{def.powerGen} W out</span>
                  ) : def.powerDraw ? (
                    <span className="chip">{def.powerDraw} W draw</span>
                  ) : null}
                </header>
                <h3>{def.name}</h3>
                <p>{def.blurb}</p>
                <CostRow cost={def.cost} inventory={inventory} />
                <footer>
                  <button
                    className={`btn ${afford ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => startPlace(def.id)}
                  >
                    {afford ? "Place" : "Missing materials"}
                  </button>
                </footer>
              </article>
            );
          })}
        </div>
        <p className="panel-note">
          Picking a machine drops you into placement mode — <strong>left-click</strong> to build,{" "}
          <strong>right-click</strong> or <strong>Esc</strong> to cancel. The ghost turns red on
          steep ground, overlaps, or when you cannot pay.
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- inventory */

function InventoryPanel() {
  const inventory = useGame((s) => s.inventory);
  const progress = useGame((s) => s.progress);
  const deathCount = useGame((s) => s.deathCount);

  const owned = (Object.keys(ITEMS) as ItemId[]).filter((k) => (inventory[k] ?? 0) > 0);

  return (
    <div className="overlay" onPointerDown={backdrop}>
      <div className="panel inv-panel">
        <Head eyebrow={`Pack · I · ${owned.length} kinds`} title="Inventory" />

        {owned.length === 0 ? (
          <p className="panel-note">
            Empty pockets. Walk up to a tree, boulder or vein and hold <strong>E</strong>.
          </p>
        ) : (
          <div className="item-grid">
            {owned.map((k) => (
              <div key={k} className="item-card">
                <i style={{ background: ITEMS[k].color }} />
                <b>×{inventory[k]}</b>
                <span>{ITEMS[k].name}</span>
                <p>{ITEMS[k].desc}</p>
                {ITEMS[k].burn ? <em>Burns {ITEMS[k].burn}s as fuel</em> : null}
              </div>
            ))}
          </div>
        )}

        <h3 className="section-title">Hand crafts — no machine required</h3>
        <div className="craft-grid">
          {HAND_RECIPES.map((r) => {
            const can1 = Object.entries(r.input).every(
              ([k, v]) => (inventory[k as ItemId] ?? 0) >= (v as number)
            );
            return (
              <article key={r.id} className="craft-card">
                <h4>{r.name}</h4>
                <p>{r.note}</p>
                <CostRow cost={r.input} inventory={inventory} />
                <div className="craft-actions">
                  <button className="btn btn-ghost" disabled={!can1} onClick={() => void host.craft(r.id, 1)}>
                    Craft ×1
                  </button>
                  <button className="btn btn-ghost" disabled={!can1} onClick={() => void host.craft(r.id, 5)}>
                    ×5
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <div className="inv-meta">
          <span>Ingots refined <strong>{progress.ingotsProduced}</strong></span>
          <span>Paths online <strong>{progress.pathsUsed.length}/4</strong></span>
          <span>Structures <strong>{useGame.getState().structures.length}</strong></span>
          <span>Falls <strong>{deathCount}</strong></span>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- machine panel */

const SLOT_TITLE: Record<SlotId, string> = {
  input: "Input",
  fuel: "Fuel",
  output: "Output",
};

function Meter({ label, pct, tone }: { label: string; pct: number; tone: string }) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <div className={`meter ${tone}`}>
      <span>{label}</span>
      <div className="meter-track">
        <i style={{ width: `${w}%` }} />
      </div>
    </div>
  );
}

function MachinePanel() {
  const id = useGame((s) => s.selectedMachine);
  const inventory = useGame((s) => s.inventory);
  const structure = useGame((s) => s.structures.find((x) => x.id === s.selectedMachine));

  if (!id || !structure) return null;
  const def = MACHINES[structure.defId];
  const recipe =
    def.recipes.find((r) => r.id === structure.recipeId) ?? def.recipes[0] ?? null;
  const slots = def.slots;

  return (
    <div className="overlay" onPointerDown={backdrop}>
      <div className="panel machine-panel">
        <header className="panel-head">
          <div>
            <span className="eyebrow">
              {pathLabel(def.path)} · {def.name}
            </span>
            <h2>{structure.status}</h2>
          </div>
          <div className="head-right">
            <span className={`state ${structure.running ? "on" : ""}`}>
              {structure.running ? "RUNNING" : "IDLE"}
            </span>
            <button className="icon-btn" onClick={closePanel} title="Close (Esc)">
              ✕
            </button>
          </div>
        </header>

        {recipe && slots.includes("input") && (
          <Meter
            label={`${recipe.name} — ${Math.min(100, Math.floor((structure.progress / recipe.duration) * 100))}%`}
            pct={(structure.progress / recipe.duration) * 100}
            tone="work"
          />
        )}
        {slots.includes("fuel") && structure.burn > 0 && (
          <Meter label={`Burn — ${structure.burn.toFixed(0)}s left`} pct={(structure.burn / 50) * 100} tone="burn" />
        )}
        {def.manaCapacity !== undefined && (
          <Meter
            label={`Mana — ${Math.floor(structure.mana)} / ${def.manaCapacity}`}
            pct={(structure.mana / def.manaCapacity) * 100}
            tone="mana"
          />
        )}
        {def.linkRange !== undefined && (
          <p className="panel-note">
            Draws from any Mana Reactor within {def.linkRange} m — positioning matters.
          </p>
        )}
        {def.id === "generator" && (
          <p className="panel-note">
            Feeds every machine inside {def.connect} m through wire runs (or directly, if close
            enough).
          </p>
        )}
        {def.id === "emberCrucible" && structure.charge > 0 && (
          <p className="panel-note">Crystal charge: {structure.charge} runs remaining.</p>
        )}

        {def.recipes.length > 1 && (
          <div className="recipe-row">
            {def.recipes.map((r) => (
              <button
                key={r.id}
                className={`recipe-btn ${structure.recipeId === r.id ? "on" : ""}`}
                onClick={() => void host.setRecipe(structure.id, r.id)}
              >
                {r.name} · {r.duration}s
              </button>
            ))}
          </div>
        )}

        <div className="slots-grid">
          {slots.map((slot) => {
            const bag = structure[slot];
            const entries = Object.entries(bag) as [ItemId, number][];
            const depositable = (Object.keys(ITEMS) as ItemId[]).filter(
              (k) =>
                slot !== "output" &&
                slotAccepts(def, slot, k) &&
                (inventory[k] ?? 0) > 0
            );
            return (
              <section key={slot} className="slot-block">
                <h4>{SLOT_TITLE[slot]}</h4>

                {entries.length === 0 && depositable.length === 0 && (
                  <p className="slot-empty">
                    {slot === "output"
                      ? "Nothing yet."
                      : slot === "fuel"
                        ? "No fuel loaded."
                        : "Waiting for ore."}
                  </p>
                )}

                <div className="pill-group">
                  {entries.map(([k, n]) => (
                    <button
                      key={k}
                      className="pill"
                      title={slot === "output" ? "Take it" : "Move back to your pack"}
                      onClick={() =>
                        void host.withdraw(structure.id, slot, k, n)
                      }
                    >
                      <i style={{ background: ITEMS[k].color }} />
                      {ITEMS[k].name} ×{n}
                    </button>
                  ))}
                </div>

                {slot !== "output" && depositable.length > 0 && (
                  <div className="pill-group add-group">
                    <span className="group-label">From pack:</span>
                    {depositable.map((k) => (
                      <button
                        key={k}
                        className="pill add"
                        onClick={() => void host.deposit(structure.id, slot, k, inventory[k] ?? 0)}
                      >
                        <i style={{ background: ITEMS[k].color }} />
                        {ITEMS[k].name} +{inventory[k]}
                      </button>
                    ))}
                  </div>
                )}

                {slot === "output" && entries.length > 0 && (
                  <button
                    className="btn btn-primary take-all"
                    onClick={() => void host.collectAll(structure.id)}
                  >
                    Take all
                  </button>
                )}
              </section>
            );
          })}
        </div>

        <footer className="panel-foot">
          <span className="foot-hint">E re-opens this machine · Esc closes</span>
          <button
            className="btn danger"
            onClick={() => {
              void host.demolish(structure.id);
            }}
          >
            Dismantle (half refunded)
          </button>
        </footer>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- map */

/** Top-left → bottom-right reading order matches x<0/z<0 at the top-left. */
const QUAD_ORDER: RegionId[] = ["greenhollow", "ironscar", "aethermoor", "emberfall"];

function MapPanel() {
  const structures = useGame((s) => s.structures);
  const p = runtime.player;

  const toPct = (v: number) => ((v + HALF) / WORLD_SIZE) * 100;

  return (
    <div className="overlay" onPointerDown={backdrop}>
      <div className="panel map-panel">
        <Head eyebrow="Cartograph · M" title="The Four Regions" />

        <div className="map-frame">
          {QUAD_ORDER.map((id) => (
            <div key={id} className="map-quad" style={{ background: REGIONS[id].color }}>
              <strong>{REGIONS[id].name}</strong>
              <em>{REGIONS[id].tag}</em>
            </div>
          ))}

          {structures.map((s) => (
            <span
              key={s.id}
              className="map-dot struct"
              style={{ left: `${toPct(s.x)}%`, top: `${toPct(s.z)}%` }}
              title={MACHINES[s.defId].name}
            />
          ))}
          <span
            className="map-dot player"
            style={{ left: `${toPct(p.x)}%`, top: `${toPct(p.z)}%` }}
          >
            You
          </span>
        </div>

        <div className="map-legend">
          {REGION_LIST.map((id) => (
            <div key={id} className="legend-item">
              <span className="dot" style={{ background: REGIONS[id].color }} />
              <div>
                <strong>{REGIONS[id].name}</strong>
                <p>{REGIONS[id].blurb}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="panel-note">
          One continuous heightfield, blended across the centre — white dots are your structures,
          and premium nodes (fire crystal, mana shard) are guarded by sentinels.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- help */

const CONTROLS: [string, string][] = [
  ["WASD / Arrows", "Move"],
  ["Shift", "Sprint (drains stamina)"],
  ["Space", "Jump"],
  ["Mouse", "Look around"],
  ["LMB", "Melee strike"],
  ["RMB", "Fire a magic bolt (15 mana)"],
  ["E", "Harvest a node / open a machine"],
  ["B", "Build menu"],
  ["I", "Inventory & hand crafts"],
  ["M", "Region map"],
  ["H", "This help"],
  ["Esc", "Free the cursor / close panels"],
];

function HelpPanel() {
  return (
    <div className="overlay" onPointerDown={backdrop}>
      <div className="panel help-panel">
        <Head eyebrow="Field manual · H" title="How to Emberforge" />

        <div className="help-grid">
          <section>
            <h3 className="section-title">Controls</h3>
            <div className="ctrl-list">
              {CONTROLS.map(([key, what]) => (
                <div key={key} className="ctrl-row">
                  <kbd className="kbd">{key}</kbd>
                  <span>{what}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="section-title">Four ways to melt iron</h3>
            <div className="help-paths">
              {(Object.keys(PATH_LABEL) as ProcessPath[]).map((path) => {
                const machines = MACHINE_LIST.filter((m) => m.path === path);
                return (
                  <div key={path} className={`help-path ${path}`}>
                    <strong>{PATH_LABEL[path]}</strong>
                    <span>{machines.map((m) => m.name).join(" + ")}</span>
                  </div>
                );
              })}
            </div>
            <p className="panel-note">
              All four turn 1 Iron Ore into 1 Iron Ingot — with different speed, cost and failure
              modes. Forge the <strong>Ember Keystone</strong> (6 ingots, 4 mana dust, 2 fire
              crystals) to complete the expedition.
            </p>

            <h3 className="section-title">Bestiary</h3>
            <div className="bestiary">
              {(Object.keys(MONSTER_DEFS) as (keyof typeof MONSTER_DEFS)[]).map((k) => {
                const b = MONSTER_DEFS[k];
                return (
                  <div key={k} className="beast">
                    <i style={{ background: b.color }} />
                    <div>
                      <strong>{b.name}</strong>
                      <p>
                        {b.hp} HP · {b.damage} dmg · {b.guard ? "guards a resource node" : "roams and hunts"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="panel-note">
              Premium nodes —{" "}
              {Object.values(NODE_DEFS)
                .filter((n) => n.guarded)
                .map((n) => n.name)
                .join(", ")} — always have a sentinel standing over them. Kite it away, or kill
              it, then harvest in peace.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
