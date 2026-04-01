import { GAME_STATES } from './stateManager.js';

export class PhysicsEngine {
  constructor() {
    this.gravity = 5.0;
    this.dragCoefficient = 0.02;
    this.isp = 280;
  }

  createFlightState(rocketParts) {
    const sorted = rocketParts
      .map((p) => ({ ...p }))
      .sort((a, b) => b.gridY - a.gridY); // bottom first

    return {
      parts: sorted,
      altitude: 0,
      velocity: 0,
      throttle: 0,
      dryMass: sorted.reduce((s, p) => s + p.mass, 0),
      fuelMass: sorted.reduce((s, p) => s + p.currentFuel * 0.001, 0),
      status: GAME_STATES.FLIGHT_MODE,
      screenShake: 0,
      stageIndex: 0,
    };
  }

  stageSeparation(flightState) {
    const idx = flightState.parts.findIndex((p) => p.isDecoupler);
    if (idx < 0) return false;

    const upper = flightState.parts.slice(0, idx);
    flightState.parts = upper;
    flightState.dryMass = upper.reduce((s, p) => s + p.mass, 0);
    flightState.fuelMass = upper.reduce((s, p) => s + p.currentFuel * 0.001, 0);
    flightState.stageIndex += 1;
    return true;
  }

  update(flightState, rawDeltaTime) {
    const dt = Math.min(Math.max(rawDeltaTime, 0), 0.033);
    if (!Number.isFinite(dt)) return flightState;

    const totalFuelUnits = flightState.parts.reduce((s, p) => s + Math.max(0, p.currentFuel || 0), 0);
    const engineThrust = flightState.parts.reduce((s, p) => s + (p.type === 'engine' ? p.thrust : 0), 0);
    const throttle = Math.min(100, Math.max(0, flightState.throttle));
    const thrust = totalFuelUnits > 0 ? engineThrust * (throttle / 100) : 0;

    const fuelFlow = thrust > 0 ? (thrust / this.isp) * dt : 0;
    let remainingFuelUse = Math.max(0, fuelFlow);
    for (const part of flightState.parts) {
      if (remainingFuelUse <= 0) break;
      if (part.currentFuel > 0) {
        const burn = Math.min(part.currentFuel, remainingFuelUse);
        part.currentFuel -= burn;
        remainingFuelUse -= burn;
      }
    }

    const fuelMass = flightState.parts.reduce((s, p) => s + Math.max(0, p.currentFuel) * 0.001, 0);
    const mass = Math.max(0.01, flightState.parts.reduce((s, p) => s + p.mass, 0) + fuelMass);

    const drag = 0.5 * this.dragCoefficient * flightState.velocity * Math.abs(flightState.velocity);
    const netForce = thrust - (mass * this.gravity) - drag;
    const accel = Number.isFinite(netForce / mass) ? netForce / mass : 0;

    flightState.velocity += accel * dt;
    flightState.altitude += flightState.velocity * dt;
    flightState.fuelMass = fuelMass;
    flightState.dryMass = mass - fuelMass;

    if (!Number.isFinite(flightState.velocity)) flightState.velocity = 0;
    if (!Number.isFinite(flightState.altitude)) flightState.altitude = 0;

    if (flightState.altitude <= 0) {
      flightState.altitude = 0;
      if (flightState.velocity < -5) {
        flightState.status = GAME_STATES.CRASHED;
        flightState.screenShake = 0.8;
      } else {
        flightState.status = GAME_STATES.LANDED;
      }
      flightState.velocity = 0;
      flightState.throttle = 0;
    }

    return flightState;
  }
}
