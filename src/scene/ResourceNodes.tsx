import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { runtime } from "../game/store";
import type { NodeTypeId } from "../game/types";

interface Layer {
  key: string;
  typeId: NodeTypeId;
  offset: [number, number, number];
  scaleOf: (nodeScale: number) => [number, number, number];
  geom: React.ReactNode;
  mat: React.ReactNode;
  shadow?: boolean;
}

const LAYERS: Layer[] = [
  {
    key: "tree-trunk",
    typeId: "tree",
    offset: [0, 1.4, 0],
    scaleOf: (s) => [0.7 * s, 1.5 * s, 0.7 * s],
    geom: <cylinderGeometry args={[0.16, 0.24, 2.4, 6]} />,
    mat: <meshStandardMaterial color="#5b432b" roughness={0.95} />,
    shadow: true,
  },
  {
    key: "tree-crown",
    typeId: "tree",
    offset: [0, 3.6, 0],
    scaleOf: (s) => [1.7 * s, 2.5 * s, 1.7 * s],
    geom: <coneGeometry args={[1, 2, 7]} />,
    mat: <meshStandardMaterial color="#3f7a3c" roughness={0.9} />,
    shadow: true,
  },
  {
    key: "rock",
    typeId: "rock",
    offset: [0, 0.35, 0],
    scaleOf: (s) => [1.5 * s, 1.1 * s, 1.5 * s],
    geom: <dodecahedronGeometry args={[0.7, 0]} />,
    mat: <meshStandardMaterial color="#86807a" roughness={1} flatShading />,
    shadow: true,
  },
  {
    key: "iron",
    typeId: "ironVein",
    offset: [0, 0.4, 0],
    scaleOf: (s) => [1.4 * s, 1.15 * s, 1.4 * s],
    geom: <dodecahedronGeometry args={[0.72, 0]} />,
    mat: (
      <meshStandardMaterial
        color="#8c7a68"
        metalness={0.55}
        roughness={0.55}
        emissive="#c08a52"
        emissiveIntensity={0.28}
        flatShading
      />
    ),
    shadow: true,
  },
  {
    key: "coal",
    typeId: "coalVein",
    offset: [0, 0.32, 0],
    scaleOf: (s) => [1.3 * s, 1.0 * s, 1.3 * s],
    geom: <dodecahedronGeometry args={[0.7, 0]} />,
    mat: <meshStandardMaterial color="#2f2f38" roughness={0.85} flatShading />,
    shadow: true,
  },
  {
    key: "fire",
    typeId: "fireCrystal",
    offset: [0, 1.1, 0],
    scaleOf: (s) => [1.0 * s, 2.1 * s, 1.0 * s],
    geom: <octahedronGeometry args={[0.62, 0]} />,
    mat: (
      <meshStandardMaterial
        color="#ff6a2b"
        emissive="#ff4d00"
        emissiveIntensity={2.6}
        roughness={0.25}
        metalness={0.1}
        flatShading
      />
    ),
    shadow: true,
  },
  {
    key: "mana",
    typeId: "manaShard",
    offset: [0, 1.0, 0],
    scaleOf: (s) => [0.95 * s, 2.0 * s, 0.95 * s],
    geom: <octahedronGeometry args={[0.58, 0]} />,
    mat: (
      <meshStandardMaterial
        color="#a98bff"
        emissive="#7f5cff"
        emissiveIntensity={2.4}
        roughness={0.2}
        metalness={0.1}
        flatShading
      />
    ),
    shadow: true,
  },
];

export function ResourceNodes() {
  const meshes = useRef(new Map<string, THREE.InstancedMesh>());
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const byType = useMemo(() => {
    const map = new Map<NodeTypeId, typeof runtime.nodes>();
    for (const n of runtime.nodes) {
      const list = map.get(n.typeId) ?? [];
      list.push(n);
      map.set(n.typeId, list);
    }
    return map;
  }, []);

  useFrame(({ clock }) => {
    const pulse = 0.55 + Math.sin(clock.elapsedTime * 1.6) * 0.35;
    for (const layer of LAYERS) {
      const mesh = meshes.current.get(layer.key);
      const list = byType.get(layer.typeId);
      if (!mesh || !list) continue;
      for (let i = 0; i < list.length; i++) {
        const n = list[i];
        const depleted = n.amount <= 0 || n.depletedAt !== null;
        const [sx, sy, sz] = layer.scaleOf(n.scale);
        dummy.position.set(n.x, n.y + layer.offset[1], n.z);
        dummy.rotation.set(0, n.rot, 0);
        if (depleted) dummy.scale.set(0.0001, 0.0001, 0.0001);
        else if (layer.key === "fire" || layer.key === "mana")
          dummy.scale.set(sx * pulse, sy * (1 + (pulse - 0.55) * 0.3), sz * pulse);
        else dummy.scale.set(sx, sy, sz);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      {LAYERS.map((layer) => {
        const list = byType.get(layer.typeId);
        if (!list || !list.length) return null;
        return (
          <instancedMesh
            key={layer.key}
            ref={(m) => {
              if (m) meshes.current.set(layer.key, m);
              else meshes.current.delete(layer.key);
            }}
            args={[undefined, undefined, list.length]}
            castShadow={layer.shadow !== false}
            receiveShadow
            frustumCulled={false}
          >
            {layer.geom}
            {layer.mat}
          </instancedMesh>
        );
      })}
    </>
  );
}
