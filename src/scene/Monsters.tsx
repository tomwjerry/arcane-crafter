import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { runtime, useGame, pushToast } from "../game/store";
import { MONSTER_DEFS, MACHINES } from "../game/data";
import { terrainHeight, HALF } from "../game/terrain";
import { host } from "../game/host";

const BOUND = HALF - 12;

export function Monsters() {
  const groups = useRef<(THREE.Group | null)[]>([]);
  const sim = useRef(0);

  const monsters = useMemo(() => runtime.monsters, []);

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const st = useGame.getState();
    const paused = !st.started || st.panel !== "none";
    sim.current += dt;

    const p = runtime.player;
    const structures = useGame.getState().structures;

    for (let i = 0; i < monsters.length; i++) {
      const m = monsters[i];
      const group = groups.current[i];
      if (!group) continue;

      if (!m.alive) {
        group.visible = false;
        continue;
      }
      group.visible = true;

      if (!paused) stepMonster(m, dt, p, structures);

      group.position.set(m.x, m.y, m.z);
      group.rotation.y = m.yaw;
      const hurtScale = 1 + m.hurt * 0.18;
      group.scale.setScalar(hurtScale);

      const mat = findBodyMaterial(group);
      if (mat) {
        if (mat.userData.baseEmissive === undefined) {
          mat.userData.baseEmissive = mat.emissiveIntensity;
        }
        mat.emissiveIntensity =
          (mat.userData.baseEmissive as number) +
          m.hurt * 3 +
          (m.state === "chase" ? 0.5 : 0);
      }
    }
  });

  return (
    <>
      {monsters.map((m, i) => {
        const def = MONSTER_DEFS[m.typeId];
        return (
          <group
            key={m.id}
            ref={(el) => {
              groups.current[i] = el;
            }}
            position={[m.x, m.y, m.z]}
          >
            <MonsterBody typeId={m.typeId} def={def} />
          </group>
        );
      })}
    </>
  );
}

function MonsterBody({
  typeId,
  def,
}: {
  typeId: string;
  def: (typeof MONSTER_DEFS)[keyof typeof MONSTER_DEFS];
}) {
  const s = def.scale;
  if (typeId === "sentinel") {
    return (
      <group scale={s}>
        <mesh castShadow position={[0, 0.9, 0]}>
          <dodecahedronGeometry args={[0.75, 0]} />
          <meshStandardMaterial color={def.color} roughness={0.9} metalness={0.15} />
        </mesh>
        <mesh castShadow position={[0, 1.75, 0]}>
          <boxGeometry args={[0.7, 0.6, 0.7]} />
          <meshStandardMaterial color="#7d766c" roughness={0.85} />
        </mesh>
        <mesh position={[0, 1.8, 0.36]}>
          <boxGeometry args={[0.5, 0.12, 0.06]} />
          <meshStandardMaterial emissive="#ffcf6b" emissiveIntensity={3} color="#000" />
        </mesh>
        <mesh castShadow position={[-0.55, 1.1, 0]}>
          <boxGeometry args={[0.3, 1.1, 0.3]} />
          <meshStandardMaterial color="#6d675e" roughness={0.9} />
        </mesh>
        <mesh castShadow position={[0.55, 1.1, 0]}>
          <boxGeometry args={[0.3, 1.1, 0.3]} />
          <meshStandardMaterial color="#6d675e" roughness={0.9} />
        </mesh>
      </group>
    );
  }
  if (typeId === "hound") {
    return (
      <group scale={s}>
        <mesh castShadow position={[0, 0.62, 0]} rotation={[0, 0, 0]}>
          <capsuleGeometry args={[0.3, 0.75, 4, 10]} />
          <meshStandardMaterial
            color={def.color}
            emissive="#ff3d00"
            emissiveIntensity={0.7}
            roughness={0.55}
          />
        </mesh>
        <mesh castShadow position={[0, 0.8, 0.6]}>
          <coneGeometry args={[0.28, 0.6, 6]} />
          <meshStandardMaterial color="#ffb08a" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.9, 0.78]}>
          <sphereGeometry args={[0.07, 8, 8]} />
          <meshStandardMaterial emissive="#fff0a0" emissiveIntensity={4} color="#000" />
        </mesh>
        <mesh castShadow position={[-0.22, 0.24, -0.3]}>
          <boxGeometry args={[0.14, 0.5, 0.14]} />
          <meshStandardMaterial color="#c1440e" roughness={0.7} />
        </mesh>
        <mesh castShadow position={[0.22, 0.24, -0.3]}>
          <boxGeometry args={[0.14, 0.5, 0.14]} />
          <meshStandardMaterial color="#c1440e" roughness={0.7} />
        </mesh>
      </group>
    );
  }
  return (
    <group scale={s}>
      <mesh castShadow position={[0, 0.6, 0]}>
        <sphereGeometry args={[0.55, 14, 10]} />
        <meshStandardMaterial color={def.color} roughness={0.75} />
      </mesh>
      <mesh castShadow position={[0, 1.02, 0.3]}>
        <sphereGeometry args={[0.3, 12, 10]} />
        <meshStandardMaterial color="#5f8f45" roughness={0.7} />
      </mesh>
      <mesh position={[-0.13, 1.1, 0.55]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshStandardMaterial emissive="#ff5f5f" emissiveIntensity={4} color="#000" />
      </mesh>
      <mesh position={[0.13, 1.1, 0.55]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshStandardMaterial emissive="#ff5f5f" emissiveIntensity={4} color="#000" />
      </mesh>
      <mesh castShadow position={[-0.4, 0.2, 0]}>
        <boxGeometry args={[0.16, 0.42, 0.16]} />
        <meshStandardMaterial color="#4d7538" roughness={0.8} />
      </mesh>
      <mesh castShadow position={[0.4, 0.2, 0]}>
        <boxGeometry args={[0.16, 0.42, 0.16]} />
        <meshStandardMaterial color="#4d7538" roughness={0.8} />
      </mesh>
    </group>
  );
}

/** The first standard material of a monster body — used for hit flashes. */
function findBodyMaterial(group: THREE.Group): THREE.MeshStandardMaterial | undefined {
  const inner = group.children[0];
  if (!inner) return undefined;
  for (const child of inner.children) {
    const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (mat && mat.isMeshStandardMaterial) return mat;
  }
  return undefined;
}

type Monster = (typeof runtime.monsters)[number];

function stepMonster(
  m: Monster,
  dt: number,
  p: typeof runtime.player,
  structures: { x: number; z: number; defId: string }[]
) {
  const def = MONSTER_DEFS[m.typeId];
  m.attackCd = Math.max(0, m.attackCd - dt);
  if (m.hurt > 0) m.hurt = Math.max(0, m.hurt - dt * 3);
  m.think -= dt;

  const dxp = p.x - m.x;
  const dzp = p.z - m.z;
  const dPlayer = Math.hypot(dxp, dzp);
  const homeDist = Math.hypot(m.homeX - m.x, m.homeZ - m.z);

  if (m.hp <= def.hp * 0.22 && !def.guard) {
    m.state = "flee";
  } else if (dPlayer < def.aggro && p.invuln < 2.4) {
    m.state = "chase";
  } else if (m.state === "chase") {
    if (dPlayer > def.aggro * 1.7 || (def.guard && homeDist > def.leash)) {
      m.state = def.guard ? "return" : "patrol";
    }
  } else if (m.state === "return" && homeDist < 1.6) {
    m.state = "patrol";
  }

  if (m.state === "patrol" && m.think <= 0) {
    m.think = 2.5 + Math.random() * 3.5;
    const ang = Math.random() * Math.PI * 2;
    const rad = def.guard ? 3 : 6 + Math.random() * 10;
    m.targetX = m.homeX + Math.cos(ang) * rad;
    m.targetZ = m.homeZ + Math.sin(ang) * rad;
  }

  let tx = m.targetX;
  let tz = m.targetZ;
  let speed = def.speed * 0.55;

  if (m.state === "chase") {
    tx = p.x;
    tz = p.z;
    speed = def.speed;
  } else if (m.state === "flee") {
    tx = m.x - dxp;
    tz = m.z - dzp;
    speed = def.speed * 1.15;
  } else if (m.state === "return") {
    tx = m.homeX;
    tz = m.homeZ;
    speed = def.speed * 0.85;
  }

  const dx = tx - m.x;
  const dz = tz - m.z;
  const dist = Math.hypot(dx, dz);

  if (dist > 0.35 && !(m.state === "patrol" && dist < 1.2)) {
    let vx = (dx / dist) * speed * dt;
    let vz = (dz / dist) * speed * dt;

    // Nudge around placed machines instead of walking through them.
    for (const s of structures) {
      const r = MACHINES[s.defId]?.radius ?? 1;
      const ox = m.x - s.x;
      const oz = m.z - s.z;
      const od = Math.hypot(ox, oz);
      if (od < r + 0.9 && od > 0.001) {
        vx += (ox / od) * 0.055;
        vz += (oz / od) * 0.055;
      }
    }

    m.x = Math.max(-BOUND, Math.min(BOUND, m.x + vx));
    m.z = Math.max(-BOUND, Math.min(BOUND, m.z + vz));
    const want = Math.atan2(vx, vz);
    let d = want - m.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    m.yaw += d * Math.min(1, dt * 9);
  }

  m.y = terrainHeight(m.x, m.z);

  if (m.state === "chase" && dPlayer < 2.3 && m.attackCd <= 0) {
    m.attackCd = 1.15;
    host.damagePlayer(def.damage);
    pushToast(`${def.name} hits for ${def.damage}`, "bad");
  }
}

/* ----------------------------------------------------------- projectiles */

const POOL = 14;

export function Projectiles() {
  const refs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const list = runtime.projectiles;

    for (let i = list.length - 1; i >= 0; i--) {
      const pr = list[i];
      pr.life -= dt;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.z += pr.vz * dt;

      if (pr.y < terrainHeight(pr.x, pr.z) + 0.25) pr.life = 0;
      if (pr.life <= 0) {
        list.splice(i, 1);
        continue;
      }
      if (pr.friendly) {
        for (const m of runtime.monsters) {
          if (!m.alive) continue;
          if (Math.hypot(m.x - pr.x, m.z - pr.z) < 1.4 && Math.abs(m.y + 0.8 - pr.y) < 1.7) {
            m.hp -= 48;
            m.hurt = 1;
            m.state = "chase";
            pr.life = 0;
            if (m.hp <= 0) host.killMonster(m.id);
            break;
          }
        }
        if (pr.life <= 0) list.splice(i, 1);
      }
    }

    for (let i = 0; i < POOL; i++) {
      const mesh = refs.current[i];
      if (!mesh) continue;
      const pr = list[i];
      if (pr) {
        mesh.visible = true;
        mesh.position.set(pr.x, pr.y, pr.z);
        mesh.rotation.x += dt * 8;
        mesh.rotation.y += dt * 6;
      } else {
        mesh.visible = false;
      }
    }
  });

  return (
    <>
      {Array.from({ length: POOL }).map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          visible={false}
          castShadow
        >
          <icosahedronGeometry args={[0.3, 0]} />
          <meshStandardMaterial
            color="#bdf3ff"
            emissive="#57d7ff"
            emissiveIntensity={3.4}
            roughness={0.2}
          />
        </mesh>
      ))}
    </>
  );
}
