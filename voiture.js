(function() {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const container = document.getElementById('gameContainer');

  const W = 480, H = 640;
  canvas.width = W; canvas.height = H;
  container.style.height = H + 'px';

  const ROAD_L = 80, ROAD_R = W - 80;
  const ROAD_W = ROAD_R - ROAD_L;
  const LANE_W = ROAD_W / 3;

  let keys = {};
  document.addEventListener('keydown', e => { keys[e.key] = true; e.preventDefault(); });
  document.addEventListener('keyup', e => { keys[e.key] = false; });

  let game = null;

  function AudioCtx() { try { return new (window.AudioContext || window.webkitAudioContext)(); } catch(e) { return null; } }

  function playTone(freq, dur, type, ac) {
    if (!ac) return;
    try {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, ac.currentTime);
      gain.gain.setValueAtTime(0.3, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
      osc.start(); osc.stop(ac.currentTime + dur);
    } catch(e) {}
  }

  function bonusSound(ac) {
    if (!ac) return;
    playTone(880, 0.08, 'sine', ac);
    setTimeout(() => playTone(1320, 0.12, 'sine', ac), 80);
  }

  function crashSound(ac) {
    if (!ac) return;
    playTone(120, 0.05, 'sawtooth', ac);
    setTimeout(() => playTone(80, 0.15, 'sawtooth', ac), 50);
    setTimeout(() => playTone(60, 0.25, 'square', ac), 120);
  }

  function gameOverSound(ac) {
    if (!ac) return;
    [440, 370, 330, 220].forEach((f, i) => setTimeout(() => playTone(f, 0.18, 'sawtooth', ac), i * 120));
  }

  function startGame() {
    document.getElementById('overlay').style.display = 'none';
    const ac = AudioCtx();
    game = {
      ac, score: 0, lives: 3, time: 0, running: true,
      baseSpeed: 2.5, speed: 2.5, maxSpeed: 8,
      car: { x: W / 2, y: H - 120, w: 32, h: 54, vx: 0, vy: 0 },
      balls: [], markings: [], grass: [],
      lastBall: 0, ballInterval: 1600,
      lastTime: performance.now(), elapsed: 0,
      roadOffset: 0, flash: 0,
      grassDetails: initGrass()
    };
    for (let i = 0; i < 8; i++) {
      game.markings.push({ y: i * 80 - 40 });
    }
    requestAnimationFrame(loop);
  }

  function initGrass() {
    let details = [];
    for (let i = 0; i < 30; i++) {
      const side = Math.random() < 0.5 ? 'left' : 'right';
      const x = side === 'left'
        ? Math.random() * (ROAD_L - 10) + 5
        : ROAD_R + Math.random() * (W - ROAD_R - 10) + 5;
      details.push({ x, y: Math.random() * H, r: Math.random() * 8 + 4, c: Math.random() });
    }
    return details;
  }

  function spawnBall(g) {
    const now = performance.now();
    if (now - g.lastBall < g.ballInterval) return;
    g.lastBall = now;

    const redCount = g.balls.filter(b => b.type === 'red').length;
    const greenCount = g.balls.filter(b => b.type === 'green').length;

    let type;
    if (greenCount === 0 && Math.random() < 0.4) type = 'green';
    else if (redCount >= 2 && Math.random() < 0.5) type = 'green';
    else type = Math.random() < 0.68 ? 'red' : 'green';

    let col;
    if (type === 'red') {
      const cx = g.car.x;
      const lanes = [ROAD_L + LANE_W * 0.5, ROAD_L + LANE_W * 1.5, ROAD_L + LANE_W * 2.5];
      const freeLanes = lanes.filter(lx => Math.abs(lx - cx) > LANE_W * 0.4);
      const targetLane = freeLanes[Math.floor(Math.random() * freeLanes.length)];
      col = targetLane || lanes[Math.floor(Math.random() * lanes.length)];
    } else {
      const lanes = [ROAD_L + LANE_W * 0.5, ROAD_L + LANE_W * 1.5, ROAD_L + LANE_W * 2.5];
      col = lanes[Math.floor(Math.random() * lanes.length)];
    }

    g.balls.push({ x: col, y: -20, r: 16, type, vy: g.speed * 0.7 + 0.5 });

    g.ballInterval = Math.max(700, 1600 - g.elapsed * 8);
  }

  function loop(ts) {
    if (!game || !game.running) return;
    const dt = Math.min(ts - game.lastTime, 50) / 16.67;
    game.lastTime = ts;
    game.elapsed += dt * 16.67 / 1000;
    game.time += dt * 16.67 / 1000;

    game.speed = Math.min(game.maxSpeed, game.baseSpeed + game.elapsed * 0.04);

    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function update(dt) {
    const g = game;
    const car = g.car;

    let accel = 0, steer = 0;
    if (keys['ArrowUp'])    accel = -1;
    if (keys['ArrowDown'])  accel =  1;
    if (keys['ArrowLeft'])  steer = -1;
    if (keys['ArrowRight']) steer =  1;

    car.vx += steer * 0.45 * dt;
    car.vy += accel * 0.35 * dt;
    car.vx *= 0.82;
    car.vy *= 0.78;
    car.vx = Math.max(-5, Math.min(5, car.vx));
    car.vy = Math.max(-3.5, Math.min(3.5, car.vy));

    car.x += car.vx * dt;
    car.y += car.vy * dt;

    const hw = car.w / 2;
    if (car.x - hw < ROAD_L)   { car.x = ROAD_L + hw;   car.vx = 0; }
    if (car.x + hw > ROAD_R)   { car.x = ROAD_R - hw;   car.vx = 0; }
    if (car.y < 60)             { car.y = 60;             car.vy = 0; }
    if (car.y + car.h > H - 20){ car.y = H - 20 - car.h; car.vy = 0; }

    g.roadOffset = (g.roadOffset + g.speed * dt) % 80;

    g.grassDetails.forEach(d => {
      d.y += g.speed * 0.4 * dt;
      if (d.y > H + 20) d.y = -20;
    });

    spawnBall(g);
    g.balls.forEach(b => { b.y += (b.vy + g.speed * 0.5) * dt; });

    g.balls = g.balls.filter(b => {
      if (b.y > H + 30) return false;
      const dx = b.x - car.x, dy = b.y - (car.y + car.h / 2);
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < b.r + car.w * 0.45) {
        if (b.type === 'green') {
          g.score += 10;
          bonusSound(g.ac);
          g.flash = { color: 'rgba(0,255,100,0.18)', t: 18 };
        } else {
          g.lives--;
          crashSound(g.ac);
          g.flash = { color: 'rgba(255,30,30,0.3)', t: 22 };
          if (g.lives <= 0) { endGame(); return false; }
        }
        return false;
      }
      return true;
    });

    if (g.flash && g.flash.t > 0) g.flash.t--;

    updateHUD();
  }

  function updateHUD() {
    const g = game;
    document.getElementById('scoreDisp').textContent = g.score;
    const m = Math.floor(g.time / 60), s = Math.floor(g.time % 60);
    document.getElementById('timeDisp').textContent = m + ':' + String(s).padStart(2,'0');
    const hearts = ['', '❤️', '❤️❤️', '❤️❤️❤️'][g.lives] || '';
    document.getElementById('livesDisp').textContent = hearts;
    const pct = Math.round(((g.speed - g.baseSpeed) / (g.maxSpeed - g.baseSpeed)) * 70 + 30);
    document.getElementById('speedFill').style.width = Math.min(100, pct) + '%';
  }

  function draw() {
    const g = game;
    ctx.clearRect(0, 0, W, H);

    drawGrass(g);
    drawRoad(g);
    drawMarkings(g);
    drawBalls(g);
    drawCar(g);

    if (g.flash && g.flash.t > 0) {
      ctx.fillStyle = g.flash.color;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawGrass(g) {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#2d5a1b');
    grad.addColorStop(0.5, '#3a7a22');
    grad.addColorStop(1, '#2d5a1b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    g.grassDetails.forEach(d => {
      const col = d.c < 0.3 ? '#4a9a2a' : d.c < 0.6 ? '#3d8520' : '#5ab030';
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();

      if (d.r > 8) {
        ctx.beginPath();
        ctx.arc(d.x + d.r * 0.3, d.y - d.r * 0.2, d.r * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = '#5ab030';
        ctx.fill();
      }
    });

    for (let i = 0; i < 12; i++) {
      const gy = ((i * 55) + g.roadOffset * 0.6) % H;
      ctx.beginPath();
      ctx.arc(20 + Math.sin(i * 2.3) * 12, gy, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = 0.15;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(W - 20 + Math.sin(i * 1.9) * 12, gy, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = 0.12;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawRoad(g) {
    ctx.fillStyle = '#3c3c3c';
    ctx.fillRect(ROAD_L, 0, ROAD_W, H);

    ctx.fillStyle = '#2e2e2e';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(ROAD_L + 1 + i * 0.5, 0, 1, H);
    }

    ctx.strokeStyle = '#f5e642';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(ROAD_L, 0); ctx.lineTo(ROAD_L, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ROAD_R, 0); ctx.lineTo(ROAD_R, H); ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 2;
    ctx.setLineDash([40, 40]);
    ctx.lineDashOffset = -g.roadOffset;
    for (let lane = 1; lane < 3; lane++) {
      const lx = ROAD_L + LANE_W * lane;
      ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, H); ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  function drawMarkings(g) {}

  function drawBalls(g) {
    g.balls.forEach(b => {
      const isRed = b.type === 'red';
      const grad = ctx.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.05, b.x, b.y, b.r);
      if (isRed) {
        grad.addColorStop(0, '#ff7070');
        grad.addColorStop(0.5, '#e02020');
        grad.addColorStop(1, '#8b0000');
      } else {
        grad.addColorStop(0, '#aaffaa');
        grad.addColorStop(0.5, '#22dd44');
        grad.addColorStop(1, '#006622');
      }
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.strokeStyle = isRed ? '#ff0000' : '#00cc44';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fill();

      if (isRed) {
        ctx.font = 'bold 13px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✕', b.x, b.y + 1);
      } else {
        ctx.font = 'bold 13px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+10', b.x, b.y + 1);
      }
    });
  }

  function drawCar(g) {
    const car = g.car;
    const cx = car.x, cy = car.y;
    const cw = car.w, ch = car.h;
    const tilt = car.vx * 0.04;

    ctx.save();
    ctx.translate(cx, cy + ch / 2);
    ctx.rotate(tilt);

    const shadow = ctx.createRadialGradient(0, ch * 0.45, 2, 0, ch * 0.45, cw * 0.8);
    shadow.addColorStop(0, 'rgba(0,0,0,0.45)');
    shadow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.ellipse(0, ch * 0.4, cw * 0.8, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = shadow;
    ctx.fill();

    ctx.fillStyle = '#1a1a2e';
    roundRect(ctx, -cw / 2, -ch / 2, cw, ch, 6);
    ctx.fill();

    ctx.fillStyle = '#e53935';
    roundRect(ctx, -cw / 2 + 2, -ch / 2 + 2, cw - 4, ch - 4, 5);
    ctx.fill();

    ctx.fillStyle = '#c62828';
    roundRect(ctx, -cw / 2 + 4, -ch / 2 + 4, cw - 8, 10, 3);
    ctx.fill();

    ctx.fillStyle = '#aed6f1';
    ctx.globalAlpha = 0.85;
    roundRect(ctx, -cw / 2 + 4, -ch / 2 + 16, cw - 8, 14, 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#1a1a2e';
    roundRect(ctx, -cw / 2 + 4, -ch / 2 + 32, cw - 8, ch - 42, 3);
    ctx.fill();

    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-cw / 2 + 4, -ch / 2 + 39); ctx.lineTo(cw / 2 - 4, -ch / 2 + 39); ctx.stroke();

    ctx.fillStyle = '#333';
    [[-cw / 2 - 3, -ch / 2 + 6], [cw / 2 - 5, -ch / 2 + 6],
     [-cw / 2 - 3, ch / 2 - 14], [cw / 2 - 5, ch / 2 - 14]].forEach(([wx, wy]) => {
      roundRect(ctx, wx, wy, 8, 16, 3);
      ctx.fillStyle = '#333';
      ctx.fill();
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    ctx.fillStyle = '#ffff88';
    ctx.globalAlpha = 0.9;
    roundRect(ctx, -cw / 2 + 3, -ch / 2 + 2, 7, 5, 1);
    ctx.fill();
    roundRect(ctx, cw / 2 - 10, -ch / 2 + 2, 7, 5, 1);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#ff4444';
    roundRect(ctx, -cw / 2 + 3, ch / 2 - 7, 8, 5, 1);
    ctx.fill();
    roundRect(ctx, cw / 2 - 11, ch / 2 - 7, 8, 5, 1);
    ctx.fill();

    const exhaustOn = (g.score + Math.floor(g.elapsed * 20)) % 4 < 2;
    if (exhaustOn) {
      ctx.beginPath();
      ctx.arc(-cw / 2 + 10, ch / 2 + 3, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(200,200,255,0.35)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cw / 2 - 10, ch / 2 + 3, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(200,200,255,0.35)';
      ctx.fill();
    }

    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function endGame() {
    const g = game;
    g.running = false;
    gameOverSound(g.ac);
    const m = Math.floor(g.time / 60), s = Math.floor(g.time % 60);
    const ov = document.getElementById('overlay');
    document.getElementById('overlayTitle').textContent = '💥 GAME OVER';
    document.getElementById('overlayMsg').innerHTML =
      `Vous avez tenu <b>${m}:${String(s).padStart(2,'0')}</b> sur la route.<br>Bonne conduite la prochaine fois !`;
    document.getElementById('startBtn').textContent = 'REJOUER';
    document.getElementById('scoreBoard').style.display = 'block';
    document.getElementById('scoreBoard').textContent = '🏆 Score final : ' + g.score;
    ov.style.display = 'flex';
  }

  window.startGame = startGame;
})();