import * as THREE from 'three';
import { clamp } from './utils.js';

const skinColors = ['#986d55', '#c58c68', '#e1b18a', '#704e43', '#a96b53'];
const clothes = ['#cc755b', '#417878', '#d2ae69', '#687e71', '#d6cbb0'];
const material = color => new THREE.MeshStandardMaterial({ color, roughness: 0.8 });

function makePedestrian(scene, x, z, index) {
  const person = new THREE.Group();
  person.position.set(x, 0.02, z);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.82, 3, 7), material(clothes[index % clothes.length]));
  body.position.y = 1.05;
  body.castShadow = true;
  person.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 9, 7), material(skinColors[index % skinColors.length]));
  head.position.y = 1.82;
  person.add(head);
  const shorts = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.26, 0.38), material(index % 2 ? '#53666a' : '#6a6552'));
  shorts.position.y = 0.56;
  person.add(shorts);
  scene.add(person);
  const angle = (index * 1.618) % (Math.PI * 2);
  const radius = 4 + (index % 4) * 1.15;
  const centerX = x + Math.cos(angle) * radius;
  const centerZ = z + Math.sin(angle) * radius;
  return { root: person, centerX, centerZ, phase: index * 1.73, speed: 0.45 + (index % 3) * 0.14, angle, orbit: 2.5 };
}

export function createPlayer(scene, camera, renderer) {
  const root = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.86, 4, 8), material('#df8c67'));
  body.position.y = 1.15;
  body.castShadow = true;
  root.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), material('#a56f55'));
  head.position.y = 2.0;
  root.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.31, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.58), material('#342e2b'));
  hair.position.set(0, 2.12, -0.025);
  root.add(hair);
  const jacket = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.64, 0.56), material('#275e60'));
  jacket.position.y = 1.22;
  jacket.castShadow = true;
  root.add(jacket);
  const limbs = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.72, 0.32), material('#34464c'));
    leg.position.set(side * 0.23, 0.4, 0);
    root.add(leg);
    limbs.push(leg);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.78, 0.29), material('#275e60'));
    arm.position.set(side * 0.58, 1.18, 0);
    root.add(arm);
  }
  scene.add(root);

  const pedestrians = [];
  for (const [x, z] of [[-108, 96], [-107, 104], [-91, 100], [-109, 119]]) {
    pedestrians.push(makePedestrian(scene, x, z, pedestrians.length));
  }
  for (const road of [-180, -120, -60, 0, 60, 120, 180]) for (const along of [-145, 35, 155]) {
    const spot = along + (pedestrians.length % 2 ? 2 : -2);
    const person = makePedestrian(scene, road + 9.7, spot, pedestrians.length);
    person.centerX = road + 9.7;
    person.centerZ = spot;
    person.orbit = 1.1;
    pedestrians.push(person);
  }
  const raycaster = new THREE.Raycaster();
  let lookYaw = 0;
  let lookPitch = -0.1;
  let dragging = false;
  let lastPointerX = 0;
  let lastPointerY = 0;
  renderer.domElement.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    dragging = true;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    renderer.domElement.setPointerCapture(event.pointerId);
  });
  renderer.domElement.addEventListener('pointermove', event => {
    if (!dragging) return;
    lookYaw -= (event.clientX - lastPointerX) * 0.004;
    lookPitch = clamp(lookPitch - (event.clientY - lastPointerY) * 0.003, -0.42, 0.22);
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
  });
  renderer.domElement.addEventListener('pointerup', () => { dragging = false; });
  renderer.domElement.addEventListener('contextmenu', event => event.preventDefault());

  const state = { root, position: root.position, car: null, yaw: 0, health: 100, money: 240, ammo: 12, onFoot: true, kills: 0, safeTime: 0 };
  return {
    state,
    pedestrians,
    update(dt, input, activeCar, time, driveCamera = true) {
      if (activeCar) {
        state.car = activeCar;
        state.onFoot = false;
        root.visible = false;
        state.position = activeCar.root.position;
        state.yaw = activeCar.yaw;
        camera.position.set(state.position.x - Math.sin(state.yaw) * 10, 5.3, state.position.z - Math.cos(state.yaw) * 10);
        camera.lookAt(state.position.x, 1.2, state.position.z);
      } else {
        state.car = null;
        state.onFoot = true;
        root.visible = true;
        const turn = input.axis('d', 'a');
        const movement = input.axis('w', 's');
        state.yaw = lookYaw;
        const forward = new THREE.Vector3(-Math.sin(lookYaw), 0, -Math.cos(lookYaw));
        const side = new THREE.Vector3(Math.cos(lookYaw), 0, -Math.sin(lookYaw));
        const direction = forward.multiplyScalar(movement).add(side.multiplyScalar(turn));
        if (direction.lengthSq() > 0) {
          direction.normalize();
          root.position.addScaledVector(direction, dt * (input.down('shift') ? 8 : 5.1));
          root.rotation.y = Math.atan2(direction.x, direction.z) + Math.PI;
        }
        root.position.x = clamp(root.position.x, -229, 229);
        root.position.z = clamp(root.position.z, -229, 229);
        state.position = root.position;
        // The camera is the caller's when driveCamera is false (the menu's slow orbit):
        // lerping it here as well would pin the backdrop to Mara's back.
        if (driveCamera) {
          const offsetYaw = lookYaw;
          const target = new THREE.Vector3(root.position.x + Math.sin(offsetYaw) * 0.7, 1.35, root.position.z + Math.cos(offsetYaw) * 0.7);
          const desired = new THREE.Vector3(root.position.x + Math.sin(offsetYaw) * 7.2, 4.0 - lookPitch * 3, root.position.z + Math.cos(offsetYaw) * 7.2);
          camera.position.lerp(desired, 1 - Math.exp(-dt * 6));
          camera.lookAt(target);
        }
      }
      for (const pedestrian of pedestrians) {
        pedestrian.phase += dt * pedestrian.speed;
        const x = pedestrian.centerX + Math.cos(pedestrian.phase) * pedestrian.orbit;
        const z = pedestrian.centerZ + Math.sin(pedestrian.phase * 0.8) * pedestrian.orbit;
        pedestrian.root.position.x = x;
        pedestrian.root.position.z = z;
        pedestrian.root.rotation.y = -pedestrian.phase;
        const near = Math.hypot(state.position.x - x, state.position.z - z) < 5;
        pedestrian.root.scale.setScalar(near && activeCar ? 0.82 : 1);
      }
      state.safeTime = Math.max(0, state.safeTime - dt);
      state.elapsed = time;
      return state;
    },
    nearestVehicle(cars) {
      let closest = null;
      let distance = 5.3;
      for (const car of cars) {
        if (!car.alive || !car.traffic || car === state.car) continue;
        const next = Math.hypot(state.position.x - car.root.position.x, state.position.z - car.root.position.z);
        if (next < distance) { closest = car; distance = next; }
      }
      return closest;
    },
    shoot(scene, direction = null) {
      if (state.ammo <= 0) return false;
      state.ammo -= 1;
      const origin = new THREE.Vector3(state.position.x, state.onFoot ? 1.5 : 1.1, state.position.z);
      if (!direction) {
        const aim = new THREE.Vector3();
        camera.getWorldDirection(aim);
        direction = aim;
      }
      raycaster.set(origin, direction.clone().normalize());
      // Downed pedestrians are out of the fight: raycasting their hidden bodies would farm kills.
      const targets = pedestrians.filter(person => person.root.visible).map(person => person.root.children[0]);
      const hit = raycaster.intersectObjects(targets, false)[0];
      let victim = null;
      if (hit) {
        victim = pedestrians.find(person => person.root.children[0] === hit.object);
        if (victim) { victim.root.visible = false; victim.root.userData.down = true; state.kills += 1; }
      }
      return { victim, origin, direction: direction.clone().normalize() };
    },
    punch() {
      let victim = null;
      let nearest = 2.5;
      for (const pedestrian of pedestrians) {
        if (!pedestrian.root.visible) continue;
        const next = Math.hypot(state.position.x - pedestrian.root.position.x, state.position.z - pedestrian.root.position.z);
        if (next < nearest) { victim = pedestrian; nearest = next; }
      }
      if (victim) { victim.root.visible = false; victim.root.userData.down = true; state.kills += 1; }
      return Boolean(victim);
    },
    setPosition(x, z, yaw = 0) { root.position.set(x, 0.04, z); state.yaw = yaw; lookYaw = yaw; },
    visiblePosition() { return state.position; },
    addPickup(amount) { state.money += amount; state.ammo = Math.min(36, state.ammo + 6); },
  };
}
