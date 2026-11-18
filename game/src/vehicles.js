import * as THREE from 'three';
import { clamp, randomFrom, WORLD } from './utils.js';

const paints = ['#dd755b', '#e1b76e', '#457b7b', '#718b72', '#597c95', '#eee0bd', '#af6959', '#384d50'];
const mat = (color, roughness = 0.5, metalness = 0.05) => new THREE.MeshStandardMaterial({ color, roughness, metalness });

export function createCar(scene, x, z, yaw, color, police = false) {
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  root.rotation.y = yaw;
  const bodyMaterial = mat(color);
  const glass = mat(police ? '#9ebbc1' : '#8eafad', 0.25, 0.15);
  const dark = mat('#273a3d', 0.4);
  const tire = mat('#20282a', 0.95);
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.72, 4.15), bodyMaterial);
  body.position.y = 0.78;
  body.castShadow = true;
  body.receiveShadow = true;
  root.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.72, 2.15), glass);
  cabin.position.set(0, 1.38, -0.08);
  cabin.castShadow = true;
  root.add(cabin);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.13, 1.15), bodyMaterial);
  hood.position.set(0, 1.12, 1.2);
  root.add(hood);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.13, 1.25), bodyMaterial);
  roof.position.set(0, 1.78, -0.13);
  root.add(roof);
  for (const side of [-1, 1]) for (const end of [-1, 1]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.26, 10), tire);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 1.05, 0.42, end * 1.32);
    wheel.castShadow = true;
    root.add(wheel);
  }
  for (const side of [-1, 1]) {
    const headlight = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.24, 0.08), mat('#ffe8ad', 0.3, 0.1));
    headlight.position.set(side * 0.67, 0.88, 2.1);
    root.add(headlight);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.25, 0.08), mat('#e56b58', 0.3));
    tail.position.set(side * 0.67, 0.82, -2.1);
    root.add(tail);
  }
  if (police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.19, 0.3), mat('#263d49'));
    bar.position.set(0, 1.9, -0.14);
    root.add(bar);
    for (const side of [-1, 1]) {
      const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.24, 0.27), mat(side < 0 ? '#f15e62' : '#68b9dc', 0.25));
      beacon.position.set(side * 0.32, 2.08, -0.14);
      root.add(beacon);
      beacon.userData.beaconSide = side;
    }
  }
  scene.add(root);
  return { root, speed: 0, yaw, color, police, stolen: false, alive: true, sirenPhase: 0 };
}

export function createTraffic(scene, seed = 1, count = 23) {
  const random = randomFrom(seed);
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const axis = random() > 0.48 ? 'x' : 'z';
    const road = Math.floor(random() * 7 - 3) * 60;
    const lane = random() > 0.5 ? 3 : -3;
    const direction = random() > 0.5 ? 1 : -1;
    const progress = (random() - 0.5) * 450;
    const x = axis === 'x' ? progress : road + lane;
    const z = axis === 'z' ? progress : road - lane;
    const yaw = axis === 'x' ? (direction > 0 ? Math.PI / 2 : -Math.PI / 2) : (direction > 0 ? Math.PI : 0);
    const car = createCar(scene, x, z, yaw, paints[Math.floor(random() * paints.length)]);
    Object.assign(car, { axis, road, lane, direction, cruise: 8 + random() * 4, traffic: true, phase: random() * 12 });
    cars.push(car);
  }
  return cars;
}

export function updateTraffic(cars, dt, time, playerPosition) {
  for (const car of cars) {
    if (!car.traffic || !car.alive) continue;
    const personNear = Math.hypot(car.root.position.x - playerPosition.x, car.root.position.z - playerPosition.z) < 8;
    // A cruiser alongside holds traffic still for a beat; the flag is consumed here so the
    // car rolls again the moment no cruiser is near.
    const speed = car.hold ? 0 : (personNear ? car.cruise * 0.62 : car.cruise);
    car.hold = false;
    car.phase += dt;
    const move = speed * car.direction * dt;
    if (car.axis === 'x') {
      car.root.position.x = ((car.root.position.x + move + WORLD / 2 + 20) % (WORLD + 40)) - WORLD / 2 - 20;
      car.root.position.z = car.road - car.lane;
    } else {
      car.root.position.z = ((car.root.position.z + move + WORLD / 2 + 20) % (WORLD + 40)) - WORLD / 2 - 20;
      car.root.position.x = car.road + car.lane;
    }
    car.root.position.y = 0.035 + Math.sin(car.phase * 4) * 0.018;
  }
}

export function driveCar(car, controls, dt, nearbyCars) {
  if (!car) return;
  const acceleration = controls.forward * 18 - controls.brake * 24;
  car.speed = clamp(car.speed + acceleration * dt, -5, car.police ? 25 : 28);
  if (!controls.forward && !controls.brake) car.speed *= Math.pow(0.984, dt * 60);
  const steer = controls.steer * clamp(Math.abs(car.speed) / 10, 0.18, 1);
  car.yaw -= steer * dt * (car.speed < -0.2 ? -1 : 1) * 1.85;
  const movementX = Math.sin(car.yaw) * car.speed * dt;
  const movementZ = Math.cos(car.yaw) * car.speed * dt;
  const next = car.root.position.clone();
  next.x += movementX;
  next.z += movementZ;
  if (Math.abs(next.x) > WORLD / 2 - 6 || Math.abs(next.z) > WORLD / 2 - 6) car.speed *= -0.25;
  else {
    let hit = false;
    for (const other of nearbyCars) {
      if (other === car || !other.alive) continue;
      if (Math.hypot(next.x - other.root.position.x, next.z - other.root.position.z) < 3.2) {
        hit = true;
        other.speed = Math.max(other.speed ?? 0, Math.abs(car.speed) * 0.38);
        // Traffic cars ignore .speed in updateTraffic, so shove the bumped car visibly instead.
        const dx = other.root.position.x - next.x;
        const dz = other.root.position.z - next.z;
        const len = Math.hypot(dx, dz) || 1;
        other.root.position.x = clamp(other.root.position.x + (dx / len) * 0.9, -WORLD / 2 + 6, WORLD / 2 - 6);
        other.root.position.z = clamp(other.root.position.z + (dz / len) * 0.9, -WORLD / 2 + 6, WORLD / 2 - 6);
        break;
      }
    }
    if (!hit) car.root.position.set(next.x, 0.04, next.z);
    else car.speed *= -0.12;
  }
  car.root.rotation.y = car.yaw;
  car.stolen = true;
}
