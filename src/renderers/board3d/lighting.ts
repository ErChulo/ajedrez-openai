// Lighting setup for the 3D board.
// Uses Three.js RoomEnvironment for IBL reflections + three-point lighting.

import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

export function setupLighting(scene: THREE.Scene, renderer: THREE.WebGLRenderer): void {
  const pmrem = new THREE.PMREMGenerator(renderer)
  pmrem.compileEquirectangularShader()
  const envScene = new RoomEnvironment()
  const envTex = pmrem.fromScene(envScene, 0.055).texture
  scene.environment = envTex
  scene.background = null
  envScene.dispose?.()
  pmrem.dispose()

  const key = new THREE.DirectionalLight(0xfff1d4, 2.8)
  key.position.set(4.8, 11.5, 3.8)
  key.castShadow = true
  key.shadow.mapSize.set(4096, 4096)
  key.shadow.camera.near = 0.5
  key.shadow.camera.far = 40
  key.shadow.camera.left = -2.3
  key.shadow.camera.right = 2.3
  key.shadow.camera.top = 2.3
  key.shadow.camera.bottom = -2.3
  key.shadow.radius = 8
  key.shadow.blurSamples = 8
  key.shadow.bias = -0.00008
  key.shadow.normalBias = 0.02
  scene.add(key)

  const fill = new THREE.DirectionalLight(0xd7e6ff, 0.7)
  fill.position.set(-7.2, 6.8, -5.8)
  scene.add(fill)

  const rim = new THREE.DirectionalLight(0xffddb5, 1.15)
  rim.position.set(-1.2, 7.4, -12.5)
  scene.add(rim)

  const kicker = new THREE.SpotLight(0xfff5ea, 0.65, 20, Math.PI / 5.5, 0.4, 1.4)
  kicker.position.set(0, 7.5, 6.4)
  kicker.target.position.set(0, 0, 0)
  scene.add(kicker)
  scene.add(kicker.target)

  const bounce = new THREE.DirectionalLight(0xffe3c8, 0.24)
  bounce.position.set(0, -3, 0)
  scene.add(bounce)

  scene.add(new THREE.HemisphereLight(0xfff7e4, 0x24140b, 0.42))
  scene.add(new THREE.AmbientLight(0xffffff, 0.08))
}

export function setupRenderer(renderer: THREE.WebGLRenderer): void {
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.02
  renderer.outputColorSpace = THREE.SRGBColorSpace
}
