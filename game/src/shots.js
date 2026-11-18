const KNOWN_SHOTS = ['start', 'drive', 'chase', 'mission', 'foot'];
export function readShot() {
  const params = new URLSearchParams(location.search);
  const shot = params.get('shot');
  const seed = Number.parseInt(params.get('seed') || '1', 10) || 1;
  // An unknown ?shot= must fall back to the menu, not a playing state with the menu overlay stuck up.
  return { shot: KNOWN_SHOTS.includes(shot) ? shot : null, seed };
}

export function stageShot(shot, player, missions, police) {
  const scenes = {
    start: { player: [-9, 4, -Math.PI / 2], mission: 0, wanted: 0, car: false },
    drive: { player: [-72, 3, -Math.PI / 2], mission: 0, wanted: 0, car: true },
    chase: { player: [20, 2, -Math.PI / 2], mission: 1, wanted: 3, car: true },
    mission: { player: [-177, -30, Math.PI], mission: 2, wanted: 1, car: true },
    foot: { player: [-112, 115, 0], mission: 0, wanted: 0, car: false },
  };
  const scene = scenes[shot];
  if (!scene) return null;
  player.setPosition(...scene.player);
  missions.setScene(scene.mission);
  // No objective override here: setScene already sets it from the route, and a second
  // hardcoded copy would drift the moment the route text changes.
  if (shot === 'chase') missions.state.detail = 'Break the harbor patrol line · evade pursuit';
  if (scene.wanted) for (let i = 0; i < scene.wanted; i += 1) police.addHeat(1);
  return scene;
}
