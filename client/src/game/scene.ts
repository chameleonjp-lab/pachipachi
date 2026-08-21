// ネオン神楽回路・パチンコ版: Babylonは筐体の光と空間、Reactは盤面と遊技情報を担当する。
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Engine } from "@babylonjs/core/Engines/engine";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Scene } from "@babylonjs/core/scene";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { GAME_ASSETS } from "./assets";
import { GameWorld } from "./GameWorld";
import type { GameState, Outcome } from "./types";

export interface GameHandle {
  scene: Scene;
  setEffectIntensity: (intensity: number) => void;
  setVolume: (volume: number) => void;
  setHandle: (active: boolean) => void;
  setHandlePower: (power: number) => void;
  setShotRoute: (route: "left" | "right") => void;
  actionPush: () => void;
  transferLowerTray: () => void;
  resetSession: () => void;
  dispose: () => void;
}

export async function createGameScene(engine: Engine, _canvas: HTMLCanvasElement, onStateChange: (state: GameState) => void): Promise<GameHandle> {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(.006, .01, .025, 1);
  scene.ambientColor = new Color3(.05, .12, .16);
  const camera = new FreeCamera("cabinet-camera", new Vector3(0, 0, -11.5), scene);
  camera.setTarget(Vector3.Zero()); camera.minZ = .1;
  const ambient = new HemisphericLight("ambient", new Vector3(0, 1, -.4), scene);
  ambient.intensity = 1.18; ambient.diffuse = Color3.FromHexString("#167b92"); ambient.groundColor = Color3.FromHexString("#03040a");

  const backdropMaterial = new StandardMaterial("stage-material", scene);
  backdropMaterial.diffuseTexture = new Texture(GAME_ASSETS.lacquerStage, scene);
  backdropMaterial.emissiveColor = Color3.FromHexString("#052633"); backdropMaterial.specularColor = Color3.FromHexString("#ffb52e").scale(.18);
  const backdrop = MeshBuilder.CreatePlane("festival-stage", { width: 18, height: 10.2 }, scene);
  backdrop.material = backdropMaterial; backdrop.position.z = .8;

  const frameMaterial = new StandardMaterial("frame-material", scene);
  frameMaterial.diffuseColor = Color3.FromHexString("#05070d"); frameMaterial.specularColor = Color3.FromHexString("#38efff").scale(.62);
  const topFrame = MeshBuilder.CreateBox("top-frame", { width: 17.5, height: .28, depth: .16 }, scene);
  topFrame.position = new Vector3(0, 4.93, .5); topFrame.material = frameMaterial;
  const bottomFrame = topFrame.clone("bottom-frame"); if (bottomFrame) bottomFrame.position.y = -4.93;

  const lamps: StandardMaterial[] = [];
  [-7.8, 7.8].forEach((x, side) => {
    for (let index = 0; index < 5; index += 1) {
      const lamp = MeshBuilder.CreateSphere(`lamp-${side}-${index}`, { diameter: .38, segments: 12 }, scene);
      lamp.position = new Vector3(x, 2.8 - index * 1.4, .35);
      const material = new StandardMaterial(`lamp-mat-${side}-${index}`, scene);
      material.diffuseColor = Color3.FromHexString("#05202b"); material.emissiveColor = Color3.FromHexString("#087f96"); material.specularColor = Color3.FromHexString("#d9ffff").scale(.26);
      lamp.material = material; lamps.push(material);
    }
  });

  let currentState: GameState | null = null;
  let effectIntensity = .8;
  const world = new GameWorld((state) => { currentState = state; onStateChange(state); });
  scene.onBeforeRenderObservable.add(() => {
    const time = performance.now() * .005;
    const hot = currentState?.phase === "reach" || currentState?.phase === "jackpot" || currentState?.phase === "attacker";
      const boost = (currentState?.feedback === "bonus" ? 1.5 : currentState?.feedback === "entry" ? .92 : currentState?.feedback === "pay" ? .78 : currentState?.feedback === "fire" ? .48 : .22) * effectIntensity;
      lamps.forEach((material, index) => {
      const pulse = .16 + Math.max(0, Math.sin(time * (hot ? 2.8 : 1.05) + index * 1.15)) * (hot ? 1.2 : .5) * effectIntensity + boost;
      material.emissiveColor = Color3.FromHexString(currentState?.phase === "jackpot" || currentState?.phase === "attacker" ? "#ffb52e" : currentState?.phase === "reach" ? "#ff315c" : "#38efff").scale(pulse);
    });
    backdropMaterial.emissiveColor = Color3.FromHexString(currentState?.phase === "jackpot" || currentState?.phase === "attacker" ? "#3a2104" : currentState?.phase === "reach" ? "#350513" : "#052633");
  });

  const parameters = new URLSearchParams(window.location.search);
  const preview = parameters.get("preview");
  const stage = parameters.get("stage");
  if (stage === "support") world.showSupportPreview();
  else if (stage === "relay-reach") world.showRelayPreview(false);
  else if (stage === "relay-revival") world.showRelayPreview(true);
  else if (stage === "nail-open") world.showNailPreview("open");
  else if (stage === "nail-pinch") world.showNailPreview("pinch");
  else if (stage === "attacker") world.showAttackerPreview();
  else if (preview === "miss" || preview === "win" || preview === "jackpot") world.showPreview(preview);
  else if (parameters.has("demo")) world.runDemo();
  return { scene, setEffectIntensity: (intensity) => { effectIntensity = Math.max(0, Math.min(100, intensity)) / 100; }, setVolume: (volume) => world.setVolume(volume), setHandle: (active) => world.setHandle(active), setHandlePower: (power) => world.setHandlePower(power), setShotRoute: (route) => world.setShotRoute(route), actionPush: () => world.actionPush(), transferLowerTray: () => world.transferLowerTray(), resetSession: () => world.resetSession(), dispose: () => world.dispose() };
}
