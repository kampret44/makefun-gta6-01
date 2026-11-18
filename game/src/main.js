import * as THREE from 'three';
import { createCity } from './city.js';
import { createTraffic, createCar, driveCar, updateTraffic } from './vehicles.js';
import { createPlayer } from './player.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { loadGame, saveGame } from './save.js';
import { createInput } from './input.js';
import { readShot, stageShot } from './shots.js';

const canvas = document.querySelector('#world');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.7));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 700);
// The menu's slow orbit starts here: without it the camera begins at the origin, inside
// Mara, and the 0.004 orbit lerp takes minutes to drift away from her.
camera.position.set(-4, 13, 25);
const { seed, shot } = readShot();
createCity(scene, seed);
const traffic = createTraffic(scene, seed, 31);
const starterCar = createCar(scene, -5, 3, -Math.PI / 2, '#e18161');
starterCar.traffic = true;
starterCar.cruise = 0;
starterCar.axis = 'x';
starterCar.road = 0;
starterCar.lane = -3;
starterCar.direction = 1;
starterCar.phase = 0;
traffic.push(starterCar);
const player = createPlayer(scene, camera, renderer);
const police = createPolice(scene, seed);
const missions = createMissions(scene);
const hud = createHud(player, missions, traffic, police);
const audio = createAudio();
const input = createInput();
const menu = document.querySelector('#menu');
const pausePanel = document.querySelector('#pause');
const bustedPanel = document.querySelector('#busted');
const startButton = document.querySelector('#newgame');
const continueButton = document.querySelector('#continue');
let gameState = shot ? 'playing' : 'menu';
let activeCar = null;
let nearestVehicle = null;
let clockTime = 0;
let previousFrame = performance.now();
let firedAt = 0;
let punchedAt = 0;
let saved = loadGame();
const sparks = [];
const bulletMaterial = new THREE.MeshBasicMaterial({ color: '#ffd17d' });
const pickupMaterial = new THREE.MeshStandardMaterial({ color: '#8cdeaa', emissive: '#286944', emissiveIntensity: 0.8 });
const pickups = [];

if (saved) {
  player.state.money = saved.money;
  player.state.health = saved.health;
  player.state.ammo = saved.ammo;
  missions.setScene(saved.mission);
  continueButton.classList.remove('hidden');
} else continueButton.classList.add('hidden');

function startGame(useSave = false) {
  // A retry must not inherit the previous run: drop stale pickups and tracer lines,
  // and start cold — no wanted level carried over from the run that ended.
  for (const item of pickups) scene.remove(item.mesh);
  pickups.length = 0;
  for (const effect of sparks) { scene.remove(effect.object); effect.object.geometry.dispose(); effect.object.material.dispose(); }
  sparks.length = 0;
  police.clear();
  audio.boot();
  audio.setActive(true);
  if (useSave && saved) {
    player.state.money = saved.money;
    player.state.health = saved.health;
    player.state.ammo = saved.ammo;
    player.state.kills = saved.kills ?? 0;
    missions.setScene(saved.mission);
    player.setPosition(-12, 2, -Math.PI / 2);
  } else {
    player.state.money = 240;
    player.state.health = 100;
    player.state.ammo = 12;
    player.state.kills = 0;
    missions.setScene(0);
    player.setPosition(-9, 4, -Math.PI / 2);
  }
  gameState = 'playing';
  menu.classList.add('hidden');
  pausePanel.classList.add('hidden');
  bustedPanel.classList.add('hidden');
  hud.showToast('Mara: same salt air. Different kind of trouble.');
  audio.ui();
}

startButton.addEventListener('click', () => startGame(false));
continueButton.addEventListener('click', () => startGame(true));
document.querySelector('#resume').addEventListener('click', () => { gameState = 'playing'; pausePanel.classList.add('hidden'); audio.setActive(true); });
document.querySelector('#save').addEventListener('click', () => { saveGame(player, missions); hud.showToast('Route saved on this device.'); });
document.querySelector('#retry').addEventListener('click', () => startGame(false));

const poolGeometry = new THREE.SphereGeometry(0.12, 7, 6);
function makePickup(position) {
  const pickup = new THREE.Mesh(poolGeometry, pickupMaterial);
  pickup.position.set(position.x, 0.75, position.z);
  scene.add(pickup);
  pickups.push({ mesh: pickup, life: 22 });
}

function shoot() {
  if (clockTime - firedAt < 0.29 || player.state.ammo <= 0) return;
  firedAt = clockTime;
  const shotResult = player.shoot(scene);
  if (shotResult === false) { hud.showToast('No rounds. Pick up supplies around the city.'); return; }
  audio.gunshot();
  police.addHeat(shotResult.victim ? 2 : 1);
  const geometry = new THREE.BufferGeometry().setFromPoints([shotResult.origin, shotResult.origin.clone().addScaledVector(shotResult.direction, 42)]);
  const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: '#ffe3a1', transparent: true, opacity: 0.8 }));
  scene.add(line);
  sparks.push({ object: line, life: 0.1 });
  if (shotResult.victim) makePickup(shotResult.victim.root.position);
}

function doPunch() {
  if (clockTime - punchedAt < 0.52) return;
  punchedAt = clockTime;
  audio.punch();
  if (player.punch()) { police.addHeat(1); hud.showToast('Harbor lookout down. Stay sharp.'); }
}

function useVehicle() {
  if (activeCar) {
    activeCar = null;
    player.setPosition(player.state.position.x + 2.2, player.state.position.z, player.state.yaw);
    hud.showToast('Back on foot. Keep moving.');
    return;
  }
  if (nearestVehicle) {
    activeCar = nearestVehicle;
    activeCar.stolen = true;
    if (activeCar.speed) police.addHeat(1);
    activeCar.traffic = false;
    activeCar.root.position.y = 0.04;
    player.state.money = Math.max(0, player.state.money - 18);
    hud.showToast('Vehicle borrowed. The harbor keeps count.');
    audio.ui();
  }
}

function spawnShot(sceneData) {
  const entryCar = createCar(scene, sceneData.player[0], sceneData.player[1], sceneData.player[2], '#e18161');
  entryCar.traffic = false;
  entryCar.speed = 8.2;
  traffic.push(entryCar);
  if (sceneData.car) activeCar = entryCar;
  else entryCar.root.position.x += 5;
  if (shot === 'chase') {
    for (let i = 0; i < 2; i += 1) {
      const cruiser = createCar(scene, sceneData.player[0] + 8 + i * 6, sceneData.player[1] + (i ? 3 : -3), -Math.PI / 2, '#e1e2d8', true);
      cruiser.police = true;
      cruiser.traffic = false;
      cruiser.speed = 12;
      cruiser.patrol = { ram: 0, officer: new THREE.Group() };
      scene.add(cruiser.patrol.officer);
      police.units.push(cruiser);
    }
  }
}

let shotState = null;
if (shot) {
  shotState = stageShot(shot, player, missions, police);
  if (shotState) {
    spawnShot(shotState);
    menu.classList.add('hidden');
    gameState = 'playing';
    if (shot === 'chase') {
      player.state.money = 1840;
      player.state.health = 74;
    } else if (shot === 'drive') player.state.money = 420;
    else if (shot === 'mission') player.state.money = 520;
    else if (shot === 'foot') player.state.money = 660;
  }
}

function update(dt) {
  clockTime += dt;
  const started = gameState === 'playing';
  const previousPosition = player.state.position;
  updateTraffic(traffic, dt, clockTime, previousPosition);
  if (!shot && input.take('enter') && gameState === 'menu') startGame(false);
  if (input.take('p') || input.take('escape')) {
    if (gameState === 'playing') { gameState = 'paused'; pausePanel.classList.remove('hidden'); audio.setActive(false); }
    else if (gameState === 'paused') { gameState = 'playing'; pausePanel.classList.add('hidden'); audio.setActive(true); }
  }
  if (gameState === 'paused') return;
  if (!started) {
    // In the menu the camera belongs to the slow orbit below: let player.update run the
    // pedestrians, but not its chase camera, or the two lerps fight and the backdrop
    // ends up a close-up of Mara instead of the city.
    if (!shot) player.update(dt, { axis: () => 0, down: () => false }, null, clockTime, false);
    const pos = player.state.position;
    const status = police.update(dt, pos, activeCar, traffic, delta => { player.state.health = Math.max(0, player.state.health + delta); });
    camera.position.lerp(new THREE.Vector3(-4 + Math.sin(clockTime * 0.05) * 8, 13, 18 + Math.cos(clockTime * 0.05) * 7), 0.004);
    camera.lookAt(0, 1, 0);
    hud.update(dt, clockTime, pos, missions, status, activeCar, null);
    return;
  }
  if (input.take('e')) useVehicle();
  if (gameState === 'playing') {
    if (input.take('f')) shoot();
    if (input.take(' ')) doPunch();
  }
  if (activeCar) {
    driveCar(activeCar, { forward: input.axis('w', 's'), brake: Number(input.down(' ')), steer: input.axis('d', 'a') }, dt, traffic);
    audio.engine(activeCar.speed);
  } else audio.engine(0);
  const state = player.update(dt, input, activeCar, clockTime);
  if (!activeCar) nearestVehicle = player.nearestVehicle(traffic);
  else nearestVehicle = null;
  const policeStatus = police.update(dt, state.position, activeCar, traffic, delta => { state.health = Math.max(0, state.health + delta); });
  if (policeStatus.wanted) audio.siren(policeStatus.wanted);
  const result = missions.update(dt, state.position, policeStatus.wanted, state.kills, Boolean(activeCar));
  if (result) {
    state.money = missions.state.money;
    audio.mission();
    hud.showToast(missions.state.prompt);
    saveGame(player, missions);
  }
  for (const item of pickups) {
    item.life -= dt;
    item.mesh.position.y = 0.75 + Math.sin(clockTime * 3) * 0.18;
    item.mesh.rotation.y += dt;
    if (Math.hypot(state.position.x - item.mesh.position.x, state.position.z - item.mesh.position.z) < 1.6) {
      player.addPickup(15);
      item.life = 0;
      hud.showToast('Supply found · +$15 · +6 rounds');
      audio.ui();
    }
  }
  // poolGeometry is shared by every pickup: disposing it when one expires would churn
  // the GPU buffers of the ones still alive, so only drop the mesh from the scene.
  for (const item of pickups) if (item.life <= 0) scene.remove(item.mesh);
  for (let i = pickups.length - 1; i >= 0; i -= 1) if (pickups[i].life <= 0) pickups.splice(i, 1);
  for (const effect of sparks) {
    effect.life -= dt;
    effect.object.material.opacity = Math.max(0, effect.life / 0.1);
  }
  for (const effect of sparks) if (effect.life <= 0) { scene.remove(effect.object); effect.object.geometry.dispose(); effect.object.material.dispose(); }
  for (let i = sparks.length - 1; i >= 0; i -= 1) if (sparks[i].life <= 0) sparks.splice(i, 1);
  hud.update(dt, clockTime, state.position, missions, policeStatus, activeCar, nearestVehicle);
  if (policeStatus.busted || state.health <= 0) {
    gameState = 'busted';
    bustedPanel.classList.remove('hidden');
    saveGame(player, missions);
    audio.setActive(false);
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.04, Math.max(0.001, (now - previousFrame) / 1000));
  previousFrame = now;
  if (gameState === 'playing' || gameState === 'menu' || gameState === 'paused' || shot) update(dt);
  renderer.render(scene, camera);
  input.endFrame();
  window.__gameFrame = (window.__gameFrame || 0) + 1;
  if (shot && window.__gameFrame >= 12) window.__shotReady = true;
}

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.7));
});
window.addEventListener('beforeunload', () => { if (activeCar) audio.engine(0); });

const initial = shotState ? player.state.position : null;
if (shotState && initial) {
  camera.position.set(initial.x - Math.sin(player.state.yaw) * (shot === 'foot' ? 7 : 12), shot === 'foot' ? 4.3 : 6, initial.z - Math.cos(player.state.yaw) * (shot === 'foot' ? 7 : 12));
  camera.lookAt(initial.x, 1, initial.z);
}
requestAnimationFrame(frame);
