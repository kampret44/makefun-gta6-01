import * as THREE from 'three';
import { distance } from './utils.js';

export const ROUTE = [
  { title: 'FIRST LIGHT', name: 'A city waiting for its next story.', detail: 'Take the little coral car and meet Niko by the seawall.', marker: [-112, 92], type: 'drive', radius: 19, reward: 80, story: 'Mara Vale comes home to Solvara with a courier bag and a promise to her old friend Niko.' },
  { title: 'A CLEAN EXIT', name: 'Get Inez out before the harbor clocks her.', detail: 'Steal a car and reach the ferry sheds. Patrols are watching.', marker: [123, -115], type: 'drive', radius: 16, reward: 140, story: 'Niko found a customs manifest that names the boats paid to disappear.' },
  { title: 'GLASS TIDE', name: 'Deliver the sealed ledger to Inez.', detail: 'Reach the old bathhouse before the signal window closes.', marker: [-177, -58], type: 'timer', radius: 15, time: 78, reward: 180, story: 'The manifest is not the ledger. Inez has the original, hidden in plain sight.' },
  { title: 'NO QUIET WATER', name: 'Clear the watch at the fish market.', detail: 'Three harbor guards stand between the crew and the next clue.', marker: [62, 151], type: 'combat', radius: 34, count: 3, reward: 260, story: 'The harbor men have followed the courier. Mara turns the market into cover.' },
  { title: 'LOW WATER', name: 'Take the ledger from the customs vault.', detail: 'Drive to the crane yard. Enter the gold ring to finish the route.', marker: [166, -133], type: 'heist', radius: 17, reward: 650, story: 'At low tide the customs wall opens. One ledger can undo an entire season of lies.' },
];

export function createMissions(scene) {
  const marker = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.16, 8, 36), new THREE.MeshBasicMaterial({ color: '#ffd37a' }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.35;
  marker.add(ring);
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 1.8, 7.5, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#f2ae65', transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
  beacon.position.y = 4.1;
  marker.add(beacon);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.4, 5), new THREE.MeshBasicMaterial({ color: '#fff0b3' }));
  arrow.position.y = 8.5;
  marker.add(arrow);
  scene.add(marker);
  const state = { index: 0, timer: null, objective: ROUTE[0].name, detail: ROUTE[0].detail, chapter: ROUTE[0].title, money: 240, prompt: ROUTE[0].story, active: false, complete: false, enemies: 0, killsBase: null };
  let bobPhase = 0;
  function stage(index) {
    const mission = ROUTE[index];
    state.index = index;
    state.chapter = `${String(index + 1).padStart(2, '0')} / ${mission.title}`;
    state.objective = mission.name;
    state.detail = mission.detail;
    state.timer = mission.time ?? null;
    state.enemies = mission.count ?? 0;
    state.killsBase = null;
    state.active = true;
    marker.position.set(mission.marker[0], 0.1, mission.marker[1]);
    marker.visible = true;
  }
  stage(0);
  return {
    state,
    marker,
    get current() { return ROUTE[state.index]; },
    update(dt, position, wanted, combatCount, driving) {
      if (!state.active) return false;
      marker.rotation.y += dt * 0.6;
      marker.children[0].rotation.z += dt * 1.2;
      // The gold arrow bobs so the marker reads as a live waypoint, not a static prop.
      bobPhase += dt;
      marker.children[2].position.y = 8.5 + Math.sin(bobPhase * 2.2) * 0.5;
      if (state.timer !== null) {
        state.timer -= dt;
        if (state.timer <= 0) {
          state.timer = ROUTE[state.index].time;
          state.prompt = 'The signal window narrowed. Inez sends another pin.';
        }
      }
      let ready = false;
      if (ROUTE[state.index].type === 'combat') {
        // Kills are a running total, so count only the ones made during this mission:
        // a lookout downed on an earlier mission must not discount this one.
        if (state.killsBase === null) state.killsBase = combatCount;
        state.enemies = Math.max(0, ROUTE[state.index].count - (combatCount - state.killsBase));
        ready = state.enemies === 0;
        state.detail = ready ? 'The market is quiet. Meet the crew at the marker.' : `${state.enemies} harbor lookout${state.enemies === 1 ? '' : 's'} remain.`;
      } else {
        const range = distance(position, { x: ROUTE[state.index].marker[0], z: ROUTE[state.index].marker[1] });
        ready = range < ROUTE[state.index].radius && (ROUTE[state.index].type !== 'drive' || driving || state.index === 0);
      }
      if (ready && (ROUTE[state.index].type !== 'combat' || distance(position, { x: ROUTE[state.index].marker[0], z: ROUTE[state.index].marker[1] }) < 120)) {
        state.money += ROUTE[state.index].reward;
        state.prompt = `${ROUTE[state.index].story}  +$${ROUTE[state.index].reward}`;
        if (state.index === ROUTE.length - 1) {
          state.objective = 'The books are open. Solvara remembers.';
          state.detail = 'Route complete. The coast is yours to roam.';
          state.active = false;
          state.complete = true;
          marker.visible = false;
          return 'finale';
        }
        stage(state.index + 1);
        return 'complete';
      }
      return false;
    },
    setScene(index) { stage(index); },
  };
}
