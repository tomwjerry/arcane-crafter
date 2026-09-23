import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { groundTint, terrainHeight, WORLD_SIZE } from "../game/terrain";

const RES = 128;

export function Terrain() {
  const geom = useMemo(() => {
    const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, RES - 1, RES - 1);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = terrainHeight(x, z);
      pos.setY(i, h);
      const [r, g, b] = groundTint(x, z, h);
      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, []);

  const trimesh = useMemo(() => {
    const pos = geom.attributes.position as THREE.BufferAttribute;
    const verts = new Float32Array(pos.array as Float32Array);
    const idx = geom.index;
    const indices = new Uint32Array(idx ? (idx.array as ArrayLike<number>) : []);
    return [verts, indices] as const;
  }, [geom]);

  return (
    <group>
      <mesh geometry={geom} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.97} metalness={0.02} />
      </mesh>
      <TrimeshColliderPair trimesh={trimesh} />
    </group>
  );
}

import { RigidBody, TrimeshCollider } from "@react-three/rapier";

function TrimeshColliderPair({ trimesh }: { trimesh: readonly [Float32Array, Uint32Array] }) {
  return (
    <RigidBody type="fixed" colliders={false}>
      <TrimeshCollider args={[trimesh[0], trimesh[1]]} />
    </RigidBody>
  );
}

/* ------------------------------------------------------------------ sky */

const skyVert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const skyFrag = /* glsl */ `
varying vec3 vDir;
uniform vec3 uHorizon;
uniform vec3 uZenith;
uniform vec3 uGround;
void main() {
  float h = vDir.y;
  vec3 upper = mix(uHorizon, uZenith, smoothstep(0.0, 0.55, h));
  vec3 lower = mix(uHorizon, uGround, smoothstep(0.0, -0.3, h));
  gl_FragColor = vec4(h >= 0.0 ? upper : lower, 1.0);
}
`;

export function SkyDome() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: skyVert,
        fragmentShader: skyFrag,
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          uHorizon: { value: new THREE.Color("#41304f") },
          uZenith: { value: new THREE.Color("#0a0810") },
          uGround: { value: new THREE.Color("#171119") },
        },
      }),
    []
  );
  return (
    <mesh scale={360} material={mat} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[1, 24, 16]} />
    </mesh>
  );
}

export function Lighting() {
  const sun = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    if (!sun.current) return;
    sun.current.target = target;
    target.position.set(
      runtimePlayer.x,
      0,
      runtimePlayer.z
    );
    target.updateMatrixWorld();
    sun.current.position.set(runtimePlayer.x + 48, 78, runtimePlayer.z + 40);
  });

  return (
    <>
      <primitive object={target} />
      <hemisphereLight args={["#9fb6ff", "#3d2c22", 0.5]} />
      <ambientLight intensity={0.25} color="#c9b8ff" />
      <directionalLight
        ref={sun}
        castShadow
        intensity={1.55}
        color="#ffd9b0"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
        shadow-camera-near={1}
        shadow-camera-far={260}
        shadow-bias={-0.0008}
        shadow-normalBias={0.03}
      />
    </>
  );
}

import { runtime } from "../game/store";
const runtimePlayer = runtime.player;

/* ------------------------------------------------------------- ambience */

export function EmberMotes() {
  const ref = useRef<THREE.Points>(null);
  const geom = useMemo(() => {
    const n = 520;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = (Math.random() - 0.5) * WORLD_SIZE * 0.92;
      arr[i * 3 + 1] = Math.random() * 38 + 2;
      arr[i * 3 + 2] = (Math.random() - 0.5) * WORLD_SIZE * 0.92;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    return g;
  }, []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = clock.elapsedTime * 0.01;
    ref.current.position.y = Math.sin(clock.elapsedTime * 0.25) * 1.6;
  });

  return (
    <points ref={ref} geometry={geom} frustumCulled={false}>
      <pointsMaterial
        size={0.5}
        color="#ffb27a"
        transparent
        opacity={0.66}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

/** Localised glow emitters placed over crystal/mana fields. */
export function RegionGlows() {
  const lights: { x: number; z: number; color: string }[] = useMemo(
    () => [
      { x: 58, z: 58, color: "#ff6a2b" },
      { x: 74, z: 46, color: "#ff8a3d" },
      { x: -60, z: 62, color: "#a98bff" },
      { x: -74, z: 48, color: "#7fb6ff" },
      { x: 62, z: -58, color: "#ffb066" },
    ],
    []
  );
  return (
    <>
      {lights.map((l, i) => (
        <pointLight
          key={i}
          position={[l.x, terrainHeight(l.x, l.z) + 5, l.z]}
          color={l.color}
          intensity={90}
          distance={52}
          decay={2}
        />
      ))}
    </>
  );
}
