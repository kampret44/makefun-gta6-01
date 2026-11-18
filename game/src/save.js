const KEY = 'solvara-salt-signal-save-v1';
export function loadGame() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!value || !Number.isInteger(value.mission)) return null;
    // A tampered or corrupt save must never break the HUD: validate every field defensively.
    const money = Number.isFinite(value.money) ? Math.min(999999, Math.max(0, value.money | 0)) : 0;
    const health = Number.isFinite(value.health) ? Math.min(100, Math.max(1, value.health | 0)) : 100;
    const ammo = Number.isFinite(value.ammo) ? Math.max(0, value.ammo | 0) : 0;
    // Kills are a running total the combat mission counts against, so they resume with the save.
    const kills = Number.isFinite(value.kills) ? Math.min(99, Math.max(0, value.kills | 0)) : 0;
    return { mission: Math.min(4, Math.max(0, value.mission)), money, health, ammo, kills };
  } catch { return null; }
}
export function saveGame(player, mission) {
  const state = player.state;
  try { localStorage.setItem(KEY, JSON.stringify({ mission: mission.state.index, money: state.money, health: state.health, ammo: state.ammo, kills: state.kills, savedAt: Date.now() })); return true; }
  catch { return false; }
}
