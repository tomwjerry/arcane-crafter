import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGame } from "../game/store";
import { tickMachines } from "../game/machines";

export function Simulation() {
  const acc = useRef(0);

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.1);
    const st = useGame.getState();
    if (!st.started || st.panel !== "none") return;
    acc.current += dt;
    if (acc.current >= 0.2) {
      const step = acc.current;
      acc.current = 0;
      tickMachines(step);
    }
  });

  return null;
}
