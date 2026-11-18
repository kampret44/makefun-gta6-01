import * as THREE from 'three';
import { WORLD, randomFrom } from './utils.js';

const roadLines = [-180, -120, -60, 0, 60, 120, 180];
const palette = ['#df9877', '#f0cf9a', '#95aaa0', '#c9775e', '#8199a0', '#e8b278', '#b4b8a2'];
const mat = (color, roughness = 0.9) => new THREE.MeshStandardMaterial({ color, roughness });

function box(scene, x, y, z, sx, sy, sz, material, cast = false) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  mesh.castShadow = cast;
  scene.add(mesh);
  return mesh;
}

function buildBuildings(scene, random) {
  const ground = mat('#d6bf91');
  const roof = mat('#ad7658');
  const windowMaterials = ['#326165', '#4c7974', '#e4b987'].map(color => mat(color, 0.4));
  for (let gx = -3; gx < 3; gx += 1) for (let gz = -3; gz < 3; gz += 1) {
    if ((gx === -2 && gz === 2) || (gx === 1 && gz === 1)) continue;
    const bx = gx * 60 + 30;
    const bz = gz * 60 + 30;
    const count = random() > 0.58 ? 2 : 1;
    for (let i = 0; i < count; i += 1) {
      const width = 18 + random() * 16;
      const depth = 18 + random() * 17;
      const height = 8 + random() * 28;
      const x = bx + (random() - 0.5) * Math.max(0, 34 - width);
      const z = bz + (random() - 0.5) * Math.max(0, 34 - depth);
      box(scene, x, height / 2, z, width, height, depth, mat(palette[Math.floor(random() * palette.length)]), true);
      box(scene, x, height + 0.25, z, width + 1, 0.5, depth + 1, roof);
      box(scene, x, height + 0.65, z, width * 0.42, 0.3, depth * 0.42, ground);
      const floors = Math.max(1, Math.floor(height / 5));
      for (let floor = 0; floor < floors; floor += 1) {
        const y = 1.7 + floor * 4.2;
        for (const side of [-1, 1]) {
          box(scene, x + side * width * 0.29, y, z + depth / 2 + 0.12, width * 0.19, 1.45, 0.18, windowMaterials[Math.floor(random() * windowMaterials.length)]);
          box(scene, x + width / 2 + 0.12, y, z + side * depth * 0.28, 0.18, 1.45, depth * 0.2, windowMaterials[Math.floor(random() * windowMaterials.length)]);
        }
      }
      box(scene, x, 0.8, z + depth / 2 + 0.15, 2.4, 1.6, 0.2, mat('#745d4b'));
    }
  }
}

function buildRoads(scene) {
  const street = mat('#53696a');
  const sidewalk = mat('#dfd1af');
  const lane = mat('#eed49c');
  for (const coord of roadLines) {
    box(scene, coord, -0.18, 0, 17, 0.34, WORLD, street);
    box(scene, 0, -0.17, coord, WORLD, 0.34, 17, street);
    for (let block = -240; block < 240; block += 60) {
      box(scene, coord - 9.7, 0.05, block + 30, 3.2, 0.55, 39, sidewalk);
      box(scene, coord + 9.7, 0.05, block + 30, 3.2, 0.55, 39, sidewalk);
      box(scene, block + 30, 0.05, coord - 9.7, 39, 0.55, 3.2, sidewalk);
      box(scene, block + 30, 0.05, coord + 9.7, 39, 0.55, 3.2, sidewalk);
    }
    for (let mark = -220; mark < 240; mark += 13) {
      box(scene, coord - 1, 0.006, mark, 0.2, 0.02, 5, lane);
      box(scene, mark, 0.006, coord - 1, 5, 0.02, 0.2, lane);
    }
  }
}

function buildCoast(scene, random) {
  const water = new THREE.Mesh(new THREE.PlaneGeometry(220, WORLD + 20), new THREE.MeshStandardMaterial({ color: '#57959a', roughness: 0.35, metalness: 0.12 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(-249, -0.25, 0);
  scene.add(water);
  const sand = mat('#dec39a');
  box(scene, -138, 0, 0, 16, 0.3, WORLD, sand);
  const palmTrunk = new THREE.CylinderGeometry(0.25, 0.45, 7, 6);
  const palmTop = mat('#875e47');
  const leaf = mat('#557b56');
  for (let z = -215; z < 220; z += 22) {
    const trunk = new THREE.Mesh(palmTrunk, palmTop);
    trunk.position.set(-128, 3.5, z);
    trunk.rotation.z = 0.12;
    trunk.castShadow = true;
    scene.add(trunk);
    for (let i = 0; i < 5; i += 1) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.75, 5.4, 5), leaf);
      const angle = i * Math.PI * 0.4;
      frond.position.set(-128 + Math.cos(angle) * 2.0, 6.8, z + Math.sin(angle) * 2.0);
      frond.rotation.z = Math.PI / 2 + Math.cos(angle) * 0.25;
      frond.rotation.x = Math.sin(angle) * 0.25;
      scene.add(frond);
    }
  }
  const buoy = mat('#f3b36d');
  for (let i = 0; i < 12; i += 1) box(scene, -192 - random() * 40, 0.6, -220 + random() * 440, 1.2, 1.2, 1.2, buoy);
}

function buildCivicLandmarks(scene) {
  const limestone = mat('#e9d7b1');
  const coral = mat('#d98469');
  const roof = mat('#c87858');
  box(scene, 90, 8, 90, 24, 16, 25, limestone, true);
  box(scene, 90, 17, 90, 26, 2, 27, roof);
  box(scene, 90, 26, 90, 3.2, 16, 3.2, coral, true);
  box(scene, 90, 34, 90, 5, 1.2, 5, limestone);
  for (let side = -1; side <= 1; side += 1) box(scene, 90 + side * 6.5, 4.2, 77, 1.5, 8, 1.5, coral);
  const crane = mat('#e7a364');
  // The crane yard stands clear of the -120 road's north sidewalk (z -131.3..-128.1)
  // and of the yard building's roof to its south: at z -132 the column's base sank
  // into the pavement, at z -136 it grazed that roof.
  box(scene, 154, 20, -134, 3, 40, 3, crane, true);
  box(scene, 165, 39, -134, 25, 2, 2, crane, true);
  box(scene, 174, 30, -134, 1, 18, 1, crane);
}

function buildStreetProps(scene) {
  const planter = mat('#c8875e');
  const green = mat('#547859');
  const lamp = mat('#415658');
  for (const road of roadLines) for (let along = -216; along <= 216; along += 36) {
    if (roadLines.some(cross => Math.abs(cross - along) < 14)) continue;
    box(scene, road + 12, 0.65, along, 2.3, 1.3, 2.3, planter);
    const foliage = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 0), green);
    foliage.position.set(road + 12, 2.2, along);
    foliage.castShadow = true;
    scene.add(foliage);
    box(scene, road - 12, 2.6, along + 8, 0.28, 5.2, 0.28, lamp);
    box(scene, road - 12, 5.2, along + 8, 1.3, 0.25, 0.7, mat('#f5d59b', 0.35));
  }
}

export function createCity(scene, seed = 1) {
  const random = randomFrom(seed);
  scene.background = new THREE.Color('#b9d9d4');
  scene.fog = new THREE.Fog('#b9d9d4', 135, 420);
  const hemi = new THREE.HemisphereLight('#fff0cf', '#657e72', 2.0);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffe0aa', 3.1);
  sun.position.set(-135, 190, -60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  sun.shadow.camera.left = -220;
  sun.shadow.camera.right = 220;
  sun.shadow.camera.top = 220;
  sun.shadow.camera.bottom = -220;
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  box(scene, 0, -0.52, 0, WORLD, 0.5, WORLD, mat('#90a38a'));
  buildCoast(scene, random);
  buildRoads(scene);
  buildBuildings(scene, random);
  buildCivicLandmarks(scene);
  buildStreetProps(scene);
}
