import './style.css';

const scene = document.querySelector('#winter-scene');
const canvas = document.querySelector('#snow-canvas');
const context = canvas.getContext('2d');
const snowLevelButton = document.querySelector('#snow-level');
const snowLevelLabel = document.querySelector('#snow-level-label');
const toast = document.querySelector('#toast');

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

const pointer = {
  x: -1000,
  y: -1000,
  previousX: -1000,
  previousY: -1000,
  velocityX: 0,
  velocityY: 0,
  active: false,
  lastMove: 0
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

    if (pointer.active && distance < windRadius) {
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
      if (Math.abs(waveDistance - wave.radius) < 24 && waveDistance > 1) {
        const force = (78 + this.depth * 110) * wave.strength;
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
    wave.radius += 340 * delta;
    wave.strength = Math.max(0, 1 - wave.radius / 390);
    context.save();
    context.beginPath();
    context.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
    context.strokeStyle = `rgba(188, 237, 255, ${wave.strength * 0.24})`;
    context.lineWidth = 1.2;
    context.shadowColor = 'rgba(113, 218, 255, 0.45)';
    context.shadowBlur = 12;
    context.stroke();
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

  if (pointer.active) {
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

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2600);
}

scene.addEventListener('pointermove', updatePointer);
scene.addEventListener('pointerleave', () => {
  pointer.active = false;
});

scene.addEventListener('pointerdown', (event) => {
  if (event.target.closest('button, a')) return;
  updatePointer(event);
  shockwaves.push({
    id: Date.now() + Math.random(),
    x: pointer.x,
    y: pointer.y,
    radius: 8,
    strength: 1
  });
});

snowLevelButton.addEventListener('click', () => {
  levelIndex = (levelIndex + 1) % levels.length;
  snowLevelLabel.textContent = levels[levelIndex].name;
  syncFlakeCount();
  showToast(`雪量已切换为「${levels[levelIndex].name}」`);
});

window.addEventListener('resize', resize);
resize();
requestAnimationFrame(animate);
