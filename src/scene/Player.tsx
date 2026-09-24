import { useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { RigidBody, CapsuleCollider, type RapierRigidBody } from "@react-three/rapier";
import { consume, keys, mouse, unlockPointer, lockPointer } from "../game/input";
import { runtime, useGame, pushToast } from "../game/store";
import { host, itemCount } from "../game/host";
import { terrainHeight, regionAt, terrainSlope, HALF } from "../game/terrain";
import { MACHINES, NODE_DEFS, isBuildable } from "../game/data";

const HALF_H = 0.5;
const RAD = 0.35;
const REST = HALF_H + RAD;
const WALK = 5.6;
const SPRINT = 9.2;
const JUMP = 8.2;

const FWD = new THREE.Vector3();
const ORIGIN = new THREE.Vector3();
const DIR = new THREE.Vector3();
const LOOK = new THREE.Vector3();

function raycastGround(o: THREE.Vector3, d: THREE.Vector3, maxDist = 70) {
  let t = 0.5;
  while (t < maxDist) {
    const x = o.x + d.x * t;
    const y = o.y + d.y * t;
    const z = o.z + d.z * t;
    if (y <= terrainHeight(x, z)) return { x, y: terrainHeight(x, z), z };
    t += 0.45;
  }
  return null;
}

export function Player() {
  const body = useRef<RapierRigidBody>(null);
  const weapon = useRef<THREE.Group>(null);
  const orb = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const prevLeft = useRef(false);
  const prevRight = useRef(false);
  const meleeCd = useRef(0);
  const boltCd = useRef(0);
  const publish = useRef(0);
  const regionRef = useRef("Greenhollow");
  const [facing, setFacing] = useState(0);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const g = useGame.getState();
    const p = runtime.player;
    const blocked = !g.started || g.panel !== "none" || g.buildChoice !== null;

    /* ------------------------------------------------------------ build */
    if (g.buildChoice && body.current) {
      const def = MACHINES[g.buildChoice];
      const cp = camera.position;
      camera.getWorldDirection(DIR);
      const hit = raycastGround(cp, DIR);
      let bx = p.x;
      let bz = p.z;
      if (hit && Math.hypot(hit.x - p.x, hit.z - p.z) < 26) {
        bx = hit.x;
        bz = hit.z;
      } else {
        bx = p.x - Math.sin(runtime.cam.yaw) * 6;
        bz = p.z - Math.cos(runtime.cam.yaw) * 6;
      }

      let reason = "";
      if (!isBuildable(bx, bz)) reason = "Ground too steep";
      else if (!host.canAfford(def.cost)) reason = "Not enough materials";
      else if (
        g.structures.some(
          (s) => Math.hypot(s.x - bx, s.z - bz) < MACHINES[s.defId].radius + def.radius + 0.5
        )
      )
        reason = "Too close to another structure";
      else if (
        runtime.nodes.some(
          (n) => n.amount > 0 && Math.hypot(n.x - bx, n.z - bz) < NODE_CLEARANCE + def.radius
        )
      )
        reason = "Blocked by a resource node";
      else if (
        runtime.monsters.some(
          (m) => m.alive && Math.hypot(m.x - bx, m.z - bz) < 2 + def.radius
        )
      )
        reason = "A monster is standing there";
      else if (terrainSlope(bx, bz) > 0.62) reason = "Ground too steep";

      runtime.buildGhost = { defId: g.buildChoice, x: bx, z: bz, valid: !reason, reason };

      if (mouse.left && !prevLeft.current) {
        if (!reason) {
          void host.placeStructure(g.buildChoice, bx, bz).then((res) => {
            if (!res.ok) pushToast(res.reason, "bad");
            else useGame.setState({ buildChoice: null });
          });
        } else {
          pushToast(reason, "warn");
        }
      }
      if (mouse.right && !prevRight.current) {
        useGame.setState({ buildChoice: null });
        runtime.buildGhost = null;
      }
    } else {
      runtime.buildGhost = null;
    }
    prevLeft.current = mouse.left;
    prevRight.current = mouse.right;

    /* ----------------------------------------------------------- movement */
    if (body.current) {
      const cam = runtime.cam;
      const sprinting =
        (keys.has("ShiftLeft") || keys.has("ShiftRight")) && runtime.vitals.stamina > 1;

      FWD.set(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw));
      const right = new THREE.Vector3(-FWD.z, 0, FWD.x);

      let mx = 0;
      let mz = 0;
      if (!blocked) {
        if (keys.has("KeyW") || keys.has("ArrowUp")) {
          mx += FWD.x;
          mz += FWD.z;
        }
        if (keys.has("KeyS") || keys.has("ArrowDown")) {
          mx -= FWD.x;
          mz -= FWD.z;
        }
        if (keys.has("KeyA") || keys.has("ArrowLeft")) {
          mx -= right.x;
          mz -= right.z;
        }
        if (keys.has("KeyD") || keys.has("ArrowRight")) {
          mx += right.x;
          mz += right.z;
        }
      }
      const len = Math.hypot(mx, mz);
      const moving = len > 0.001;
      const speed = sprinting && moving ? SPRINT : WALK;
      if (moving) {
        mx = (mx / len) * speed;
        mz = (mz / len) * speed;
      }

      const pos = body.current.translation();
      const groundY = terrainHeight(pos.x, pos.z);
      const grounded = pos.y <= groundY + REST + 0.14;
      p.grounded = grounded;

      const lv = body.current.linvel();
      let vy = lv.y;
      if (grounded && vy < 0) vy = 0;
      if (!blocked && consume("Space") && grounded) vy = JUMP;

      body.current.setLinvel({ x: mx, y: vy, z: mz }, true);

      const t = body.current.translation();
      p.x = t.x;
      p.y = t.y;
      p.z = t.z;

      /* stamina + mana */
      if (moving && sprinting) runtime.vitals.stamina = Math.max(0, runtime.vitals.stamina - 24 * dt);
      else runtime.vitals.stamina = Math.min(100, runtime.vitals.stamina + 17 * dt);
      runtime.vitals.mana = Math.min(100, runtime.vitals.mana + 4.5 * dt);
      if (runtime.player.invuln > 0) runtime.player.invuln -= dt;
      if (runtime.hitFlash > 0) runtime.hitFlash = Math.max(0, runtime.hitFlash - dt * 2.4);

      /* facing follows movement, otherwise the camera */
      if (moving) {
        const target = Math.atan2(mx, mz);
        let d = target - p.yaw;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        p.yaw += d * Math.min(1, dt * 14);
      } else if (!blocked) {
        p.yaw = cam.yaw + Math.PI;
      }
      setFacing((f) => (Math.abs(f - p.yaw) > 0.02 ? p.yaw : f));
    }

    /* ------------------------------------------------------------- combat */
    meleeCd.current = Math.max(0, meleeCd.current - dt);
    boltCd.current = Math.max(0, boltCd.current - dt);

    if (!blocked && mouse.left && !prevLeft.current && meleeCd.current <= 0) {
      meleeCd.current = 0.55;
      p.attackAnim = 1;
      swingAt();
    }
    if (!blocked && mouse.right && !prevRight.current && boltCd.current <= 0) {
      if (runtime.vitals.mana >= 15) {
        runtime.vitals.mana -= 15;
        boltCd.current = 1.25;
        p.boltAnim = 1;
        fireBolt(camera);
      } else {
        pushToast("Not enough mana", "warn");
        boltCd.current = 0.4;
      }
    }

    if (p.attackAnim > 0) p.attackAnim = Math.max(0, p.attackAnim - dt * 3.6);
    if (p.boltAnim > 0) p.boltAnim = Math.max(0, p.boltAnim - dt * 3.2);

    /* --------------------------------------------------------- interaction */
    updateNearest();
    if (!blocked && consume("KeyE") && runtime.nearestMachine) {
      useGame.setState({ panel: "machine", selectedMachine: runtime.nearestMachine });
      unlockPointer();
    }

    if (!blocked && keys.has("KeyE") && runtime.nearestNode && !runtime.nearestMachine) {
      const node = runtime.nodeIndex.get(runtime.nearestNode);
      if (node && node.amount > 0) {
        const def = NODE_DEFS[node.typeId];
        if (!runtime.harvest || runtime.harvest.nodeId !== node.id) {
          runtime.harvest = { nodeId: node.id, t: 0 };
        }
        runtime.harvest.t += dt;
        if (runtime.harvest.t >= def.harvestTime) {
          runtime.harvest.t = 0;
          host.completeHarvest(node.id);
        }
      }
    } else if (!keys.has("KeyE")) {
      runtime.harvest = null;
    }

    /* ------------------------------------------------------------ publish */
    publish.current += dt;
    if (publish.current > 0.1) {
      publish.current = 0;
      const region = regionAt(p.x, p.z);
      const name = REGION_NAMES[region];
      if (name !== regionRef.current) {
        regionRef.current = name;
        pushToast(`Entering ${name}`, "info");
      }
      useGame.setState({
        hp: Math.round(runtime.vitals.hp),
        mana: Math.round(runtime.vitals.mana),
        stamina: Math.round(runtime.vitals.stamina),
        region: name,
      });
      host.tickSave(performance.now());
    }
    host.tickNodes(Date.now());

    /* ------------------------------------------------------------ camera */
    const cam = runtime.cam;
    const dist = 8.2;
    const cp = Math.cos(cam.pitch);
    ORIGIN.set(
      p.x - Math.sin(cam.yaw) * dist * cp,
      p.y + 1.5 + Math.sin(cam.pitch) * dist,
      p.z - Math.cos(cam.yaw) * dist * cp
    );
    const minY = terrainHeight(ORIGIN.x, ORIGIN.z) + 0.9;
    if (ORIGIN.y < minY) ORIGIN.y = minY;
    camera.position.lerp(ORIGIN, 1 - Math.pow(0.0015, dt));
    LOOK.set(p.x, p.y + 1.35, p.z);
    camera.lookAt(LOOK);

    if (weapon.current) weapon.current.rotation.x = -p.attackAnim * 2.4;
    if (orb.current) orb.current.scale.setScalar(1 + p.boltAnim * 0.7);
  });

  return (
    <RigidBody
      ref={body}
      colliders={false}
      type="dynamic"
      position={[runtime.player.x, runtime.player.y, runtime.player.z]}
      lockRotations
      canSleep={false}
      linearDamping={0}
      angularDamping={0.6}
      ccd
      mass={1}
    >
      <CapsuleCollider args={[HALF_H, RAD]} friction={0} restitution={0} />
      <group rotation={[0, facing, 0]}>
        <group ref={weapon} position={[0.5, 1.05, 0.05]}>
          <mesh castShadow position={[0, -0.15, 0.3]} rotation={[0.5, 0, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 1.3, 6]} />
            <meshStandardMaterial color="#6b4a2c" roughness={0.8} />
          </mesh>
          <mesh ref={orb} castShadow position={[0, 0.5, 0.62]}>
            <icosahedronGeometry args={[0.17, 0]} />
            <meshStandardMaterial
              color="#8fe8ff"
              emissive="#4fd6ff"
              emissiveIntensity={2.4}
              roughness={0.3}
            />
          </mesh>
        </group>
        <mesh castShadow position={[0, 0.95, 0]}>
          <capsuleGeometry args={[0.3, 0.55, 4, 12]} />
          <meshStandardMaterial color="#3f4a6b" roughness={0.72} />
        </mesh>
        <mesh castShadow position={[0, 1.5, 0]}>
          <sphereGeometry args={[0.27, 16, 12]} />
          <meshStandardMaterial color="#e8c9a8" roughness={0.65} />
        </mesh>
        <mesh position={[0, 1.56, 0.24]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[0.44, 0.1, 0.16]} />
          <meshStandardMaterial color="#ffb27a" emissive="#ff7a3d" emissiveIntensity={1.6} />
        </mesh>
        <mesh castShadow position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.26, 0.32, 0.5, 10]} />
          <meshStandardMaterial color="#2b2f45" roughness={0.8} />
        </mesh>
      </group>
    </RigidBody>
  );
}

const REGION_NAMES: Record<string, string> = {
  greenhollow: "Greenhollow",
  ironscar: "Ironscar Basin",
  emberfall: "Emberfall Rift",
  aethermoor: "Aethermoor",
};

const NODE_CLEARANCE = 2.2;

/* ------------------------------------------------------------ targeting */

function facingDot(x: number, z: number): number {
  const p = runtime.player;
  const dx = x - p.x;
  const dz = z - p.z;
  const len = Math.hypot(dx, dz) || 1;
  const fx = -Math.sin(runtime.cam.yaw);
  const fz = -Math.cos(runtime.cam.yaw);
  return (dx / len) * fx + (dz / len) * fz;
}

function swingAt() {
  let hitAny = false;
  for (const m of runtime.monsters) {
    if (!m.alive) continue;
    const d = Math.hypot(m.x - runtime.player.x, m.z - runtime.player.z);
    if (d > 3.1) continue;
    if (facingDot(m.x, m.z) < 0.35) continue;
    m.hp -= 30;
    m.hurt = 1;
    m.state = "chase";
    hitAny = true;
    if (m.hp <= 0) host.killMonster(m.id);
  }
  if (!hitAny) return;
}

function fireBolt(camera: THREE.Camera) {
  camera.getWorldDirection(DIR);
  const p = runtime.player;
  runtime.projectiles.push({
    x: p.x,
    y: p.y + 1.2,
    z: p.z,
    vx: DIR.x * 34,
    vy: DIR.y * 34,
    vz: DIR.z * 34,
    life: 2.2,
    friendly: true,
  });
}

/* -------------------------------------------------------------- proximity */

function updateNearest() {
  const p = runtime.player;
  let bestNode: string | null = null;
  let bestNodeD = 3.4;
  for (const n of runtime.nodes) {
    if (n.amount <= 0 || n.depletedAt !== null) continue;
    const d = Math.hypot(n.x - p.x, n.z - p.z);
    if (d < bestNodeD) {
      bestNodeD = d;
      bestNode = n.id;
    }
  }
  runtime.nearestNode = bestNode;

  const g = useGame.getState();
  let bestMachine: string | null = null;
  let bestMachineD = 3.6;
  for (const s of g.structures) {
    if (s.defId === "wirePost") continue;
    const d = Math.hypot(s.x - p.x, s.z - p.z);
    if (d < bestMachineD) {
      bestMachineD = d;
      bestMachine = s.id;
    }
  }
  runtime.nearestMachine = bestMachine;
}

void lockPointer;
void itemCount;
void HALF;
