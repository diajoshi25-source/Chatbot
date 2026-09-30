const chat = document.getElementById('chat');
const chips = document.getElementById('chips');
const form = document.getElementById('composer');
const input = document.getElementById('input');
const sendBtn = document.getElementById('send');
const pup = document.getElementById('pup');
const pupText = document.getElementById('pupText');
const pupils = pup.querySelector('.pupils');
const PLACEHOLDER = input.placeholder;
const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches;

const history = []; // { role: 'user' | 'assistant', content }
let busy = false;

/* ---------- Light / dark mode ---------- */
/* ---------- Modes: light → dark → play (mountain meadow with three pups) ---------- */
const THEMES = ['light', 'dark', 'play'];
document.getElementById('themeToggle').addEventListener('click', () => {
  const now = THEMES.indexOf(document.documentElement.dataset.theme);
  const next = THEMES[(now + 1) % THEMES.length];
  document.documentElement.dataset.theme = next;
  localStorage.setItem('theme', next);
  dispatchEvent(new Event('themechange'));
});

/* ============================================================
   THE PUP
   It sits on top of something (the chat box, a message, a heading…) or at a spot
   you dropped it. It is always kept inside the screen, whatever the size.
   Left alone it falls asleep; hover, click, double-click, drag or type to play.
   ============================================================ */
const DOG_W = 72;
const DOG_H = 66;
// things the pup can sit and walk on when you drop it there
const SPOTS = '.msg .bubble, .chip, .hero h1, .hero p, .tag, .card-head, .composer, .logo, .fineprint, .hero-avatar';

const LOADING_LINES = [
  'Fetching your answer…',
  "Sniffing through Dia's notes…",
  'Wagging while I think…',
  'Digging up the good stuff…',
  'Almost there, pinky promise!',
];
const PET_LINES = ['Aww, thank you!', 'More pets please!', 'Best human ever!', 'That feels nice.'];
const DROP_LINES = ['Sitting right here!', 'Ooh, nice spot.', 'Good view from here!', 'I like it here.'];

const dog = {
  anchor: { el: form, px: -90 }, // sitting on top of an element, px from its left edge…
  free: null, //                    …or at a spot on the screen { x, y }
  pos: { x: -100, y: 0 },
  walk: null,
  trip: null, // running to a treat
  eating: false,
  press: null,
  dragging: false,
  sleeping: false,
  hover: false,
  cursor: null,
};
let idleTimer, patrolTimer, moveTimer, sayTimer, stepTimer, loadingTimer;
let lastReaction = -1;
let lastTypingHello = 0;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function pupSay(text, ms) {
  clearTimeout(sayTimer);
  pupText.textContent = text;
  pupText.classList.toggle('show', Boolean(text));
  if (text && ms) sayTimer = setTimeout(() => pupSay(''), ms);
}

function setPose(pose, face = 'default') {
  pup.dataset.pose = pose;
  pup.dataset.face = face;
}

// one-off moves are just CSS classes (see pup.css), removed again after `ms`
const MOVES = ['r-wave', 'r-tilt', 'r-tilt-r', 'r-bounce', 'r-hop', 'r-jolt', 'r-shy', 'r-ears', 'r-stretch',
  'r-wiggle', 'r-zoom', 'm-heart', 'm-q', 'm-bang', 'moving', 'running', 'sit-down'];

function clearMoves() {
  pup.classList.remove(...MOVES);
}

function play(classes, ms) {
  if (dog.trip || dog.eating) return; // busy with a treat
  clearMoves();
  void pup.offsetWidth; // restart animations even if a class was just removed
  pup.classList.add(...classes);
  clearTimeout(moveTimer);
  moveTimer = setTimeout(() => {
    if (dog.walk || dog.dragging || dog.sleeping) return;
    clearMoves();
    setPose('sit');
  }, ms);
}

function spawnHearts() {
  for (let i = 0; i < 4; i++) {
    const heart = document.createElement('span');
    heart.className = 'heart';
    heart.textContent = i % 2 ? '♡' : '♥';
    heart.style.setProperty('--dx', `${(i - 1.5) * 14}px`);
    heart.style.animationDelay = `${i * 0.12}s`;
    pup.append(heart);
    heart.addEventListener('animationend', () => heart.remove());
  }
}

/* ---------- Sleeping ---------- */
function scheduleIdle(ms = 12000) {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(fallAsleep, ms);
}

function fallAsleep() {
  if (dog.walk || dog.trip || dog.eating || dog.dragging || dog.hover || busy) return scheduleIdle(5000);
  clearMoves();
  setPose('sleep');
  dog.sleeping = true;
  pupSay('');
}

// returns true if it actually had to wake up
function wake(line) {
  if (!dog.sleeping) return false;
  dog.sleeping = false;
  setPose('sit', 'closed');
  play(['r-stretch'], 1100);
  setTimeout(() => { if (!dog.sleeping && pup.dataset.face === 'closed') pup.dataset.face = 'default'; }, 650);
  if (line && !busy) pupSay(line, 2200);
  scheduleIdle();
  return true;
}

/* ---------- Walking along whatever it's sitting on ---------- */
function stopWalking() {
  dog.walk = null;
  clearTimeout(patrolTimer);
  pup.classList.remove('moving', 'running');
}

function walkAlong(px, { speed = 70, run = false, done } = {}) {
  const a = dog.anchor;
  if (!a) return;
  const max = Math.max(0, a.el.getBoundingClientRect().width - DOG_W);
  px = clamp(px, 0, max);
  const dist = Math.abs(px - a.px);
  if (dist < 2) return done?.();
  clearMoves();
  setPose('walk', run ? 'happy' : 'default');
  pup.classList.toggle('face-left', px < a.px);
  pup.classList.add('moving');
  pup.classList.toggle('running', run);
  dog.walk = {
    from: a.px,
    to: px,
    start: performance.now(),
    duration: REDUCED_MOTION ? 1 : (dist / speed) * 1000,
    ease: !run,
    done() {
      pup.classList.remove('moving', 'running');
      setPose('sit');
      done?.();
    },
  };
}

// strolls back and forth along a message / heading it was dropped on, then settles down
function patrol(steps) {
  clearTimeout(patrolTimer);
  const a = dog.anchor;
  if (!a || a.el === form || steps <= 0 || dog.dragging || dog.sleeping || busy) return scheduleIdle(8000);
  const max = a.el.getBoundingClientRect().width - DOG_W;
  if (max < 30) return scheduleIdle(8000); // too small to walk around on
  let px;
  let tries = 0;
  do px = Math.random() * max;
  while (Math.abs(px - a.px) < Math.min(50, max / 2) && ++tries < 10);
  walkAlong(px, { done: () => { patrolTimer = setTimeout(() => patrol(steps - 1), 900 + Math.random() * 1800); } });
}

function zoomies() {
  const a = dog.anchor;
  const max = a ? a.el.getBoundingClientRect().width - DOG_W : 0;
  pupSay('Zoomies!', 1800);
  if (!a || max < 60) {
    setPose('walk', 'happy');
    return play(['moving', 'running', 'r-zoom'], 1500);
  }
  const home = a.px;
  const far = a.px < max / 2 ? max : 0;
  walkAlong(far, {
    speed: 340,
    run: true,
    done: () => walkAlong(home, { speed: 340, run: true, done: () => { setPose('sit', 'happy'); play(['r-hop'], 900); scheduleIdle(); } }),
  });
}

function sittableNow(el) {
  if (!document.contains(el)) return false;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.bottom < 0 || r.top - DOG_H > innerHeight) return false;
  if (chat.contains(el)) {
    // inside the chat, its spot must still be in the visible part of the scroll area
    const c = chat.getBoundingClientRect();
    if (r.top < c.top + 4 || r.top > c.bottom - 4) return false;
  }
  return true;
}

/* ---------- Every frame: work out where the pup is ---------- */
function tick(now) {
  // the thing it sat on scrolled away or disappeared: stay put right where it is
  if (dog.anchor && dog.anchor.el !== form && !sittableNow(dog.anchor.el)) {
    stopWalking();
    dog.anchor = null;
    dog.free = { ...dog.pos };
    if (!dog.sleeping) setPose('sit');
  }

  // running across the screen to a treat
  if (dog.trip) {
    const tr = dog.trip;
    const t = Math.min(1, (now - tr.start) / tr.duration);
    dog.free = {
      x: tr.from.x + (tr.to.x - tr.from.x) * t,
      y: tr.from.y + (tr.to.y - tr.from.y) * t - Math.abs(Math.sin(t * Math.PI * tr.bounces)) * 5,
    };
    if (t >= 1) {
      dog.trip = null;
      tr.done();
    }
  }

  if (dog.walk) {
    const w = dog.walk;
    const t = Math.min(1, (now - w.start) / w.duration);
    const e = w.ease ? (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2) : t;
    dog.anchor.px = w.from + (w.to - w.from) * e;
    if (t >= 1) {
      dog.walk = null;
      w.done();
    }
  }

  let x, y;
  if (dog.anchor) {
    const r = dog.anchor.el.getBoundingClientRect();
    x = r.left + dog.anchor.px;
    y = r.top - DOG_H + 6; // paws overlap the edge a little, like it's really sitting there
  } else {
    ({ x, y } = dog.free);
  }
  // always keep the whole pup on screen, on any screen size
  x = clamp(x, 2, Math.max(2, innerWidth - DOG_W - 2));
  y = clamp(y, 2, Math.max(2, innerHeight - DOG_H - 2));
  dog.pos = { x, y };
  pup.style.transform = `translate(${x}px, ${y}px)`;
  pupText.classList.toggle('left', x > innerWidth - 230);
  pupText.classList.toggle('below', y < 50);

  // eyes follow your cursor while it sits and looks at you
  if (dog.cursor && pup.dataset.pose === 'sit' && pup.dataset.face === 'default') {
    const dx = dog.cursor.x - (x + 36);
    const dy = dog.cursor.y - (y + 26);
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, d / 160);
    const flip = pup.classList.contains('face-left') ? -1 : 1;
    pupils.style.transform = `translate(${((dx / d) * 1.8 * k * flip).toFixed(2)}px, ${((dy / d) * 1.4 * k).toFixed(2)}px)`;
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

addEventListener('pointermove', (e) => { dog.cursor = { x: e.clientX, y: e.clientY }; }, { passive: true });

// Enter once the intro animation is done: trot in along the chat box and say hi
setTimeout(() => {
  walkAlong(40, {
    speed: 90,
    done: () => {
      pupSay("Hi! I'm Dia's pup. Hover, click or drag me!", 3200);
      scheduleIdle(15000);
    },
  });
}, 3700);

/* ---------- Hover: a different reaction every time ---------- */
const REACTIONS = [
  { say: 'Hi hi!', go: () => { setPose('sit'); play(['r-wave'], 1900); } },
  { say: 'I love you!', go: () => { setPose('sit'); play(['r-tilt', 'm-heart'], 1500); spawnHearts(); } },
  { say: 'Hmm? What is it?', go: () => { setPose('sit'); play(['r-tilt-r', 'm-q'], 1500); } },
  { say: 'Hehe, that tickles!', go: () => { setPose('sit', 'happy'); play(['r-bounce'], 1500); } },
  { say: 'Play with me!', go: () => { setPose('bow'); play([], 1700); } },
  { say: 'Huh? Where did you go?', go: () => { setPose('back'); play(['m-bang'], 1200); } },
  { say: 'Pet me, please?', go: () => { setPose('sit', 'sad'); play(['r-shy'], 1700); } },
  { say: 'Zoomies!', go: () => { setPose('walk', 'happy'); play(['moving', 'running', 'r-zoom'], 1500); } },
  { say: 'Woof woof!', go: () => { setPose('sit', 'bark'); play(['r-jolt'], 1300); } },
  { say: 'Blep!', go: () => { setPose('sit', 'blep'); play(['r-tilt'], 1500); } },
  { say: 'Boing boing!', go: () => { setPose('sit', 'happy'); play(['r-hop'], 1600); } },
  { say: 'Ooh, what was that?!', go: () => { setPose('sit'); play(['r-ears'], 1400); } },
  { say: 'Wiggle wiggle!', go: () => { setPose('sit', 'happy'); play(['r-wiggle'], 1600); } },
];

pup.addEventListener('mouseenter', () => {
  dog.hover = true;
  if (dog.dragging || dog.press || dog.trip || dog.eating) return;
  scheduleIdle();
  if (wake("Oh! You're here!")) return;
  stopWalking();
  let i;
  do i = Math.floor(Math.random() * REACTIONS.length);
  while (i === lastReaction);
  lastReaction = i;
  REACTIONS[i].go();
  if (!busy) pupSay(REACTIONS[i].say, 2000);
});

pup.addEventListener('mouseleave', () => {
  dog.hover = false;
  // if it's on a message or heading, it goes back to exploring it after a bit
  if (dog.anchor && dog.anchor.el !== form && !dog.sleeping && !dog.eating) {
    clearTimeout(patrolTimer);
    patrolTimer = setTimeout(() => patrol(2), 2500);
  }
});

/* ---------- Click to pet, double-click for zoomies ---------- */
function pet() {
  if (dog.trip || dog.eating) return;
  scheduleIdle();
  if (wake('Yawn… hi there!')) return;
  stopWalking();
  setPose('sit', 'happy');
  play(['r-bounce', 'm-heart'], 1500);
  spawnHearts();
  if (!busy) pupSay(PET_LINES[Math.floor(Math.random() * PET_LINES.length)], 1800);
}

let lastTap = 0;
function tap() {
  const now = performance.now();
  const double = now - lastTap < 350;
  lastTap = double ? 0 : now;
  if (double && !dog.sleeping) {
    stopWalking();
    zoomies();
  } else {
    pet();
  }
}

/* ---------- Drag: it walks along with your cursor and sits where you let go ---------- */
pup.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  pup.setPointerCapture(e.pointerId);
  dog.press = { x: e.clientX, y: e.clientY, dx: e.clientX - dog.pos.x, dy: e.clientY - dog.pos.y, lastX: e.clientX };
});

pup.addEventListener('pointermove', (e) => {
  const p = dog.press;
  if (!p) return;
  if (!dog.dragging) {
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < 5) return; // still just a click
    dog.dragging = true;
    dog.sleeping = false;
    stopEating();
    stopWalking();
    clearMoves();
    clearTimeout(idleTimer);
    dog.anchor = null;
    dog.free = { ...dog.pos };
    setPose('walk');
    pup.classList.add('dragging');
    if (!busy) pupSay('Walkies!');
  }
  dog.free = { x: e.clientX - p.dx, y: e.clientY - p.dy };
  const moved = e.clientX - p.lastX;
  if (Math.abs(moved) > 1) pup.classList.toggle('face-left', moved < 0);
  p.lastX = e.clientX;
  pup.classList.add('moving');
  clearTimeout(stepTimer);
  stepTimer = setTimeout(() => pup.classList.remove('moving'), 140);
});

function drop() {
  dog.dragging = false;
  clearTimeout(stepTimer);
  pup.classList.remove('dragging', 'moving');

  // is there a message, heading or the chat box right under its paws?
  pup.style.pointerEvents = 'none';
  const cx = dog.pos.x + DOG_W / 2;
  const feet = dog.pos.y + DOG_H;
  const hit = [feet + 4, feet + 18]
    .map((y) => document.elementFromPoint(cx, y)?.closest(SPOTS))
    .find((el) => el && (el === form || sittableNow(el)));
  pup.style.pointerEvents = '';

  setPose('sit');
  play(['sit-down'], 450);
  // it was on its way to a treat: once you let go, it goes right back for it
  if (treat) {
    setTimeout(() => { if (treat && !dog.dragging) goForTreat(); }, 700);
    return;
  }
  if (hit) {
    const r = hit.getBoundingClientRect();
    dog.anchor = { el: hit, px: clamp(dog.pos.x - r.left, 0, Math.max(0, r.width - DOG_W)) };
    dog.free = null;
    if (hit === form) {
      if (!busy) pupSay('Back to my comfy spot!', 1800);
      scheduleIdle();
    } else {
      if (!busy) pupSay('Ooh, something to explore!', 1800);
      patrolTimer = setTimeout(() => patrol(3 + Math.floor(Math.random() * 3)), 1400);
    }
  } else {
    if (!busy) pupSay(DROP_LINES[Math.floor(Math.random() * DROP_LINES.length)], 1800);
    scheduleIdle();
  }
}

pup.addEventListener('pointerup', () => {
  const wasDrag = dog.dragging;
  dog.press = null;
  if (wasDrag) drop();
  else tap();
});
pup.addEventListener('pointercancel', () => {
  dog.press = null;
  if (dog.dragging) drop();
});

/* ---------- Double-click anywhere: drop a treat, the pup runs over and eats it ---------- */
const TREAT_SVG = `
  <svg viewBox="0 0 34 18" width="34" height="18" aria-hidden="true">
    <g class="bite bite-l"><circle cx="6" cy="5" r="4.5"/><circle cx="6" cy="13" r="4.5"/></g>
    <g class="bite bite-m"><rect x="6" y="5" width="22" height="8" rx="3"/></g>
    <g class="bite bite-r"><circle cx="28" cy="5" r="4.5"/><circle cx="28" cy="13" r="4.5"/></g>
  </svg>`;
let treat = null; // { el, x, y }
let biteTimer;

function dropTreat(x, y) {
  treat?.el.remove();
  const el = document.createElement('div');
  el.className = 'treat';
  el.innerHTML = TREAT_SVG;
  x = clamp(x, 24, innerWidth - 24);
  y = clamp(y, 24, innerHeight - 12);
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  document.body.append(el);
  treat = { el, x, y };
}

function goForTreat() {
  if (!treat || dog.dragging) return;
  stopEating();
  stopWalking();
  clearMoves();
  clearTimeout(idleTimer);
  dog.sleeping = false;
  dog.anchor = null;
  dog.free = { ...dog.pos };

  // stop with its nose right at the treat, on whichever side it's coming from
  const fromLeft = dog.pos.x + DOG_W / 2 < treat.x;
  const to = {
    x: fromLeft ? treat.x - 64 : treat.x - 8,
    y: treat.y + 8 - DOG_H,
  };
  const dist = Math.hypot(to.x - dog.pos.x, to.y - dog.pos.y);
  setPose('walk', 'happy');
  pup.classList.toggle('face-left', !fromLeft);
  pup.classList.add('moving', 'running');
  if (!busy) pupSay(dist > 80 ? 'A treat?! Coming!' : 'Ooh, a treat!', 1600);

  dog.trip = {
    from: { ...dog.pos },
    to,
    start: performance.now(),
    duration: REDUCED_MOTION ? 1 : Math.max(350, (dist / 300) * 1000),
    bounces: Math.max(1, Math.round(dist / 60)),
    done: () => eatTreat(fromLeft),
  };
}

function eatTreat(fromLeft) {
  pup.classList.remove('running', 'moving');
  if (!treat) return;
  dog.eating = true;
  pup.classList.add('eating');
  if (!busy) pupSay('Nom nom nom…');
  // three bites, starting from the side it's standing on
  const order = fromLeft ? ['l', 'm', 'r'] : ['r', 'm', 'l'];
  let n = 0;
  const bite = () => {
    if (!treat) return stopEating();
    treat.el.querySelector(`.bite-${order[n]}`).classList.add('gone');
    crumbs(treat.x + (fromLeft ? -8 : 8), treat.y);
    n += 1;
    if (n < order.length) {
      biteTimer = setTimeout(bite, 620);
      return;
    }
    biteTimer = setTimeout(() => {
      treat?.el.remove();
      treat = null;
      stopEating();
      setPose('sit', 'happy');
      play(['r-hop', 'm-heart'], 1400);
      spawnHearts();
      if (!busy) pupSay('Yum! Thank you!', 2000);
      scheduleIdle();
    }, 450);
  };
  biteTimer = setTimeout(bite, 500);
}

function stopEating() {
  clearTimeout(biteTimer);
  dog.trip = null;
  dog.eating = false;
  pup.classList.remove('eating', 'running', 'moving');
}

function crumbs(x, y) {
  for (let i = 0; i < 5; i++) {
    const c = document.createElement('span');
    c.className = 'crumb';
    c.style.left = `${x}px`;
    c.style.top = `${y}px`;
    c.style.setProperty('--cx', `${(Math.random() - 0.5) * 34}px`);
    c.style.setProperty('--cy', `${-8 - Math.random() * 14}px`);
    document.body.append(c);
    c.addEventListener('animationend', () => c.remove());
  }
}

document.addEventListener('dblclick', (e) => {
  if (!e.isTrusted) return; // only a real double-click from you drops a treat
  // not on a pup itself (that's zoomies) or while typing / pressing buttons
  if (e.target.closest('.pup, input, textarea, button, a')) return;
  getSelection()?.removeAllRanges(); // double-click would otherwise highlight a word
  if (document.documentElement.dataset.theme === 'play') return packTreat(e.clientX);
  dropTreat(e.clientX, e.clientY);
  goForTreat();
});

/* ---------- It notices when you type ---------- */
input.addEventListener('input', () => {
  scheduleIdle();
  if (busy || dog.dragging || dog.trip || dog.eating) return;
  if (wake('Ooh, what are you asking?')) return;
  if (!dog.walk && performance.now() - lastTypingHello > 20000) {
    lastTypingHello = performance.now();
    setPose('sit');
    play(['r-ears'], 1300);
    pupSay('Ooh, what are you asking?', 1800);
  }
});

/* ---------- Loading state ---------- */
function setThinking(on) {
  document.body.classList.toggle('thinking', on);
  clearInterval(loadingTimer);
  if (!on) {
    input.placeholder = PLACEHOLDER;
    pupSay('');
    if (!dog.dragging && !dog.trip && !dog.eating) {
      setPose('sit', 'happy');
      play(['r-bounce'], 900);
    }
    scheduleIdle();
    return;
  }
  // wide awake and sitting still while the answer loads
  clearTimeout(idleTimer);
  if (!wake() && !dog.dragging && !dog.trip && !dog.eating) {
    stopWalking();
    setPose('sit');
  }
  let i = Math.floor(Math.random() * LOADING_LINES.length);
  pupSay(LOADING_LINES[i]);
  input.placeholder = 'Hang tight…';
  loadingTimer = setInterval(() => {
    i = (i + 1) % LOADING_LINES.length;
    pupSay(LOADING_LINES[i]);
  }, 1800);
}

/* ---------- Chat ---------- */
function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// Light formatting for bot replies: **bold**, clickable links and emails.
function format(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(https?:\/\/[^\s)]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
    .replace(/([\w.+-]+@[\w-]+\.[\w.]+)/g, '<a href="mailto:$1">$1</a>');
}

function addMessage(role, html, extraClass = '') {
  const row = document.createElement('div');
  row.className = `msg ${role} ${extraClass}`.trim();
  if (role === 'bot') {
    const img = document.createElement('img');
    img.src = 'avatar.svg';
    img.alt = '';
    img.className = 'mini-avatar';
    row.append(img);
  }
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = html;
  row.append(bubble);
  chat.append(row);
  chat.scrollTop = chat.scrollHeight;
  return row;
}

async function send(text) {
  text = text.trim();
  if (!text || busy) return;
  busy = true;
  sendBtn.disabled = true;
  input.value = '';
  chips?.remove();

  addMessage('user', escapeHtml(text));
  history.push({ role: 'user', content: text });
  const typing = addMessage('bot', '<span class="typing"><span></span><span></span><span></span></span>');
  setThinking(true);

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: history }),
    });
    const data = await res.json().catch(() => ({}));
    typing.remove();
    if (!res.ok || !data.reply) throw new Error(data.error);
    history.push({ role: 'assistant', content: data.reply });
    addMessage('bot', format(data.reply));
  } catch (err) {
    typing.remove();
    history.pop(); // let them retry the same question
    addMessage('bot', escapeHtml(err.message || 'Oops, I got a little tangled up there. Mind asking me again?'), 'error');
  } finally {
    setThinking(false);
    busy = false;
    sendBtn.disabled = !input.value.trim();
    input.focus();
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  send(input.value);
});

input.addEventListener('input', () => {
  sendBtn.disabled = busy || !input.value.trim();
});

document.querySelectorAll('.chip').forEach((chip) => {
  chip.addEventListener('click', () => send(chip.textContent));
});

sendBtn.disabled = true;
