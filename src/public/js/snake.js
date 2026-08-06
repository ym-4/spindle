/* global fetchMethod, currentUrl*/

// snake.js — Spindle Snake mini game
function feedApiBase() {
  if (typeof currentUrl !== 'undefined' && currentUrl) return currentUrl;
  if (typeof getApiBase === 'function') {
    const base = getApiBase();
    if (base) return base;
  }
  return window.location.origin || '';
}

(function () {
  const GRID = 20;
  const CELL = 20;
  const BASE_SPEED = 150;
  const MAX_LB = 10;

  let snake, dir, nextDir, food, score, level, hiScore;
  let gameLoop, paused, running;
  let canvas, ctx;

  function init() {
    canvas = document.getElementById('snakeCanvas');
    ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    document.getElementById('snakePlayBtn')?.addEventListener('click', openGame);

    document.getElementById('snakeQuitBtn')?.addEventListener('click', closeGame);

    document.getElementById('snakeOverlayQuit')?.addEventListener('click', closeGame);

    document.getElementById('snakeRestartBtn')?.addEventListener('click', startRound);

    document
      .getElementById('snakeViewLeaderboardBtn')
      ?.addEventListener('click', () => showLeaderboardOverlay(true));

    document
      .getElementById('snakeOverlayViewLeaderboardBtn')
      ?.addEventListener('click', () => showLeaderboardOverlay(false));

    document
      .getElementById('snakeLeaderboardBackBtn')
      ?.addEventListener('click', hideLeaderboardOverlay);

    document.addEventListener('keydown', handleKey);

    // Show high score on card
    refreshCardScore();
  }

  // Open / close modal
  function openGame() {
    document.getElementById('snakeModalOverlay').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    startRound();
  }

  function closeGame() {
    stopLoop();
    document.getElementById('snakeModalOverlay').style.display = 'none';
    document.body.style.overflow = '';
    refreshCardScore();
  }

  // Start / reset a round
  function startRound() {
    document.getElementById('snakeOverlay').style.display = 'none';
    stopLoop();

    snake = [{ x: 10, y: 10 }];
    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };
    score = 0;
    level = 1;
    paused = false;
    running = true;

    placeFood();
    updateHUD();
    gameLoop = setInterval(tick, speed());
  }

  // Game tick
  function tick() {
    if (paused || !running) return;

    dir = { ...nextDir };

    const head = {
      x: snake[0].x + dir.x,
      y: snake[0].y + dir.y,
    };

    // Wall collision
    if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) {
      return gameOver();
    }

    // Self collision
    if (snake.some((s) => s.x === head.x && s.y === head.y)) {
      return gameOver();
    }

    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
      score++;
      level = Math.floor(score / 5) + 1;
      placeFood();
      // Speed up every 5 points
      stopLoop();
      gameLoop = setInterval(tick, speed());
    } else {
      snake.pop();
    }

    updateHUD();
    draw();
  }

  // Game over
  function gameOver() {
    running = false;
    stopLoop();

    saveScore(score).then((isNewBest) => {
      document.getElementById('snakeOverlayTitle').textContent = isNewBest
        ? 'New High Score!'
        : 'GAME 💀 OVER';
      document.getElementById('snakeOverlayScore').textContent =
        `Score: ${score}  ·  Level: ${level}`;
      document.getElementById('snakeOverlay').style.display = 'flex';

      renderLeaderboard();
      refreshCardScore();
    });
  }

  // Drawing
  function draw() {
    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid dots
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    for (let x = 0; x < GRID; x++) {
      for (let y = 0; y < GRID; y++) {
        ctx.fillRect(x * CELL + CELL / 2 - 1, y * CELL + CELL / 2 - 1, 2, 2);
      }
    }

    // Food
    ctx.fillStyle = '#e02020';
    ctx.beginPath();
    ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL / 2 - 2, 0, Math.PI * 2);
    ctx.fill();

    // Snake
    snake.forEach((seg, i) => {
      const ratio = 1 - (i / snake.length) * 0.5;
      ctx.fillStyle =
        i === 0
          ? '#59b5b0'
          : `rgba(${Math.round(95 * ratio)}, ${Math.round(184 * ratio)}, ${Math.round(179 * ratio)}, 0.95)`;
      const pad = i === 0 ? 1 : 2;
      ctx.beginPath();
      ctx.roundRect(
        seg.x * CELL + pad,
        seg.y * CELL + pad,
        CELL - pad * 2,
        CELL - pad * 2,
        i === 0 ? 5 : 3,
      );
      ctx.fill();
    });
  }

  // HUD
  function updateHUD() {
    document.getElementById('snakeLiveScore').textContent = score;
    document.getElementById('snakeLiveBest').textContent = Math.max(hiScore || 0, score);
    document.getElementById('snakeLiveLevel').textContent = level;
  }

  function refreshCardScore() {
    getPersonalBest().then((best) => {
      hiScore = best;
      const el = document.getElementById('snakeHighScoreDisplay');
      if (el) el.textContent = hiScore;
    });
  }

  function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return token
      ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      : { 'Content-Type': 'application/json' };
  }

  function getCurrentUserId() {
    try {
      const u = JSON.parse(localStorage.getItem('pineappleUser') || '{}');
      return u.id ?? u.user_id ?? null;
    } catch {
      return null;
    }
  }

  async function getPersonalBest() {
    if (!getCurrentUserId()) return 0; // guest mode: no high scores saved
    try {
      const res = await fetch(`${feedApiBase()}/snake/score`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return 0;
      const data = await res.json();
      return data.best_score ?? 0;
    } catch {
      return 0;
    }
  }

  // new personal best
  async function saveScore(newScore) {
    if (!newScore || !getCurrentUserId()) return false;
    try {
      const res = await fetch(`${feedApiBase()}/snake/score`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ score: newScore }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      hiScore = data.best_score ?? hiScore;
      return !!data.is_new_best;
    } catch {
      return false;
    }
  }

  async function renderLeaderboard() {
    const el = document.getElementById('snakeLeaderboard');
    if (!el) return;

    el.innerHTML = '<li class="snake-lb-empty">Loading…</li>';

    let lb = [];
    try {
      const res = await fetch(`${feedApiBase()}/snake/leaderboard`);
      if (res.ok) lb = await res.json();
    } catch {
      lb = [];
    }

    if (!lb.length) {
      el.innerHTML = '<li class="snake-lb-empty">No scores yet</li>';
      return;
    }

    const myId = getCurrentUserId();

    el.innerHTML = lb
      .slice(0, MAX_LB)
      .map((entry, i) => {
        const isMe = myId !== null && entry.user_id === myId;
        const name = entry.display_name || entry.name || 'Player';
        return `
        <li class="${isMe ? 'snake-lb-me' : ''}">
          <span class="snake-lb-rank">#${i + 1}</span>
          <span class="snake-lb-name">${escName(name)}</span>
          <span class="snake-lb-score">${entry.best_score}</span>
        </li>`;
      })
      .join('');
  }

  // Input
  function handleKey(e) {
    const modal = document.getElementById('snakeModalOverlay');
    if (!modal || modal.style.display === 'none') return;
    if (isLeaderboardOpen()) return;

    const map = {
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      w: { x: 0, y: -1 },
      s: { x: 0, y: 1 },
      a: { x: -1, y: 0 },
      d: { x: 1, y: 0 },
    };

    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      if (!running) return;
      paused = !paused;
      if (paused) {
        document.getElementById('snakeOverlayTitle').textContent = '⏸ Paused';
        document.getElementById('snakeOverlayScore').textContent = `Score: ${score}`;
        document.getElementById('snakeRestartBtn').textContent = '▶ Resume';
        document.getElementById('snakeOverlay').style.display = 'flex';
        document.getElementById('snakeRestartBtn').onclick = resumeGame;
      }
      e.preventDefault();
      return;
    }

    const newDir = map[e.key];
    if (!newDir) return;
    e.preventDefault();

    // Prevent reversing
    if (newDir.x === -dir.x && newDir.y === -dir.y) return;
    nextDir = newDir;
  }

  function resumeGame() {
    paused = false;
    document.getElementById('snakeOverlay').style.display = 'none';
    document.getElementById('snakeRestartBtn').textContent = '▶ Play again';
    document.getElementById('snakeRestartBtn').onclick = startRound;
  }

  let leaderboardOpenedDuringPlay = false;

  function isLeaderboardOpen() {
    const el = document.getElementById('snakeLeaderboardView');
    return !!el && el.style.display !== 'none';
  }

  function showLeaderboardOverlay(openedDuringPlay) {
    leaderboardOpenedDuringPlay = !!openedDuringPlay;
    if (leaderboardOpenedDuringPlay && running) {
      paused = true;
    }
    document.getElementById('snakeLeaderboardView').style.display = 'flex';
    renderLeaderboard();
  }

  function hideLeaderboardOverlay() {
    document.getElementById('snakeLeaderboardView').style.display = 'none';

    if (leaderboardOpenedDuringPlay) {
      paused = false;
    }
  }

  // Helpers
  function placeFood() {
    let pos;
    do {
      pos = {
        x: Math.floor(Math.random() * GRID),
        y: Math.floor(Math.random() * GRID),
      };
    } while (snake.some((s) => s.x === pos.x && s.y === pos.y));
    food = pos;
    draw();
  }

  function speed() {
    const level = Math.floor(score / 8);
    return Math.max(105, BASE_SPEED - level * 7);
  }

  function stopLoop() {
    if (gameLoop) {
      clearInterval(gameLoop);
      gameLoop = null;
    }
  }

  function escName(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
