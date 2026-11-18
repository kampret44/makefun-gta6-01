import * as THREE from 'three';
import { createCar } from './vehicles.js';
import { clamp, randomFrom } from './utils.js';

export function createPolice(scene, seed = 1) {
  const random = randomFrom(seed + 191);
  const units = [];
  let wanted = 0;
  let calm = 0;
  let cooldown = 0;
  let busting = 0;
  function spawn(position) {
    const roads = [-180, -120, -60, 0, 60, 120, 180];
    const axisX = random() > 0.5;
    const coord = axisX ? position.x : position.z;
    let road = roads[0];
    for (const line of roads) if (Math.abs(line - coord) < Math.abs(road - coord)) road = line;
    const along = (random() > 0.5 ? 1 : -1) * (42 + random() * 18);
    const lane = random() > 0.5 ? 3 : -3;
    const x = axisX ? road + lane : clamp(position.x + along, -228, 228);
    const z = axisX ? clamp(position.z + along, -228, 228) : road + lane;
    const yaw = Math.atan2(position.x - x, position.z - z);
    const car = createCar(scene, x, z, yaw, '#dfe3d8', true);
    car.traffic = false;
    car.police = true;
    car.speed = 10;
    car.patrol = { ram: 0, officer: null };
    const officer = new THREE.Group();
    const coat = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.72, 3, 7), new THREE.MeshStandardMaterial({ color: '#283d4e' }));
    coat.position.y = 1.13;
    coat.castShadow = true;
    officer.add(coat);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), new THREE.MeshStandardMaterial({ color: '#b68163' }));
    head.position.y = 1.9;
    officer.add(head);
    officer.position.set(x + 2.3, 0.03, z);
    scene.add(officer);
    car.patrol.officer = officer;
    units.push(car);
  }
  function addHeat(amount = 1) { wanted = clamp(wanted + amount, 0, 5); calm = 0; }
  function update(dt, position, playerCar, traffic, getHealth) {
    if (wanted > 0) {
      const existing = units.filter(unit => unit.alive).length;
      if (existing < Math.min(1 + wanted, 4) && cooldown <= 0) {
        spawn(position);
        cooldown = 2.2;
      }
      cooldown -= dt;
    } else {
      calm += dt;
      if (calm > 5) {
        // Despawned units must leave the scene graph, not linger invisible in it.
        for (const unit of units) if (unit.alive) { unit.alive = false; unit.root.visible = false; unit.patrol.officer.visible = false; scene.remove(unit.root); scene.remove(unit.patrol.officer); }
        units.length = 0;
      }
    }
    let near = false;
    let bustPressure = 0;
    for (const unit of units) {
      if (!unit.alive) continue;
      const dx = position.x - unit.root.position.x;
      const dz = position.z - unit.root.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 74) near = true;
      const targetYaw = Math.atan2(dx, dz);
      let delta = ((targetYaw - unit.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      unit.yaw += clamp(delta, -dt * 1.1, dt * 1.1);
      const chaseSpeed = playerCar ? 18 + wanted * 0.7 : 12.2;
      unit.speed = clamp(unit.speed + dt * 5, 8, chaseSpeed);
      unit.root.position.x += Math.sin(unit.yaw) * unit.speed * dt;
      unit.root.position.z += Math.cos(unit.yaw) * unit.speed * dt;
      unit.root.rotation.y = unit.yaw;
      unit.sirenPhase += dt * 12;
      for (const child of unit.root.children) if (child.userData.beaconSide) child.material.color.setHSL(child.userData.beaconSide < 0 ? (Math.sin(unit.sirenPhase) > 0 ? 0.99 : 0.53) : (Math.sin(unit.sirenPhase) > 0 ? 0.53 : 0.99), 0.8, 0.62);
      unit.patrol.officer.position.set(unit.root.position.x + Math.cos(unit.yaw) * 2.3, 0.03, unit.root.position.z - Math.sin(unit.yaw) * 2.3);
      unit.patrol.officer.rotation.y = targetYaw;
      if (distance < 4.5) {
        if (playerCar) {
          unit.patrol.ram += dt;
          if (unit.patrol.ram > 1.1) {
            playerCar.speed *= 0.52;
            getHealth(-dt * 2.3);
            unit.patrol.ram = 0;
          }
        } else bustPressure += dt;
      } else unit.patrol.ram = 0;
      for (const civilian of traffic) {
        if (!civilian.alive || !civilian.traffic) continue;
        // Traffic cars ignore .speed in updateTraffic, so a cruiser cannot slow one by
        // writing it: flag the hold and let updateTraffic honour it instead.
        if (Math.hypot(civilian.root.position.x - unit.root.position.x, civilian.root.position.z - unit.root.position.z) < 3.8) civilian.hold = true;
      }
    }
    if (!playerCar && bustPressure) busting += bustPressure;
    else busting = Math.max(0, busting - dt * 1.8);
    if (wanted > 0 && !near) {
      calm += dt;
      if (calm > 9 + wanted * 4) { wanted -= 1; calm = 0; }
    } else if (near) calm = 0;
    return { wanted, units, busted: busting > 4.2, busting: clamp(busting / 4.2, 0, 1) };
  }
  return { update, addHeat, state: () => wanted, units, clear() { wanted = 0; calm = 20; } };
}
