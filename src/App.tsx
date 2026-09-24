import { useEffect, useState } from "react";
import { useGame } from "./game/store";
import { host } from "./game/host";
import { installInput, lockPointer } from "./game/input";
import { GameCanvas } from "./scene/GameCanvas";
import { Hud } from "./ui/Hud";
import { Panels } from "./ui/Panels";

export default function App() {
  const ready = useGame((s) => s.ready);
  const started = useGame((s) => s.started);
  const [hasSave, setHasSave] = useState(false);

  useEffect(() => {
    const uninstall = installInput();
    void host.init();
    void host.hasSave().then(setHasSave);
    return uninstall;
  }, []);

  const begin = () => {
    useGame.setState({ started: true });
    lockPointer();
  };

  return (
    <div className="app">
      <div id="game-root">{ready && <GameCanvas />}</div>

      {ready && started && (
        <>
          <Hud />
          <Panels />
        </>
      )}

      {!ready && <BootScreen />}
      {ready && !started && <TitleScreen hasSave={hasSave} onBegin={begin} />}
    </div>
  );
}

function BootScreen() {
  return (
    <div className="boot-screen">
      <div className="boot-glyph">◆</div>
      <h1>EMBERFORGE</h1>
      <p>Kindling the wilds…</p>
    </div>
  );
}

function TitleScreen({ hasSave, onBegin }: { hasSave: boolean; onBegin: () => void }) {
  return (
    <div className="title-screen">
      <div className="title-card">
        <span className="title-eyebrow">
          Single-player · local save · no account · future-proof fake host
        </span>
        <h1 className="title-logo">
          EMBER<span>FORGE</span>
        </h1>
        <p className="title-sub">
          A 3D action-builder about stubborn ingenuity. Hunt monsters for resources, plan a
          workshop, and melt the same iron ore <strong>four different ways</strong> — because the
          best part of industry is arguing about which one is correct.
        </p>

        <div className="paths-row">
          <div className="path-mini fuel">
            <h4>Fuel Forge</h4>
            <p>Wood and coal. Slow, cheap, never asks for wiring.</p>
          </div>
          <div className="path-mini power">
            <h4>Electric Arc</h4>
            <p>Generator → wire → Arc-Forge. Fastest, but the grid must hold.</p>
          </div>
          <div className="path-mini magic">
            <h4>Rune Circle</h4>
            <p>Reactor feeds the circle. No fuel, pure positioning puzzle.</p>
          </div>
          <div className="path-mini fire">
            <h4>Ember Crucible</h4>
            <p>Burns fire crystals outright. Blistering and scarce.</p>
          </div>
        </div>

        <div className="title-controls">
          <span><kbd className="kc">WASD</kbd> move</span>
          <span><kbd className="kc">Shift</kbd> sprint</span>
          <span><kbd className="kc">Space</kbd> jump</span>
          <span><kbd className="kc">Mouse</kbd> look</span>
          <span><kbd className="kc">LMB</kbd> strike</span>
          <span><kbd className="kc">RMB</kbd> magic bolt</span>
          <span><kbd className="kc">E</kbd> harvest / open</span>
          <span><kbd className="kc">B</kbd> build</span>
          <span><kbd className="kc">I</kbd> inventory</span>
          <span><kbd className="kc">M</kbd> map</span>
          <span><kbd className="kc">H</kbd> help</span>
          <span><kbd className="kc">Esc</kbd> free cursor</span>
        </div>

        <button className="btn btn-primary" onClick={onBegin}>
          {hasSave ? "Continue Expedition" : "Begin Expedition"}
        </button>
        <p className="title-foot">
          Progress autosaves in this browser — clearing site data starts a new world.
        </p>
      </div>
    </div>
  );
}
