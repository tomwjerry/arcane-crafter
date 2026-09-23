import { useState } from "react";
import { useGame, runtime, OBJECTIVES, PATH_LABEL, pushToast } from "../game/store";
import { NODE_DEFS, MACHINES, REGIONS, ITEMS, REGION_LIST } from "../game/data";
import { regionAt } from "../game/terrain";
import { unlockPointer, lockPointer } from "../game/input";
import { host } from "../game/host";

export function Hud() {
  const hp = useGame((s) => s.hp);
  const maxHp = useGame((s) => s.maxHp);
  const mana = useGame((s) => s.mana);
  const maxMana = useGame((s) => s.maxMana);
  const stamina = useGame((s) => s.stamina);
  const region = useGame((s) => s.region);
  const inventory = useGame((s) => s.inventory);
  const progress = useGame((s) => s.progress);
  const toasts = useGame((s) => s.toasts);
  const panel = useGame((s) => s.panel);
  const locked = useGame((s) => s.pointerLocked);
  const log = useGame((s) => s.log);
  const [victoryDismissed, setVictoryDismissed] = useState(false);

  const objectiveIndex = OBJECTIVES.findIndex((o) => !o.done(useGame.getState()));
  const objectiveDone = objectiveIndex === -1;
  const objective = OBJECTIVES[objectiveDone ? OBJECTIVES.length - 1 : objectiveIndex];

  const node = runtime.nearestNode ? runtime.nodeIndex.get(runtime.nearestNode) : null;
  const machine = runtime.nearestMachine
    ? useGame.getState().structures.find((s) => s.id === runtime.nearestMachine)
    : null;
  const harvesting = runtime.harvest;
  const harvestDef = harvesting ? NODE_DEFS[runtime.nodeIndex.get(harvesting.nodeId)?.typeId ?? "tree"] : null;

  return (
    <div className="hud">
      {/* ------------------------------------------------------- vitals */}
      <div className="vitals">
        <Bar label="HP" value={hp} max={maxHp} tone="hp" />
        <Bar label="Mana" value={mana} max={maxMana} tone="mana" />
        <Bar label="Stamina" value={stamina} max={100} tone="stam" />
      </div>

      {/* --------------------------------------------------- crosshair */}
      {locked && panel === "none" && (
        <div className="crosshair">
          <span />
          <span />
        </div>
      )}

      {/* --------------------------------------------------- objective */}
      <div className="objective">
        <div className="objective-head">
          <span className="eyebrow">Objective {objectiveDone ? OBJECTIVES.length : objectiveIndex + 1} / {OBJECTIVES.length}</span>
          <span className="path-chips">
            {Object.keys(PATH_LABEL).map((k) => {
              const on = (progress.pathsUsed as string[]).includes(k);
              return (
                <span key={k} className={`chip ${on ? "on" : ""}`}>
                  {PATH_LABEL[k as keyof typeof PATH_LABEL]}
                </span>
              );
            })}
          </span>
        </div>
        <div className={`objective-text ${objectiveDone ? "done" : ""}`}>
          {objectiveDone ? "Expedition complete — every path mastered" : objective.text}
        </div>
        {!objectiveDone && <div className="objective-hint">{objective.hint}</div>}
        <div className="objective-meta">
          Ingots refined <strong>{progress.ingotsProduced}</strong> · Structures{" "}
          <strong>{useGame.getState().structures.length}</strong>
        </div>
      </div>

      {/* ------------------------------------------------------ region */}
      <div className="region-badge">
        <span className="dot" style={{ background: regionColor(region) }} />
        {region}
        <em>{REGIONS[regionAt(runtime.player.x, runtime.player.z)]?.tag}</em>
      </div>

      {/* ------------------------------------------------------ prompts */}
      {panel === "none" && (
        <div className="prompts">
          {harvestDef && (
            <div className="prompt">
              <span className="key">E</span> Gathering {harvestDef.name}
              <div className="mini-bar">
                <i
                  style={{
                    width: `${((harvesting?.t ?? 0) / harvestDef.harvestTime) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}
          {!harvestDef && node && (
            <div className="prompt">
              <span className="key">E</span> Harvest {NODE_DEFS[node.typeId].name} ·{" "}
              {Object.entries(NODE_DEFS[node.typeId].items)
                .map(([k, v]) => `${v} ${ITEMS[k as keyof typeof ITEMS].name}`)
                .join(", ")}
            </div>
          )}
          {!harvestDef && !node && machine && (
            <div className="prompt">
              <span className="key">E</span> Open {MACHINES[machine.defId].name}
              <span className="status">{machine.status}</span>
            </div>
          )}
          {!harvestDef && !node && !machine && (
            <div className="prompt dim">B build · I inventory · M map · H help</div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------- toasts */}
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.text}
          </div>
        ))}
      </div>

      {/* ------------------------------------------------------- hotbar */}
      <div className="hotbar">
        {(Object.keys(inventory) as (keyof typeof inventory)[])
          .filter((k) => (inventory[k] ?? 0) > 0)
          .slice(0, 10)
          .map((k) => (
            <div key={k as string} className="slot" title={ITEMS[k]?.name}>
              <i style={{ background: ITEMS[k]?.color }} />
              <span>{inventory[k]}</span>
              <small>{ITEMS[k]?.name}</small>
            </div>
          ))}
        {Object.keys(inventory).length === 0 && (
          <div className="slot empty">Empty pockets — go gather</div>
        )}
      </div>

      {/* ------------------------------------------------------ pointer */}
      {!locked && panel === "none" && (
        <button className="click-catch" onClick={() => lockPointer()}>
          <div className="click-inner">
            <strong>Click to resume</strong>
            <span>Mouse looks · LMB strikes · RMB fires a bolt · Esc releases the cursor</span>
          </div>
        </button>
      )}

      {/* ---------------------------------------------------------- log */}
      {log[0] && <div className="last-log">{log[0]}</div>}

      <QuitButton />

      {progress.won && !victoryDismissed && (
        <div className="victory">
          <div className="victory-card">
            <div className="victory-gem">◆</div>
            <span className="eyebrow">Expedition complete</span>
            <h2>The Ember Keystone is forged</h2>
            <p>
              {progress.pathsUsed.length} of the four refining paths brought online · {" "}
              {progress.ingotsProduced} ingots refined · {useGame.getState().deathCount} falls
              along the way. The workshop is yours — keep building.
            </p>
            <button className="btn btn-primary" onClick={() => setVictoryDismissed(true)}>
              Keep exploring
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Bar({
  label,
  value,
  max,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  tone: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={`bar ${tone}`}>
      <span className="bar-label">{label}</span>
      <div className="bar-track">
        <i style={{ width: `${pct}%` }} />
      </div>
      <span className="bar-num">{Math.round(value)}</span>
    </div>
  );
}

function regionColor(region: string) {
  const key = region.toLowerCase().includes("green")
    ? "greenhollow"
    : region.toLowerCase().includes("iron")
      ? "ironscar"
      : region.toLowerCase().includes("ember")
        ? "emberfall"
        : "aethermoor";
  return REGIONS[key].color;
}

function QuitButton() {
  return (
    <div className="corner-actions">
      <button
        onClick={() => {
          void host.save();
          pushToast("Game saved locally", "good");
        }}
      >
        Save
      </button>
      <button
        onClick={() => {
          if (confirm("Erase the local save and start a new expedition?")) void host.wipe();
        }}
      >
        New game
      </button>
      <button onClick={() => unlockPointer()}>Menu</button>
    </div>
  );
}

export const WORLD_REGION_LIST = REGION_LIST;
