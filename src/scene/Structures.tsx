import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGame, runtime } from "../game/store";
import { MACHINES } from "../game/data";
import { terrainHeight } from "../game/terrain";
import type { StructureState } from "../game/types";

const UP = new THREE.Vector3(0, 1, 0);
const DIRV = new THREE.Vector3();

export function Structures() {
  const structures = useGame((s) => s.structures);
  const electric = useMemo(
    () => structures.filter((s) => MACHINES[s.defId].connect > 0),
    [structures]
  );

  return (
    <>
      {structures.map((s) => (
        <StructureMesh key={s.id} s={s} />
      ))}
      <WireGrid nodes={electric} />
      <Ghost />
    </>
  );
}

function StructureMesh({ s }: { s: StructureState }) {
  const def = MACHINES[s.defId];
  const y = terrainHeight(s.x, s.z);
  return (
    <group position={[s.x, y, s.z]} rotation={[0, s.rot, 0]}>
      <MachineBody s={s} />
      {def.id !== "runeCircle" && (
        <mesh position={[0, 0.03, 0]} receiveShadow>
          <cylinderGeometry args={[def.radius * 1.12, def.radius * 1.24, 0.12, 16]} />
          <meshStandardMaterial color="#3a3444" roughness={1} />
        </mesh>
      )}
    </group>
  );
}

function MachineBody({ s }: { s: StructureState }) {
  const glow = s.running ? 3.2 : 0.35;

  switch (s.defId) {
    case "forge":
      return (
        <group>
          <mesh castShadow position={[0, 0.7, 0]}>
            <boxGeometry args={[2.1, 1.4, 1.9]} />
            <meshStandardMaterial color="#6e655c" roughness={0.95} />
          </mesh>
          <mesh position={[0, 0.72, 0.97]}>
            <boxGeometry args={[0.9, 0.6, 0.1]} />
            <meshStandardMaterial
              color="#180a04"
              emissive="#ff6a1f"
              emissiveIntensity={glow}
            />
          </mesh>
          <mesh castShadow position={[0.6, 2.0, -0.5]}>
            <cylinderGeometry args={[0.26, 0.32, 1.6, 8]} />
            <meshStandardMaterial color="#4e4841" roughness={1} />
          </mesh>
          <mesh castShadow position={[-0.6, 1.72, 0]}>
            <coneGeometry args={[1.1, 0.5, 4]} />
            <meshStandardMaterial color="#5d554c" roughness={0.95} />
          </mesh>
        </group>
      );

    case "generator":
      return (
        <group>
          <mesh castShadow position={[0, 0.85, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.7, 0.7, 2.0, 14]} />
            <meshStandardMaterial color="#556074" metalness={0.55} roughness={0.45} />
          </mesh>
          <mesh castShadow position={[0, 1.7, 0]}>
            <boxGeometry args={[0.9, 0.7, 0.9]} />
            <meshStandardMaterial color="#3c465a" metalness={0.5} roughness={0.5} />
          </mesh>
          <mesh position={[0, 1.7, 0.47]}>
            <circleGeometry args={[0.28, 16]} />
            <meshStandardMaterial
              color="#0d1017"
              emissive={s.burn > 0 ? "#7dff9b" : "#2d3340"}
              emissiveIntensity={s.burn > 0 ? 3 : 0.4}
            />
          </mesh>
          <mesh castShadow position={[0.8, 0.35, 0]}>
            <boxGeometry args={[0.5, 0.7, 0.5]} />
            <meshStandardMaterial color="#31394a" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.85, 0.71]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.42, 0.07, 8, 20]} />
            <meshStandardMaterial
              color="#ffb35c"
              emissive="#ff7a1f"
              emissiveIntensity={s.burn > 0 ? 2.6 : 0.2}
            />
          </mesh>
        </group>
      );

    case "wirePost":
      return (
        <group>
          <mesh castShadow position={[0, 0.8, 0]}>
            <cylinderGeometry args={[0.07, 0.1, 1.6, 6]} />
            <meshStandardMaterial color="#7a6242" roughness={0.85} />
          </mesh>
          <mesh position={[0, 1.5, 0]}>
            <boxGeometry args={[0.7, 0.1, 0.1]} />
            <meshStandardMaterial
              color="#e0913f"
              metalness={0.7}
              roughness={0.35}
              emissive="#ff8a2b"
              emissiveIntensity={0.55}
            />
          </mesh>
        </group>
      );

    case "electricForge":
      return (
        <group>
          <mesh castShadow position={[0, 0.7, 0]}>
            <boxGeometry args={[2.0, 1.4, 1.8]} />
            <meshStandardMaterial color="#41506b" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.7, 0.92]}>
            <boxGeometry args={[1.1, 0.55, 0.08]} />
            <meshStandardMaterial
              color="#08131c"
              emissive="#4fe0ff"
              emissiveIntensity={glow}
            />
          </mesh>
          <mesh castShadow position={[0, 1.72, 0]} rotation={[0, 0, 0]}>
            <torusGeometry args={[0.45, 0.11, 8, 22]} />
            <meshStandardMaterial
              color="#8fd8ff"
              metalness={0.8}
              roughness={0.25}
              emissive="#37c6ff"
              emissiveIntensity={s.running ? 3 : 0.35}
            />
          </mesh>
          <mesh castShadow position={[0.75, 1.5, -0.5]}>
            <cylinderGeometry args={[0.1, 0.1, 1.0, 8]} />
            <meshStandardMaterial color="#9fb0c8" metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      );

    case "manaReactor":
      return (
        <group>
          <mesh castShadow position={[0, 1.1, 0]}>
            <coneGeometry args={[0.9, 2.4, 5]} />
            <meshStandardMaterial color="#4a3f7a" roughness={0.6} metalness={0.25} />
          </mesh>
          <mesh position={[0, 2.6, 0]}>
            <octahedronGeometry args={[0.42, 0]} />
            <meshStandardMaterial
              color="#c4a9ff"
              emissive="#8a5cff"
              emissiveIntensity={1.4 + (s.mana / 200) * 3}
              roughness={0.2}
            />
          </mesh>
          <mesh position={[0, 0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.75, 0.07, 8, 24]} />
            <meshStandardMaterial
              color="#a98bff"
              emissive="#7f5cff"
              emissiveIntensity={1.6}
            />
          </mesh>
        </group>
      );

    case "runeCircle":
      return (
        <group>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} receiveShadow>
            <ringGeometry args={[1.5, 2.0, 32]} />
            <meshStandardMaterial
              color="#3b3160"
              emissive="#8a5cff"
              emissiveIntensity={s.running ? 3.4 : 1.1}
              side={THREE.DoubleSide}
              roughness={0.7}
            />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]}>
            <ringGeometry args={[0.7, 0.85, 24]} />
            <meshStandardMaterial
              color="#5a49a8"
              emissive="#b18cff"
              emissiveIntensity={s.running ? 3 : 1.4}
              side={THREE.DoubleSide}
            />
          </mesh>
          {[0, 1, 2, 3, 4].map((i) => {
            const a = (i / 5) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(a) * 1.75, 0.14, Math.sin(a) * 1.75]}>
                <boxGeometry args={[0.2, 0.2, 0.2]} />
                <meshStandardMaterial
                  color="#d5c6ff"
                  emissive="#9d7bff"
                  emissiveIntensity={2.4}
                />
              </mesh>
            );
          })}
        </group>
      );

    case "emberCrucible":
      return (
        <group>
          <mesh castShadow position={[0, 0.55, 0]}>
            <cylinderGeometry args={[0.95, 0.6, 1.1, 12]} />
            <meshStandardMaterial color="#4c4148" roughness={0.9} />
          </mesh>
          <mesh position={[0, 1.12, 0]}>
            <cylinderGeometry args={[0.9, 0.9, 0.1, 16]} />
            <meshStandardMaterial
              color="#1a0803"
              emissive="#ff5a10"
              emissiveIntensity={glow + (s.charge > 0 ? 1.4 : 0)}
            />
          </mesh>
          <mesh castShadow position={[0, 1.6, 0]}>
            <octahedronGeometry args={[0.3, 0]} />
            <meshStandardMaterial
              color="#ff6a2b"
              emissive="#ff4d00"
              emissiveIntensity={2.8}
            />
          </mesh>
          <mesh position={[0, 0.5, 0.62]}>
            <circleGeometry args={[0.24, 16]} />
            <meshStandardMaterial
              color="#1a0803"
              emissive="#ff7a1f"
              emissiveIntensity={glow}
            />
          </mesh>
        </group>
      );
  }
  return null;
}

/* --------------------------------------------------------- electric grid */

function WireGrid({ nodes }: { nodes: StructureState[] }) {
  const edges = useMemo(() => {
    const out: { a: StructureState; b: StructureState; len: number }[] = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const reach = Math.max(MACHINES[a.defId].connect, MACHINES[b.defId].connect);
        if (reach > 0 && Math.hypot(a.x - b.x, a.z - b.z) <= reach) out.push({ a, b, len: 0 });
      }
    }
    return out;
  }, [nodes]);

  if (!edges.length) return null;

  return (
    <>
      {edges.map((e, i) => {
        const ay = terrainHeight(e.a.x, e.a.z) + 1.5;
        const by = terrainHeight(e.b.x, e.b.z) + 1.5;
        const dx = e.b.x - e.a.x;
        const dy = by - ay;
        const dz = e.b.z - e.a.z;
        const len = Math.hypot(dx, dy, dz);
        DIRV.set(dx, dy, dz).normalize();
        const quat = new THREE.Quaternion().setFromUnitVectors(UP, DIRV);
        return (
          <mesh
            key={i}
            position={[(e.a.x + e.b.x) / 2, (ay + by) / 2, (e.a.z + e.b.z) / 2]}
            quaternion={quat}
          >
            <cylinderGeometry args={[0.035, 0.035, len, 5]} />
            <meshStandardMaterial
              color="#e0913f"
              emissive="#ff9b3d"
              emissiveIntensity={1.5}
              metalness={0.6}
              roughness={0.35}
            />
          </mesh>
        );
      })}
    </>
  );
}

/* ---------------------------------------------------------------- ghost */

function Ghost() {
  const ref = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const ghost = runtime.buildGhost;
    const m = ref.current;
    const r = ring.current;
    if (!m || !r) return;
    if (!ghost) {
      m.visible = false;
      r.visible = false;
      return;
    }
    const def = MACHINES[ghost.defId];
    const y = terrainHeight(ghost.x, ghost.z);
    m.visible = true;
    r.visible = true;
    m.position.set(ghost.x, y + def.height / 2, ghost.z);
    m.scale.set(def.radius * 2, def.height, def.radius * 2);
    r.position.set(ghost.x, y + 0.09, ghost.z);
    const mat = m.material as THREE.MeshStandardMaterial;
    const rmat = r.material as THREE.MeshBasicMaterial;
    mat.color.set(ghost.valid ? "#7dff9b" : "#ff5f5f");
    mat.emissive.set(ghost.valid ? "#39d16a" : "#ff2f2f");
    mat.emissiveIntensity = 1.1;
    rmat.color.set(ghost.valid ? "#7dff9b" : "#ff5f5f");
  });

  return (
    <>
      <mesh ref={ref} visible={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial transparent opacity={0.42} roughness={0.4} />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[1.3, 1.55, 32]} />
        <meshBasicMaterial transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}
