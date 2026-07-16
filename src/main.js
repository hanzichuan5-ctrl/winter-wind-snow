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
let windTrails = [];
let lastFrame = performance.now();
let toastTimer;
let castTimer;
let scrollFrame;

const scrollState = {
  progress: 0,
  lastY: window.scrollY,
  velocity: 0
};

const pointer = {
  x: -1000,
  y: -1000,
  previousX: -1000,
  previousY: -1000,
  velocityX: 0,
  velocityY: 0,
  active: false,
  lastMove: 0,
  lastTrail: 0,
  isCharging: false,
  chargeStartedAt: 0,
  charge: 0,
  pointerId: null
};

const random = (min, max) => min + Math.random() * (max - min);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const easeOut = (value) => 1 - Math.pow(1 - value, 3);

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

        const orbit = (20 + pointer.charge * 64) * influence * delta;
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

    windTrails.forEach((trail) => {
      const age = elapsed - trail.createdAt;
      const life = 520;
      if (age < 0 || age > life) return;

      const segmentX = trail.toX - trail.fromX;
      const segmentY = trail.toY - trail.fromY;
      const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;
      if (segmentLengthSquared < 1) return;

      const projection = clamp(
        ((this.x - trail.fromX) * segmentX + (this.y - trail.fromY) * segmentY) / segmentLengthSquared,
        0,
        1
      );
      const closestX = trail.fromX + segmentX * projection;
      const closestY = trail.fromY + segmentY * projection;
      const trailDx = this.x - closestX;
      const trailDy = this.y - closestY;
      const trailDistance = Math.hypot(trailDx, trailDy);
      const trailRadius = 28 + this.depth * 28;

      if (trailDistance < trailRadius && trailDistance > 0.3) {
        const fade = Math.pow(1 - age / life, 1.7);
        const influence = Math.pow(1 - trailDistance / trailRadius, 1.5) * fade;
        const push = (96 + this.depth * 110) * influence;
        this.velocityX += (trailDx / trailDistance) * push;
        this.velocityY += (trailDy / trailDistance) * push;
      }
    });

    shockwaves.forEach((wave) => {
      if (this.shockwaveId === wave.id) return;
      const waveDx = this.x - wave.x;
      const waveDy = this.y - wave.y;
      const waveDistance = Math.hypot(waveDx, waveDy);
      const waveWidth = 34 + wave.charge * 18;

      if (Math.abs(waveDistance - wave.radius) < waveWidth && waveDistance > 1) {
        const force = (28 + this.depth * 48) * wave.strength * (0.75 + wave.charge * 0.8);
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

    const scrollLift = scrollState.progress * (12 + this.depth * 72);
    const scrollDraft = scrollState.velocity * scrollState.progress * (0.015 + this.depth * 0.038);
    this.x += (this.drift + Math.sin(elapsed * 0.00045 + this.phase) * (4 + this.depth * 9) + this.velocityX) * delta;
    this.y += (this.speed + this.velocityY - scrollLift - scrollDraft) * delta;
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

class SnowCover {
  constructor(card) {
    this.card = card;
    this.canvas = card.querySelector('.snow-wipe');
    this.context = this.canvas.getContext('2d');
    this.coverCanvas = document.createElement('canvas');
    this.coverContext = this.coverCanvas.getContext('2d');
    this.restoreCanvas = document.createElement('canvas');
    this.restoreContext = this.restoreCanvas.getContext('2d');
    this.width = 1;
    this.height = 1;
    this.dpr = 1;
    this.lastPoint = null;
    this.restoreTimer = null;
    this.restoreFrame = null;
    this.restoreLine = 0;

    this.resize();
    this.bindEvents();
  }

  resize() {
    const bounds = this.card.getBoundingClientRect();
    this.width = Math.max(1, bounds.width);
    this.height = Math.max(1, bounds.height);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.coverCanvas.width = Math.round(this.width * this.dpr);
    this.coverCanvas.height = Math.round(this.height * this.dpr);
    this.restoreCanvas.width = Math.round(this.width * this.dpr);
    this.restoreCanvas.height = Math.round(this.height * this.dpr);
    this.context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.coverContext.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.restoreContext.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.coverContext.clearRect(0, 0, this.width, this.height);
    this.paintSnowBand(0, this.height, this.coverContext);
    this.context.clearRect(0, 0, this.width, this.height);
    this.context.drawImage(this.coverCanvas, 0, 0, this.width, this.height);
    this.restoreLine = 0;
  }

  bindEvents() {
    this.card.addEventListener('pointermove', (event) => this.erase(event));
    this.card.addEventListener('pointerleave', () => this.scheduleRestore());
    this.card.addEventListener('pointercancel', () => this.scheduleRestore());
  }

  paintSnowBand(startY, endY, target = this.context) {
    if (endY <= startY) return;

    const bandHeight = endY - startY;
    target.save();
    target.globalCompositeOperation = 'source-over';
    {
      const gradient = target.createLinearGradient(0, startY, 0, endY);
      gradient.addColorStop(0, 'rgba(235, 250, 255, 0.94)');
      gradient.addColorStop(0.52, 'rgba(193, 225, 239, 0.88)');
      gradient.addColorStop(1, 'rgba(159, 205, 224, 0.78)');
      target.fillStyle = gradient;
      target.fillRect(0, startY, this.width, bandHeight);

      const grainCount = Math.max(12, Math.round((this.width * bandHeight) / 2200));
      for (let index = 0; index < grainCount; index += 1) {
        const x = random(-8, this.width + 8);
        const y = random(startY, endY);
        const radius = random(1.5, 9);
        target.beginPath();
        target.fillStyle = `rgba(245, 253, 255, ${random(0.08, 0.34)})`;
        target.arc(x, y, radius, 0, Math.PI * 2);
        target.fill();
      }
    }

    target.restore();
  }

  renderRestoration(coverHeight) {
    this.context.clearRect(0, 0, this.width, this.height);
    this.context.drawImage(this.restoreCanvas, 0, 0, this.width, this.height);
    this.context.save();
    this.context.beginPath();
    this.context.rect(0, 0, this.width, coverHeight);
    this.context.clip();
    this.context.drawImage(this.coverCanvas, 0, 0, this.width, this.height);
    this.context.restore();
  }

  erase(event) {
    this.cancelRestore();
    const bounds = this.card.getBoundingClientRect();
    const point = {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top
    };

    const distance = this.lastPoint
      ? Math.hypot(point.x - this.lastPoint.x, point.y - this.lastPoint.y)
      : 0;
    const brushSize = clamp(26 + distance * 0.45, 32, 66);

    this.context.save();
    this.context.globalCompositeOperation = 'destination-out';
    this.context.globalAlpha = 0.97;
    this.context.strokeStyle = '#000';
    this.context.fillStyle = '#000';
    this.context.lineCap = 'round';
    this.context.lineJoin = 'round';
    this.context.lineWidth = brushSize;
    this.context.beginPath();

    if (this.lastPoint) {
      this.context.moveTo(this.lastPoint.x, this.lastPoint.y);
      this.context.lineTo(point.x, point.y);
      this.context.stroke();
    } else {
      this.context.arc(point.x, point.y, brushSize * 0.5, 0, Math.PI * 2);
      this.context.fill();
    }

    this.context.restore();
    this.lastPoint = point;
  }

  scheduleRestore() {
    this.lastPoint = null;
    window.clearTimeout(this.restoreTimer);
    this.restoreTimer = window.setTimeout(() => this.startRestore(), 700);
  }

  startRestore() {
    this.cancelRestore();
    this.restoreLine = 0;
    this.restoreContext.clearRect(0, 0, this.width, this.height);
    this.restoreContext.drawImage(this.canvas, 0, 0, this.width, this.height);
    const startedAt = performance.now();
    const duration = 2100;

    const restore = (now) => {
      const progress = easeOut(clamp((now - startedAt) / duration, 0, 1));
      const nextLine = this.height * progress;
      this.renderRestoration(nextLine);
      this.restoreLine = nextLine;

      if (progress < 1) {
        this.restoreFrame = requestAnimationFrame(restore);
      } else {
        this.context.clearRect(0, 0, this.width, this.height);
        this.context.drawImage(this.coverCanvas, 0, 0, this.width, this.height);
        this.restoreFrame = null;
      }
    };

    this.restoreFrame = requestAnimationFrame(restore);
  }

  cancelRestore() {
    window.clearTimeout(this.restoreTimer);
    if (this.restoreFrame) window.cancelAnimationFrame(this.restoreFrame);
    this.restoreFrame = null;
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

function advanceWaves(delta) {
  shockwaves.forEach((wave) => {
    wave.radius += (96 + wave.charge * 84) * delta;
    wave.strength = Math.max(0, 1 - wave.radius / (350 + wave.charge * 230));
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

  scrollState.velocity *= 0.9;
  windTrails = windTrails.filter((trail) => now - trail.createdAt < 520);

  context.clearRect(0, 0, width, height);
  flakes.sort((a, b) => a.depth - b.depth);
  flakes.forEach((flake) => {
    flake.update(delta, now);
    flake.draw();
  });
  advanceWaves(delta);
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

    const speed = Math.hypot(pointer.velocityX, pointer.velocityY);
    if (speed > 560 && now - pointer.lastTrail > 52) {
      windTrails.push({
        fromX: pointer.x,
        fromY: pointer.y,
        toX: nextX,
        toY: nextY,
        createdAt: now
      });
      pointer.lastTrail = now;
    }
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
    radius: 0,
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

function updateScrollScene() {
  scrollFrame = null;
  const scrollY = window.scrollY;
  const range = Math.max(window.innerHeight * 0.95, 1);
  const progress = clamp(scrollY / range, 0, 1);
  const eased = easeOut(progress);
  const deltaY = scrollY - scrollState.lastY;

  scrollState.progress = eased;
  scrollState.velocity = clamp(scrollState.velocity * 0.5 + deltaY * 0.5, -80, 80);
  scrollState.lastY = scrollY;

  scene.style.setProperty('--scene-shift', `${eased * -7}%`);
  scene.style.setProperty('--scene-scale', `${1.02 + eased * 0.08}`);
  scene.style.setProperty('--scene-opacity', `${1 - eased * 0.62}`);
  scene.style.setProperty('--mist-opacity', `${(1 - eased * 0.62) * 0.9}`);
  scene.style.setProperty('--mist-two-opacity', `${(1 - eased * 0.62) * 0.5}`);
  scene.style.setProperty('--snow-shift', `${eased * -38}px`);
  scene.style.setProperty('--snow-scale', `${1 + eased * 0.08}`);
  scene.style.setProperty('--snow-opacity', `${1 - eased * 0.78}`);
  scene.style.setProperty('--hero-ui-opacity', `${Math.max(0, 1 - eased * 1.35)}`);
  scene.style.setProperty('--hero-ui-shift', `${eased * -18}px`);
  scene.style.setProperty('--copy-shift', `${eased * -28}px`);
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

const snowCovers = [...document.querySelectorAll('[data-snow-card]')].map((card) => new SnowCover(card));

window.addEventListener('resize', () => {
  resize();
  snowCovers.forEach((cover) => cover.resize());
  updateScrollScene();
});

window.addEventListener('scroll', () => {
  if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScrollScene);
}, { passive: true });

resize();
updateScrollScene();
requestAnimationFrame(animate);
