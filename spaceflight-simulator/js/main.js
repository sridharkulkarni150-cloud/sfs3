import { StateManager, GAME_STATES } from './stateManager.js';
import { BuildSystem } from './buildSystem.js';
import { PhysicsEngine } from './physicsEngine.js';
import { Renderer } from './renderer.js';

const canvas = document.getElementById('gameCanvas');
const modeToggle = document.getElementById('modeToggle');
const resetBuild = document.getElementById('resetBuild');
const partPalette = document.getElementById('partPalette');
const telemetryNode = document.getElementById('telemetry');
const throttleSlider = document.getElementById('throttleSlider');
const feedback = document.getElementById('placementFeedback');

const stateManager = new StateManager();
const buildSystem = new BuildSystem({ cols: 20, rows: 35, cellSize: 25 });
const physicsEngine = new PhysicsEngine();
const renderer = new Renderer(canvas);

const STORAGE_KEY = 'sfs-rocket-design-v1';
let draggingType = null;
let flightState = null;
let lastTime = performance.now();

function initPalette() {
  const defs = buildSystem.getPartDefs();
  Object.entries(defs).forEach(([type, def]) => {
    const item = document.createElement('div');
    item.className = 'part-item';
    item.draggable = true;
    item.dataset.type = type;
    item.innerHTML = `<strong>${type.toUpperCase()}</strong>mass: ${def.mass}t | fuel: ${def.fuelCapacity} | thrust: ${def.thrust}kN`;
    item.addEventListener('dragstart', () => (draggingType = type));
    item.addEventListener('touchstart', () => (draggingType = type), { passive: true });
    partPalette.appendChild(item);
  });
}

function saveDesign() {
  localStorage.setItem(STORAGE_KEY, buildSystem.serialize());
}

function loadDesign() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) buildSystem.deserialize(saved);
}

function screenToGrid(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / rect.width;
  const sy = canvas.height / rect.height;
  const x = (clientX - rect.left) * sx;
  const y = (clientY - rect.top) * sy;
  return {
    gridX: Math.floor(x / buildSystem.cellSize),
    gridY: Math.floor(y / buildSystem.cellSize),
  };
}

function showFeedback(msg, ok) {
  feedback.textContent = msg;
  feedback.classList.remove('hidden', 'ok', 'bad');
  feedback.classList.add(ok ? 'ok' : 'bad');
  clearTimeout(showFeedback.tid);
  showFeedback.tid = setTimeout(() => feedback.classList.add('hidden'), 1100);
}

canvas.addEventListener('dragover', (e) => e.preventDefault());
canvas.addEventListener('drop', (e) => {
  e.preventDefault();
  if (stateManager.getState() !== GAME_STATES.BUILD_MODE || !draggingType) return;
  const { gridX, gridY } = screenToGrid(e.clientX, e.clientY);
  const result = buildSystem.addPart(draggingType, gridX, gridY);
  showFeedback(result.reason || 'Placed.', result.ok);
  if (result.ok) saveDesign();
});

canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (stateManager.getState() !== GAME_STATES.BUILD_MODE) return;
  const { gridX, gridY } = screenToGrid(e.clientX, e.clientY);
  if (buildSystem.removePart(gridX, gridY)) {
    saveDesign();
    showFeedback('Part removed.', true);
  }
});

canvas.addEventListener('touchend', (e) => {
  if (stateManager.getState() !== GAME_STATES.BUILD_MODE || !draggingType) return;
  const touch = e.changedTouches[0];
  const { gridX, gridY } = screenToGrid(touch.clientX, touch.clientY);
  const result = buildSystem.addPart(draggingType, gridX, gridY);
  showFeedback(result.reason || 'Placed.', result.ok);
  if (result.ok) saveDesign();
  draggingType = null;
});

window.addEventListener('keydown', (e) => {
  if (stateManager.getState() === GAME_STATES.BUILD_MODE && e.key === 'Delete') {
    const parts = buildSystem.getRocketParts();
    if (parts.length) {
      parts.sort((a, b) => a.gridY - b.gridY);
      buildSystem.removePart(parts[0].gridX, parts[0].gridY);
      saveDesign();
    }
  }

  if (!flightState || stateManager.getState() === GAME_STATES.BUILD_MODE) return;

  if (e.key === ' ' || e.key === 'ArrowUp') flightState.throttle = Math.min(100, flightState.throttle + 5);
  if (e.key === 'Control' || e.key === 'ArrowDown') flightState.throttle = Math.max(0, flightState.throttle - 5);
  if (e.key === 'Shift') physicsEngine.stageSeparation(flightState);
  throttleSlider.value = String(flightState.throttle);
});

throttleSlider.addEventListener('input', () => {
  if (flightState) flightState.throttle = Number(throttleSlider.value);
});

modeToggle.addEventListener('click', () => {
  if (stateManager.getState() === GAME_STATES.BUILD_MODE) {
    const validation = stateManager.validateRocketForFlight(buildSystem.getRocketParts());
    if (!validation.valid) {
      showFeedback(validation.reason, false);
      return;
    }
    flightState = physicsEngine.createFlightState(buildSystem.getRocketParts());
    throttleSlider.value = '0';
    stateManager.setState(GAME_STATES.FLIGHT_MODE);
    modeToggle.textContent = 'Return to Build';
  } else {
    stateManager.setState(GAME_STATES.BUILD_MODE);
    flightState = null;
    modeToggle.textContent = 'Launch';
  }
});

resetBuild.addEventListener('click', () => {
  buildSystem.reset();
  saveDesign();
  if (stateManager.getState() !== GAME_STATES.BUILD_MODE) {
    stateManager.setState(GAME_STATES.BUILD_MODE);
    flightState = null;
    modeToggle.textContent = 'Launch';
  }
});

function updateTelemetry() {
  const stats = buildSystem.getStats();
  const mode = stateManager.getState();
  const t = {
    altitude: flightState?.altitude ?? 0,
    velocity: flightState?.velocity ?? 0,
    fuel: flightState ? flightState.parts.reduce((s, p) => s + p.currentFuel, 0) : stats.totalFuel,
    throttle: flightState?.throttle ?? 0,
    status: mode,
    fuelPct: flightState ? Math.min(100, (flightState.parts.reduce((s, p) => s + p.currentFuel, 0) / Math.max(1, stats.totalFuelCapacity)) * 100) : Math.min(100, (stats.totalFuel / Math.max(1, stats.totalFuelCapacity)) * 100),
  };

  telemetryNode.innerHTML = [
    `State: ${t.status}`,
    `Altitude: ${t.altitude.toFixed(1)} m`,
    `Velocity: ${t.velocity.toFixed(2)} m/s`,
    `Fuel: ${t.fuel.toFixed(2)} u`,
    `Throttle: ${t.throttle.toFixed(0)}%`,
    `Mass: ${(stats.totalMass).toFixed(2)} t`,
    `Thrust: ${(stats.totalThrust).toFixed(1)} kN`,
  ].join('<br>');

  return t;
}

function loop(now) {
  const dt = Math.min(0.033, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;

  if (flightState && stateManager.getState() === GAME_STATES.FLIGHT_MODE) {
    physicsEngine.update(flightState, dt);
    if (flightState.status === GAME_STATES.CRASHED) stateManager.setState(GAME_STATES.CRASHED);
    if (flightState.status === GAME_STATES.LANDED) stateManager.setState(GAME_STATES.LANDED);
  }

  const telemetry = updateTelemetry();
  renderer.render({
    mode: stateManager.getState() === GAME_STATES.BUILD_MODE ? GAME_STATES.BUILD_MODE : GAME_STATES.FLIGHT_MODE,
    buildSystem,
    flightState: flightState ?? physicsEngine.createFlightState([]),
    telemetry,
    dt,
  });

  requestAnimationFrame(loop);
}

function init() {
  initPalette();
  loadDesign();
  requestAnimationFrame(loop);
}

init();
