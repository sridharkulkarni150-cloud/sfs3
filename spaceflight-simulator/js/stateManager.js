export const GAME_STATES = Object.freeze({
  BUILD_MODE: 'BUILD_MODE',
  FLIGHT_MODE: 'FLIGHT_MODE',
  CRASHED: 'CRASHED',
  LANDED: 'LANDED',
});

export class StateManager {
  constructor() {
    this.state = GAME_STATES.BUILD_MODE;
    this.listeners = new Set();
  }

  getState() {
    return this.state;
  }

  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setState(newState) {
    if (!Object.values(GAME_STATES).includes(newState) || newState === this.state) return;
    const prev = this.state;
    this.state = newState;
    this.listeners.forEach((fn) => fn({ prev, current: newState }));
  }

  validateRocketForFlight(rocketParts) {
    if (!Array.isArray(rocketParts) || rocketParts.length === 0) return { valid: false, reason: 'Build a rocket first.' };

    const hasPod = rocketParts.some((p) => p.type === 'pod');
    const hasEngine = rocketParts.some((p) => p.type === 'engine');
    if (!hasPod || !hasEngine) return { valid: false, reason: 'Rocket requires at least one pod and one engine.' };

    // Connectivity check: all parts must be connected vertically in each used column.
    const cols = new Map();
    rocketParts.forEach((p) => {
      if (!cols.has(p.gridX)) cols.set(p.gridX, []);
      cols.get(p.gridX).push(p.gridY);
    });

    for (const ys of cols.values()) {
      ys.sort((a, b) => a - b);
      for (let i = 1; i < ys.length; i++) {
        if (ys[i] - ys[i - 1] !== 1) {
          return { valid: false, reason: 'Rocket structure must be vertically connected in each column.' };
        }
      }
    }

    return { valid: true, reason: '' };
  }
}
