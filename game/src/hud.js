import { WORLD, clamp } from './utils.js';

export function createHud(player, missions, traffic, police) {
  const health = document.querySelector('#health');
  const money = document.querySelector('#money');
  const clock = document.querySelector('#clock');
  const wanted = document.querySelector('#wanted');
  const chapter = document.querySelector('#chapter');
  const objective = document.querySelector('#objective');
  const subobjective = document.querySelector('#subobjective');
  const map = document.querySelector('#minimap');
  const context = map.getContext('2d');
  const interaction = document.querySelector('#interaction');
  const toast = document.querySelector('#toast');
  let lastToast = 0;
  let lastStars = -1;
  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    lastToast = 2.5;
  }
  function drawMap(position, mission, policeState) {
    const w = map.width;
    const h = map.height;
    const scale = w / WORLD;
    context.fillStyle = '#19383b';
    context.fillRect(0, 0, w, h);
    // The shore is at world x -146 (the sand strip -146..-130), not at the -180 causeway:
    // the sea runs to 0.196 of the map, the sand to 0.229.
    context.fillStyle = '#51888a';
    context.fillRect(0, 0, w * 0.196, h);
    context.fillStyle = '#d6c6a4';
    context.fillRect(w * 0.196, 0, w * 0.033, h);
    context.fillStyle = '#344d4f';
    for (let road = -180; road <= 180; road += 60) {
      const px = (road + WORLD / 2) * scale;
      context.fillRect(px - 1.7, 0, 3.4, h);
      // East-west roads run the whole map as causeways over the water to the west edge.
      context.fillRect(0, px - 1.7, w, 3.4);
    }
    context.fillStyle = '#c2916d';
    for (let x = 36; x < w; x += 24) for (let y = 9; y < h; y += 24) {
      if (x < w * 0.18) continue;
      context.fillRect(x, y, 11, 11);
    }
    const goal = missions.marker.position;
    if (missions.marker.visible) {
      const gx = (goal.x + WORLD / 2) * scale;
      const gy = (goal.z + WORLD / 2) * scale;
      context.beginPath();
      context.fillStyle = '#ffd175';
      context.arc(gx, gy, 4, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#fff0bb';
      context.lineWidth = 1.1;
      context.beginPath();
      context.arc(gx, gy, 7, 0, Math.PI * 2);
      context.stroke();
    }
    for (const car of traffic) {
      if (!car.alive) continue;
      const x = (car.root.position.x + WORLD / 2) * scale;
      const y = (car.root.position.z + WORLD / 2) * scale;
      context.fillStyle = car.police ? '#ef766a' : '#a8cdc1';
      context.fillRect(x - 1, y - 1, 2, 2);
    }
    for (const unit of policeState.units) {
      if (!unit.alive) continue;
      const x = (unit.root.position.x + WORLD / 2) * scale;
      const y = (unit.root.position.z + WORLD / 2) * scale;
      context.fillStyle = '#ff655d';
      context.fillRect(x - 2, y - 2, 4, 4);
    }
    const px = (position.x + WORLD / 2) * scale;
    const py = (position.z + WORLD / 2) * scale;
    context.save();
    context.translate(px, py);
    context.rotate(player.state.onFoot ? -player.state.yaw : Math.PI - player.state.yaw);
    context.fillStyle = '#fff0b4';
    context.beginPath();
    context.moveTo(0, -6);
    context.lineTo(4, 5);
    context.lineTo(0, 3);
    context.lineTo(-4, 5);
    context.closePath();
    context.fill();
    context.restore();
  }
  return {
    showToast,
    interaction(value, text) { interaction.style.display = value ? 'block' : 'none'; if (text) interaction.textContent = text; },
    update(dt, time, position, mission, policeState, vehicle, nearestVehicle) {
      health.textContent = `${Math.ceil(player.state.health)}%`;
      health.style.color = player.state.health < 34 ? '#ff9073' : '';
      money.textContent = `$${player.state.money.toLocaleString()}`;
      const hours = 17 + Math.floor(time / 120);
      const mins = Math.floor((42 + time * 0.58) % 60);
      clock.textContent = `${String(hours % 24).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
      const stars = policeState.wanted;
      // Rebuilding the star row every frame churns the DOM; it only changes when heat does.
      if (stars !== lastStars) {
        lastStars = stars;
        wanted.innerHTML = Array.from({ length: 5 }, (_, i) => `<span class="${i < stars ? 'lit' : ''}">${i < stars ? '★' : '☆'}</span>`).join('');
      }
      chapter.textContent = mission.state.chapter;
      objective.textContent = mission.state.objective;
      const timer = mission.state.timer === null ? '' : ` · ${Math.ceil(mission.state.timer)}s`;
      subobjective.textContent = `${mission.state.detail}${timer} · ${player.state.ammo} rounds`;
      this.interaction(Boolean(nearestVehicle && !vehicle), nearestVehicle ? `[ E ] TAKE THE WHEEL · ${nearestVehicle.color}` : '');
      drawMap(position, mission, policeState);
      lastToast = Math.max(0, lastToast - dt);
      if (!lastToast) toast.classList.remove('show');
    },
    mapToWorld(x, y) { const scale = map.width / WORLD; return { x: clamp(x / scale - WORLD / 2, -WORLD / 2, WORLD / 2), z: clamp(y / scale - WORLD / 2, -WORLD / 2, WORLD / 2) }; },
  };
}
