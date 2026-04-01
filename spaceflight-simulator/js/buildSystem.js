const PART_DEFS = {
  pod: { mass: 1.5, fuelCapacity: 0, thrust: 0, isDecoupler: false },
  tank: { mass: 1.0, fuelCapacity: 120, thrust: 0, isDecoupler: false },
  engine: { mass: 1.2, fuelCapacity: 0, thrust: 220, isDecoupler: false },
  decoupler: { mass: 0.2, fuelCapacity: 0, thrust: 0, isDecoupler: true },
};

export class BuildSystem {
  constructor({ cols = 20, rows = 35, cellSize = 25 } = {}) {
    this.cols = cols;
    this.rows = rows;
    this.cellSize = cellSize;
    this.rocketParts = [];
  }

  getPartDefs() { return PART_DEFS; }
  getRocketParts() { return this.rocketParts.map((p) => ({ ...p })); }

  isInBounds(gridX, gridY) {
    return gridX >= 0 && gridX < this.cols && gridY >= 0 && gridY < this.rows;
  }

  getPartAt(gridX, gridY) {
    return this.rocketParts.find((p) => p.gridX === gridX && p.gridY === gridY);
  }

  canPlacePart(type, gridX, gridY) {
    if (!PART_DEFS[type]) return { ok: false, reason: 'Unknown part.' };
    if (!this.isInBounds(gridX, gridY)) return { ok: false, reason: 'Out of bounds.' };
    if (this.getPartAt(gridX, gridY)) return { ok: false, reason: 'Cell occupied.' };

    const sameColumn = this.rocketParts.filter((p) => p.gridX === gridX);
    if (sameColumn.length === 0) {
      if (gridY !== this.rows - 1) return { ok: false, reason: 'Start from the bottom row.' };
    } else {
      const highest = Math.min(...sameColumn.map((p) => p.gridY));
      if (gridY !== highest - 1) return { ok: false, reason: 'Parts must stack upward.' };
    }

    return { ok: true, reason: 'Valid placement.' };
  }

  addPart(type, gridX, gridY) {
    const v = this.canPlacePart(type, gridX, gridY);
    if (!v.ok) return v;
    const def = PART_DEFS[type];
    this.rocketParts.push({
      type,
      gridX,
      gridY,
      mass: def.mass,
      fuelCapacity: def.fuelCapacity,
      currentFuel: def.fuelCapacity,
      thrust: def.thrust,
      isDecoupler: def.isDecoupler,
    });
    return { ok: true, reason: '' };
  }

  removePart(gridX, gridY) {
    const idx = this.rocketParts.findIndex((p) => p.gridX === gridX && p.gridY === gridY);
    if (idx >= 0) {
      this.rocketParts.splice(idx, 1);
      return true;
    }
    return false;
  }

  reset() { this.rocketParts = []; }

  getStats() {
    const totalMass = this.rocketParts.reduce((sum, p) => sum + p.mass + p.currentFuel * 0.001, 0);
    const totalThrust = this.rocketParts.reduce((sum, p) => sum + p.thrust, 0);
    const totalFuelCapacity = this.rocketParts.reduce((sum, p) => sum + p.fuelCapacity, 0);
    const totalFuel = this.rocketParts.reduce((sum, p) => sum + p.currentFuel, 0);
    return { totalMass, totalThrust, totalFuelCapacity, totalFuel };
  }

  serialize() {
    return JSON.stringify(this.rocketParts);
  }

  deserialize(json) {
    try {
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) return false;
      const valid = parsed.every((p) => PART_DEFS[p.type] && Number.isInteger(p.gridX) && Number.isInteger(p.gridY));
      if (!valid) return false;
      this.rocketParts = parsed.map((p) => ({ ...p }));
      return true;
    } catch {
      return false;
    }
  }
}
