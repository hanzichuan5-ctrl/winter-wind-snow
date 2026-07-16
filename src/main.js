import './style.css';

const scene = document.querySelector('#winter-scene');
const canvas = document.querySelector('#snow-canvas');
const context = canvas.getContext('2d');
const snowLevelButton = document.querySelector('#snow-level');
const snowLevelLabel = document.querySelector('#snow-level-label');
const toast = document.querySelector('#toast');
const sceneCopy = document.querySelector('.scene-copy');

const levels = [
  { name: '舒缓', density: 0.62 },
  { name: '漫天', density: 1 },
  { name: '暴雪', density: 2.35 }
];

let width = 1;
let height = 1;
let dpr = 1;
let levelIndex = 1;
let flakes = [];
let shockwaves = [];
let lastFrame = performance.now();
let toastTimer;
let castTimer;

const pointer = {
  x: -1000,
  y: -1000,
  previousX: -1000,
  previousY: -1000,
  velocityX: 0,
  velocityY: 0,
  active: false,
  lastMove: 0,
  isCharging: false,
  chargeStartedAt: 0,
  charge: 0,
  pointerId: null
};

const random = (min, max) => min + Math.random() * (max - min);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

class Snowflake {
  constructor(initial = false) {
    this.reset(initial);
  }

  reset(initial = false) {
    this.depth = Math.pow(Math.random(), 1.25);
    this.x = random(-30, width + 30);
    this.y = initial ? random(-20, height + 20) : random(-90, -10);
    this.size = 0.8 + this.depth * 6.4;
    this.speed = 18 + this.depth * 82;
    this.drift = random(-11, 11) * (0.35 + this.depth);
    this.phase = random(0, Math.PI * 2);
    this.spin = random(-1.3, 1.3);
    this.rotation = random(0, Math.PI * 2);
    this.velocityX = 0;
    this.velocityY = 0;
    this.opacity = 0.28 + this.depth * 0.68;
    this.shockwaveId = -1;
  }

  update(delta, elapsed) {
    const dx = this.x - pointer.x;
    const dy = this.y - pointer.y;
    const distance = Math.hypot(dx, dy);
    const pointerSpeed = Math.min(1600, Math.hypot(pointer.velocityX, pointer.velocityY));
    const speedRatio = pointerSpeed / 1600;
    const windRadius = 165 + speedRatio * 210;

    if (pointer.isCharging && distance < 150 + pointer.charge * 105) {
      const castingRadius = 150 + pointer.charge * 105;
      const influence = Math.pow(1 - distance / castingRadius, 1.7);
      const pull = (175 + pointer.charge * 520) * influence * delta;

      if (distance > 1) {
        this.velocityX -= (dx / distance) * pull;
        this.velocityY -= (dy / distance) * pull;

        const orbit = (26 + pointer.charge * 96) * influence * delta;
        this.velocityX += (-dy / distance) * orbit;
        this.velocityY += (dx / distance) * orbit;
      }
    } else if (pointer.active && distance < windRadius) {
      const influence = Math.pow(1 - distance / windRadius, 1.45);
      const windScale = 0.72 + Math.pow(speedRatio, 1.3) * 7.2;
      this.velocityX += pointer.velocityX * influence * windScale * delta;
      this.velocityY += pointer.velocityY * influence * windScale * delta;

      if (distance > 1) {
        const swirlDirection = pointer.velocityX >= 0 ? 1 : -1;
        const swirl = (110 + speedRatio * 430) * influence * swirlDirection * delta;
        this.velocityX += (-dy / distance) * swirl;
        this.velocityY += (dx / distance) * swirl;
      }
    }

    shockwaves.forEach((wave) => {
      if (this.shockwaveId === wave.id) return;
      const waveDx = this.x - wave.x;
      const waveDy = this.y - wave.y;
      const waveDistance = Math.hypot(waveDx, waveDy);
      if (Math.abs(waveDistance - wave.radius) < 24 + wave.charge * 10 && waveDistance > 1) {
        const force = (78 + this.depth * 110) * wave.strength * (1 + wave.charge * 1.15);
        this.velocityX += (waveDx / waveDistance) * force;
        this.velocityY += (waveDy / waveDistance) * force;
        this.shockwaveId = wave.id;
      }
    });

    const drag = Math.pow(0.1, delta);
    this.velocityX *= drag;
    this.velocityY *= drag;
    this.velocityX = clamp(this.velocityX, -430, 430);
    this.velocityY = clamp(this.velocityY, -320, 350);

    this.x += (this.drift + Math.sin(elapsed * 0.00045 + this.phase) * (4 + this.depth * 9) + this.velocityX) * delta;
    this.y += (this.speed + this.velocityY) * delta;
    this.rotation += this.spin * delta;

    if (this.y > height + 45 || this.x < -90 || this.x > width + 90) {
      this.reset(false);
    }
  }

  draw() {
    context.save();
    context.translate(this.x, this.y);
    context.rotate(this.rotation);
    context.globalAlpha = this.opacity;
    context.fillStyle = this.depth > 0.7 ? '#d9f7ff' : '#bfeeff';
    context.shadowColor = 'rgba(128, 220, 255, 0.7)';
    context.shadowBlur = 2 + this.depth * 7;

    if (this.depth < 0.42) {
      context.beginPath();
      context.arc(0, 0, this.size * 0.58, 0, Math.PI * 2);
      context.fill();
    } else {
      context.beginPath();
      const points = 6;
      for (let index = 0; index < points * 2; index += 1) {
        const angle = (Math.PI * index) / points;
        const radius = index % 2 === 0 ? this.size : this.size * 0.36;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius * 0.72;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.closePath();
      context.fill();
    }

    context.restore();
  }
}

function desiredFlakeCount() {
  const areaCount = Math.round((width * height) / 4600);
  return Math.min(780, Math.round(clamp(areaCount, 150, 360) * levels[levelIndex].density));
}

function syncFlakeCount() {
  const target = desiredFlakeCount();
  while (flakes.length < target) flakes.push(new Snowflake(true));
  if (flakes.length > target) flakes.length = target;
}

function resize() {
  const bounds = scene.getBoundingClientRect();
  width = Math.max(1, bounds.width);
  height = Math.max(1, bounds.height);
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  syncFlakeCount();
}

function drawShockwaves(delta) {
  shockwaves.forEach((wave) => {
    wave.radius += (340 + wave.charge * 170) * delta;
    wave.strength = Math.max(0, 1 - wave.radius / (390 + wave.charge * 170));
    context.save();

    if (wave.radius < 120) {
      const glow = context.createRadialGradient(wave.x, wave.y, 0, wave.x, wave.y, 132 + wave.charge * 60);
      glow.addColorStop(0, `rgba(154, 232, 255, ${wave.strength * (0.16 + wave.charge * 0.2)})`);
      glow.addColorStop(0.28, `rgba(83, 173, 255, ${wave.strength * (0.06 + wave.charge * 0.11)})`);
      glow.addColorStop(1, 'rgba(56, 142, 255, 0)');
      context.fillStyle = glow;
      context.beginPath();
      context.arc(wave.x, wave.y, 132 + wave.charge * 60, 0, Math.PI * 2);
      context.fill();
    }

    context.beginPath();
    context.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
    context.strokeStyle = `rgba(151, 224, 255, ${wave.strength * (0.16 + wave.charge * 0.28)})`;
    context.lineWidth = 0.9 + wave.charge * 0.8;
    context.shadowColor = 'rgba(80, 182, 255, 0.65)';
    context.shadowBlur = 10 + wave.charge * 13;
    context.stroke();

    if (wave.charge > 0.2 && wave.radius > 24) {
      context.beginPath();
      context.arc(wave.x, wave.y, wave.radius * 0.62, 0, Math.PI * 2);
      context.strokeStyle = `rgba(207, 246, 255, ${wave.strength * 0.1})`;
      context.lineWidth = 0.7;
      context.stroke();
    }

    context.restore();
  });
  shockwaves = shockwaves.filter((wave) => wave.strength > 0);
}

function animate(now) {
  const delta = Math.min(0.034, Math.max(0.001, (now - lastFrame) / 1000));
  lastFrame = now;

  if (now - pointer.lastMove > 110) {
    pointer.velocityX *= 0.9;
    pointer.velocityY *= 0.9;
  }

  if (pointer.isCharging) {
    pointer.charge = clamp((now - pointer.chargeStartedAt) / 1350, 0, 1);
  }

  context.clearRect(0, 0, width, height);
  flakes.sort((a, b) => a.depth - b.depth);
  flakes.forEach((flake) => {
    flake.update(delta, now);
    flake.draw();
  });
  drawShockwaves(delta);
  requestAnimationFrame(animate);
}

function updatePointer(event) {
  const bounds = scene.getBoundingClientRect();
  const nextX = event.clientX - bounds.left;
  const nextY = event.clientY - bounds.top;
  const now = performance.now();
  const elapsed = Math.max(12, now - pointer.lastMove) / 1000;

  if (pointer.active && !pointer.isCharging) {
    const nextVelocityX = (nextX - pointer.x) / elapsed;
    const nextVelocityY = (nextY - pointer.y) / elapsed;
    pointer.velocityX = pointer.velocityX * 0.6 + nextVelocityX * 0.4;
    pointer.velocityY = pointer.velocityY * 0.6 + nextVelocityY * 0.4;
  }

  pointer.previousX = pointer.x;
  pointer.previousY = pointer.y;
  pointer.x = nextX;
  pointer.y = nextY;
  pointer.active = true;
  pointer.lastMove = now;
}

function resonateTitle() {
  sceneCopy.classList.remove('is-resonating');
  void sceneCopy.offsetWidth;
  sceneCopy.classList.add('is-resonating');
  window.clearTimeout(castTimer);
  castTimer = window.setTimeout(() => sceneCopy.classList.remove('is-resonating'), 760);
}

function releaseMagic(event) {
  if (!pointer.isCharging || (pointer.pointerId !== null && event.pointerId !== pointer.pointerId)) return;

  updatePointer(event);
  const charge = Math.max(0.22, pointer.charge);
  pointer.isCharging = false;
  pointer.pointerId = null;
  shockwaves.push({
    id: Date.now() + Math.random(),
    x: pointer.x,
    y: pointer.y,
    radius: 5,
    strength: 1,
    charge
  });
  resonateTitle();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2600);
}

scene.addEventListener('pointermove', updatePointer);
scene.addEventListener('pointerleave', () => {
  if (!pointer.isCharging) pointer.active = false;
});

scene.addEventListener('pointerdown', (event) => {
  if (event.target.closest('button, a')) return;
  updatePointer(event);
  pointer.isCharging = true;
  pointer.chargeStartedAt = performance.now();
  pointer.charge = 0;
  pointer.pointerId = event.pointerId;
  pointer.velocityX = 0;
  pointer.velocityY = 0;
  scene.setPointerCapture?.(event.pointerId);
});

scene.addEventListener('pointerup', releaseMagic);
scene.addEventListener('pointercancel', releaseMagic);

snowLevelButton.addEventListener('click', () => {
  levelIndex = (levelIndex + 1) % levels.length;
  snowLevelLabel.textContent = levels[levelIndex].name;
  syncFlakeCount();
  showToast(`雪量已切换为「${levels[levelIndex].name}」`);
});

window.addEventListener('resize', resize);
resize();
requestAnimationFrame(animate);
