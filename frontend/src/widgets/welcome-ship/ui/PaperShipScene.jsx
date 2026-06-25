import React, { Suspense, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Environment, ContactShadows, Float, Html } from '@react-three/drei';

function SceneLoader() {
  return (
    <Html center>
      <div className="scene-loader">
        <div className="scene-loader-ship" />
        <div className="scene-loader-wave" />
      </div>
    </Html>
  );
}

function Ship() {
  const { scene } = useGLTF('/scene.gltf');

  const copiedScene = useMemo(() => {
    const cloned = scene.clone();
    const paperMaterial = new THREE.MeshStandardMaterial({
      color: '#ef4444',
      roughness: 0.9,
      metalness: 0.05,
      flatShading: true,
    });

    cloned.traverse((child) => {
      if (!child.isMesh) return;

      child.material = paperMaterial;
      child.castShadow = true;
      child.receiveShadow = true;

      if (child.name === 'Object_5' || child.name === 'Object_7') {
        child.scale.set(1.005, 1.005, 1.005);
        child.castShadow = false;
        child.receiveShadow = false;
      }
    });

    return cloned;
  }, [scene]);

  return (
    <group scale={0.75} position={[0, 0, 0]}>
      <primitive object={copiedScene} />
    </group>
  );
}

function Island() {
  const { scene } = useGLTF('/pirate_island/scene.gltf');

  const copiedScene = useMemo(() => {
    const cloned = scene.clone();

    cloned.traverse((child) => {
      if (!child.isMesh) return;

      if (child.name.includes('Crate')) {
        child.visible = false;
        return;
      }

      if (/Barrel(?! 2)/.test(child.name)) {
        child.visible = false;
        return;
      }

      child.castShadow = true;
      child.receiveShadow = true;

      if (child.name.includes('Base_Standardmaterial')) {
        child.scale.x *= 1.05;
        child.scale.y *= 0.9;
      } else {
        child.position.x += 18;
        child.position.y -= 8;
      }
    });

    return cloned;
  }, [scene]);

  return (
    <primitive
      object={copiedScene}
      scale={0.052}
      position={[0, 0, 0]}
      rotation={[0, -0.35, 0]}
    />
  );
}

function RotatingScene() {
  const groupRef = useRef(null);
  const dragState = useRef(null);
  const waterCenter = [-0.85, -1.08, -1.05];

  useFrame((_, delta) => {
    if (!groupRef.current || dragState.current) return;
    groupRef.current.rotation.y += delta * 0.04;
  });

  const handlePointerDown = (event) => {
    event.stopPropagation();
    event.target.setPointerCapture?.(event.pointerId);
    dragState.current = {
      x: event.clientX,
      rotationY: groupRef.current?.rotation.y || 0,
    };
  };

  const handlePointerMove = (event) => {
    if (!dragState.current || !groupRef.current) return;

    event.stopPropagation();
    groupRef.current.rotation.y = dragState.current.rotationY
      + (event.clientX - dragState.current.x) * 0.01;
  };

  const handlePointerUp = (event) => {
    event.stopPropagation();
    event.target.releasePointerCapture?.(event.pointerId);
    dragState.current = null;
  };

  return (
    <group
      ref={groupRef}
      position={waterCenter}
      rotation={[0, -0.42, 0]}
      scale={1}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <Island />

      <Float
        speed={2}
        rotationIntensity={0}
        floatIntensity={0.5}
        floatingRange={[-0.1, 0.1]}
      >
        <group position={[-4.25, 0.16, -0.5]}>
          <Ship />
        </group>
      </Float>
    </group>
  );
}

export default function PaperShipScene() {
  return (
    <div className="ship-scene-wrap">
      <Canvas
        camera={{ position: [-10.14, 3.67, -11.16], fov: 52 }}
        shadows
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[10, 10, 5]}
          intensity={1.5}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />

        <Suspense fallback={<SceneLoader />}>
          <RotatingScene />
          <ContactShadows
            position={[0, -0.75, 0]}
            opacity={0.32}
            scale={12}
            blur={3}
            far={4}
            color="#000000"
          />
          <Environment preset="city" />
        </Suspense>
      </Canvas>
    </div>
  );
}

useGLTF.preload('/scene.gltf');
useGLTF.preload('/pirate_island/scene.gltf');
