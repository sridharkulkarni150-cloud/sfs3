import { GAME_STATES } from './stateManager.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cameraY = 0;
    this.particles = [];
    this.starfield = Array.from({ length: 160 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.8 + 0.2,
    }));
  }

  drawBackground() {
    const { ctx, canvas } = this;
    ctx.fillStyle = '#060b19';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#cfd8ff';
    this.starfield.forEach((s) => {
      ctx.globalAlpha = 0.4 + Math.sin((Date.now() / 1000) + s.x) * 0.2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  drawBuildGrid(buildSystem) {
    const { ctx } = this;
    ctx.strokeStyle = 'rgba(90,120,190,0.45)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= buildSystem.cols; x++) {
      ctx.beginPath();
      ctx.moveTo(x * buildSystem.cellSize, 0);
      ctx.lineTo(x * buildSystem.cellSize, buildSystem.rows * buildSystem.cellSize);
      ctx.stroke();
    }
    for (let y = 0; y <= buildSystem.rows; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * buildSystem.cellSize);
      ctx.lineTo(buildSystem.cols * buildSystem.cellSize, y * buildSystem.cellSize);
      ctx.stroke();
    }
  }

  drawPart(part, x, y, size) {
    const ctx = this.ctx;
    if (part.type === 'pod') {
      ctx.fillStyle = '#979ea8';
      ctx.beginPath();
      ctx.roundRect(x + 4, y + 2, size - 8, size - 4, 9);
      ctx.fill();
    } else if (part.type === 'tank') {
      ctx.fillStyle = '#bdc5cd';
      ctx.fillRect(x + 5, y + 2, size - 10, size - 4);
    } else if (part.type === 'engine') {
      ctx.fillStyle = '#cc5252';
      ctx.beginPath();
      ctx.moveTo(x + 5, y + 6);
      ctx.lineTo(x + size - 5, y + 6);
      ctx.lineTo(x + size * 0.65, y + size - 2);
      ctx.lineTo(x + size * 0.35, y + size - 2);
      ctx.closePath();
      ctx.fill();
    } else if (part.type === 'decoupler') {
      ctx.fillStyle = '#d1913f';
      ctx.fillRect(x + 3, y + size / 2 - 3, size - 6, 6);
    }
  }

  drawRocketBuild(buildSystem) {
    buildSystem.getRocketParts().forEach((part) => {
      const x = part.gridX * buildSystem.cellSize;
      const y = part.gridY * buildSystem.cellSize;
      this.drawPart(part, x, y, buildSystem.cellSize);
    });
  }

  emitExhaust(x, y, throttle) {
    const n = Math.floor(throttle / 15);
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 14,
        y,
        vx: (Math.random() - 0.5) * 20,
        vy: 70 + Math.random() * 60,
        life: 0.45 + Math.random() * 0.3,
      });
    }
  }

  updateParticles(dt) {
    this.particles.forEach((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    });
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  drawFlight(flightState, dt) {
    const { ctx, canvas } = this;
    this.cameraY += ((flightState.altitude * 40) - this.cameraY) * 0.08;

    let shakeX = 0;
    let shakeY = 0;
    if (flightState.screenShake > 0) {
      shakeX = (Math.random() - 0.5) * 14 * flightState.screenShake;
      shakeY = (Math.random() - 0.5) * 14 * flightState.screenShake;
      flightState.screenShake = Math.max(0, flightState.screenShake - dt * 1.4);
    }

    ctx.save();
    ctx.translate(shakeX + canvas.width / 2, shakeY + canvas.height * 0.78);
    ctx.translate(0, this.cameraY);

    ctx.strokeStyle = '#7f8b4f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-canvas.width, 0);
    ctx.lineTo(canvas.width, 0);
    ctx.stroke();

    const size = 24;
    let localY = -size;
    const sorted = [...flightState.parts].sort((a, b) => b.gridY - a.gridY);
    sorted.forEach((part) => {
      this.drawPart(part, -size / 2, localY, size);
      if (part.type === 'engine' && flightState.throttle > 0 && flightState.status === GAME_STATES.FLIGHT_MODE) {
        this.emitExhaust(0, localY + size - 2, flightState.throttle);
      }
      localY -= size;
    });

    this.updateParticles(dt);
    this.particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life * 2);
      ctx.fillStyle = '#ffb066';
      ctx.fillRect(p.x, p.y, 3, 3);
    });
    ctx.globalAlpha = 1;

    if (flightState.status === GAME_STATES.CRASHED) {
      for (let i = 0; i < 18; i++) {
        ctx.fillStyle = '#ff6d3f';
        ctx.fillRect((Math.random() - 0.5) * 80, -Math.random() * 50, 4, 4);
      }
    }

    ctx.restore();
  }

  render({ mode, buildSystem, flightState, telemetry, dt }) {
    this.drawBackground();
    if (mode === GAME_STATES.BUILD_MODE) {
      this.drawBuildGrid(buildSystem);
      this.drawRocketBuild(buildSystem);
    } else {
      this.drawFlight(flightState, dt);
    }

    this.drawOverlay(telemetry);
  }

  drawOverlay(t) {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(11,16,28,0.72)';
    ctx.fillRect(10, 10, 200, 116);
    ctx.fillStyle = '#d8e2ff';
    ctx.font = '14px monospace';
    ctx.fillText(`ALT: ${t.altitude.toFixed(1)} m`, 20, 34);
    ctx.fillText(`VEL: ${t.velocity.toFixed(2)} m/s`, 20, 54);
    ctx.fillText(`FUEL: ${t.fuel.toFixed(1)} u`, 20, 74);
    ctx.fillText(`THR: ${t.throttle.toFixed(0)}%`, 20, 94);
    ctx.fillText(`STAT: ${t.status}`, 20, 114);

    ctx.fillStyle = '#1f294a';
    ctx.fillRect(220, 20, 20, 100);
    ctx.fillStyle = '#64d67a';
    ctx.fillRect(220, 120 - Math.min(100, t.fuelPct), 20, Math.min(100, t.fuelPct));

    ctx.fillStyle = '#1f294a';
    ctx.fillRect(255, 20, 20, 100);
    ctx.fillStyle = '#ff8f47';
    ctx.fillRect(255, 120 - t.throttle, 20, t.throttle);
  }
}
