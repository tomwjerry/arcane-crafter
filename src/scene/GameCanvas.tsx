import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { Terrain, SkyDome, Lighting, EmberMotes, RegionGlows } from "./Terrain";
import { Player } from "./Player";
import { Monsters, Projectiles } from "./Monsters";
import { ResourceNodes } from "./ResourceNodes";
import { Structures } from "./Structures";
import { Simulation } from "./Simulation";

export function GameCanvas() {
  return (
    <Canvas
      shadows
      dpr={[1, 1.6]}
      camera={{ fov: 58, near: 0.2, far: 700, position: [-6, 8, -24] }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.setClearColor("#0a0810");
      }}
    >
      <fogExp2 attach="fog" args={["#2f2740", 0.0105]} />
      <SkyDome />
      <Lighting />
      <EmberMotes />
      <RegionGlows />

      <Suspense fallback={null}>
        <Physics gravity={[0, -19.6, 0]} timeStep={1 / 60}>
          <Terrain />
          <Player />
        </Physics>
      </Suspense>

      <Monsters />
      <Projectiles />
      <ResourceNodes />
      <Structures />
      <Simulation />
    </Canvas>
  );
}
