/* ============================================================
   PLAY MODE: three pups playing on the grass.
   Snowy (small white Lhasa), Smokey (medium grey Lhasa), Biscuit (big beige Lab).
   They chase each other, play-bow, sniff, nap and do zoomies on their own.
   Hover or click them to play; double-click anywhere to throw a treat and they race for it.
   Uses the shared drawings from the main pup (index.html) plus helpers from app.js.
   ============================================================ */
(() => {
  const SPECS = [
    { name: 'Snowy', breed: 'lhasa-white', scale: 0.8, speed: 1, lane: 4 },
    { name: 'Smokey', breed: 'lhasa-grey', scale: 1, speed: 1.1, lane: 16 },
    { name: 'Biscuit', breed: 'lab', scale: 1.3, speed: 1.2, lane: 28 },
  ];
  const ALL_MOVES = [...MOVES, 'eating']; // MOVES comes from app.js
  const isPlay = () => document.documentElement.dataset.theme === 'play';
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const shuffle = (list) => [...list].sort(() => Math.random() - 0.5);

  /* ---------- Make the three pups from the main pup's drawings ---------- */
  const template = document.getElementById('pup');
  const pack = SPECS.map((spec, i) => {
    const el = template.cloneNode(true);
    el.removeAttribute('id');
    el.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
    el.querySelectorAll('.heart').forEach((n) => n.remove());
    el.className = 'pup buddy';
    el.dataset.breed = spec.breed;
    el.dataset.pose = 'sit';
    el.dataset.face = 'default';
    el.style.setProperty('--s', spec.scale);
    el.style.zIndex = 45 - i; // the small one runs in front
    document.body.append(el);
    const bubble = el.querySelector('.pup-bubble');
    bubble.classList.remove('show');
    bubble.textContent = '';
    return { ...spec, el, bubble, x: 60 + i * 150, target: null, run: false, onArrive: null, chasing: null, busyUntil: 0, sleeping: false, eating: false };
  });

  const width = (d) => 72 * d.scale;
  const feetY = (d) => innerHeight - 20 - d.lane; // where its paws touch the grass
  const clampX = (d, x) => Math.max(4, Math.min(innerWidth - width(d) - 4, x));

  function setPose(d, pose, face = 'default') {
    d.el.dataset.pose = pose;
    d.el.dataset.face = face;
  }

  function say(d, text, ms = 1800) {
    clearTimeout(d.sayTimer);
    d.bubble.textContent = text;
    d.bubble.classList.toggle('show', Boolean(text));
    if (text) d.sayTimer = setTimeout(() => d.bubble.classList.remove('show'), ms);
  }

  function faceTowards(d, x) {
    d.el.classList.toggle('face-left', x < d.x);
  }

  // a one-off move (same CSS classes as the main pup), then back to sitting
  function act(d, pose, face, classes = [], ms = 1500, then) {
    d.target = null;
    d.chasing = null;
    d.el.classList.remove(...ALL_MOVES);
    void d.el.offsetWidth;
    setPose(d, pose, face);
    d.el.classList.add(...classes);
    d.busyUntil = performance.now() + ms;
    clearTimeout(d.moveTimer);
    d.moveTimer = setTimeout(() => {
      d.el.classList.remove(...ALL_MOVES);
      if (!d.sleeping && !d.eating) setPose(d, 'sit');
      then?.();
    }, ms);
  }

  function goTo(d, x, { run = false, done } = {}) {
    d.sleeping = false;
    clearTimeout(d.moveTimer);
    d.el.classList.remove(...ALL_MOVES);
    d.target = clampX(d, x);
    d.run = run;
    d.onArrive = done;
    setPose(d, 'walk', run ? 'happy' : 'default');
    d.el.classList.add('moving');
    d.el.classList.toggle('running', run);
  }

  function hearts(d) {
    for (let i = 0; i < 3; i++) {
      const h = document.createElement('span');
      h.className = 'heart';
      h.textContent = i % 2 ? '♡' : '♥';
      h.style.setProperty('--dx', `${(i - 1) * 14}px`);
      h.style.animationDelay = `${i * 0.12}s`;
      d.el.append(h);
      h.addEventListener('animationend', () => h.remove());
    }
  }

  /* ---------- Things they do together ---------- */
  function chase(chaser, runner) {
    const far = runner.x < innerWidth / 2 ? rand(innerWidth * 0.6, innerWidth - 90) : rand(10, innerWidth * 0.35);
    say(runner, pick(['Catch me!', "Can't catch me!", 'Wheee!']));
    goTo(runner, far, {
      run: true,
      done: () => {
        faceTowards(runner, chaser.x);
        act(runner, 'bow', 'default', [], 1700);
      },
    });
    goTo(chaser, far, { run: true });
    chaser.chasing = runner;
  }

  function playBow(a, b) {
    faceTowards(a, b.x);
    faceTowards(b, a.x);
    act(a, 'bow', 'default', [], 1800);
    say(a, 'Play with me!');
    setTimeout(() => { if (!b.target && !b.eating) { act(b, 'sit', 'happy', ['r-hop'], 1500); say(b, 'Okay!'); } }, 500);
  }

  function sniff(d) {
    act(d, 'walk', 'default', ['eating'], 1800);
    say(d, pick(['Sniff sniff…', 'What is this?', 'Smells like grass.']));
  }

  function nap(d) {
    act(d, 'sleep', 'default', [], 60000);
    d.sleeping = true;
    d.napTimer = setTimeout(() => wake(d), rand(6000, 10000));
  }

  function wake(d, line) {
    if (!d.sleeping) return false;
    clearTimeout(d.napTimer);
    d.sleeping = false;
    act(d, 'sit', 'closed', ['r-stretch'], 1100);
    if (line) say(d, line, 2000);
    return true;
  }

  function zoomies(dogs) {
    dogs.forEach((d) => {
      const home = d.x;
      goTo(d, rand(10, innerWidth - 100), { run: true, done: () => goTo(d, home, { run: true, done: () => act(d, 'sit', 'happy', ['r-hop'], 900) }) });
    });
    say(dogs[0], 'Zoomies!');
  }

  const free = (d) => !d.target && !d.chasing && !d.sleeping && !d.eating && performance.now() > d.busyUntil;

  // every so often, idle pups pick something fun to do
  setInterval(() => {
    if (!isPlay() || treatRace) return;
    const idle = pack.filter(free);
    if (!idle.length) return;
    const r = Math.random();
    const [a, b] = shuffle(idle);
    if (b && r < 0.35) chase(a, b);
    else if (b && r < 0.5) playBow(a, b);
    else if (r < 0.64) goTo(a, rand(10, innerWidth - 100));
    else if (r < 0.74) sniff(a);
    else if (r < 0.8 && !pack.some((d) => d.sleeping)) nap(a);
    else if (r < 0.92) act(a, 'sit', pick(['happy', 'blep', 'bark']), [pick(['r-wiggle', 'r-bounce', 'r-jolt', 'r-ears'])], 1500);
    else if (idle.length === pack.length) zoomies(idle);
  }, 1700);

  /* ---------- Every frame: move them along the grass ---------- */
  let last = performance.now();
  let wasThinking = false;
  function tick(now) {
    const dt = Math.min(50, now - last) / 1000;
    last = now;
    if (isPlay()) {
      for (const d of pack) {
        // chasing: keep aiming just behind the runner, then pounce when it stops
        if (d.chasing) {
          const r = d.chasing;
          const behind = r.x + (d.x < r.x ? -width(d) - 8 : width(r) + 8);
          d.target = clampX(d, behind);
          if (!r.target && Math.abs(d.x - d.target) < 3) {
            d.chasing = null;
            d.el.classList.remove('moving', 'running');
            faceTowards(d, r.x);
            act(d, 'sit', 'happy', ['r-hop', 'm-heart'], 1400);
            say(d, 'Got you!');
          }
        }
        if (d.target != null) {
          const speed = (d.run ? 210 : 75) * d.speed;
          const dx = d.target - d.x;
          if (Math.abs(dx) <= speed * dt) {
            d.x = d.target;
            d.target = null;
            if (!d.chasing) {
              d.el.classList.remove('moving', 'running');
              setPose(d, 'sit');
              const done = d.onArrive;
              d.onArrive = null;
              done?.();
            }
          } else {
            d.x += Math.sign(dx) * speed * dt;
            d.el.classList.toggle('face-left', dx < 0);
          }
        }
        d.x = clampX(d, d.x);
        d.el.style.transform = `translate(${d.x}px, ${feetY(d) - 66 * d.scale}px) scale(${d.scale})`;
        d.bubble.classList.toggle('left', d.x > innerWidth - 220);
      }

      // while an answer loads, Snowy keeps you company with the loading lines
      const thinking = document.body.classList.contains('thinking');
      if (thinking) {
        pack[0].bubble.textContent = pupText.textContent; // pupText comes from app.js
        pack[0].bubble.classList.add('show');
      } else if (wasThinking) {
        pack[0].bubble.classList.remove('show');
      }
      wasThinking = thinking;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  /* ---------- Hover and click ---------- */
  const REACTIONS = [
    { say: (d) => `Hi! I'm ${d.name}!`, go: (d) => act(d, 'sit', 'default', ['r-wave'], 1800) },
    { say: () => 'Hehe!', go: (d) => act(d, 'sit', 'happy', ['r-bounce'], 1400) },
    { say: () => 'Play with me!', go: (d) => act(d, 'bow', 'default', [], 1600) },
    { say: () => 'Hmm?', go: (d) => act(d, 'sit', 'default', ['r-tilt-r', 'm-q'], 1500) },
    { say: () => 'Woof!', go: (d) => act(d, 'sit', 'bark', ['r-jolt'], 1200) },
    { say: () => 'Blep!', go: (d) => act(d, 'sit', 'blep', ['r-tilt'], 1400) },
    { say: () => 'Boing!', go: (d) => act(d, 'sit', 'happy', ['r-hop'], 1500) },
    { say: () => 'Where did you go?', go: (d) => act(d, 'back', 'default', ['m-bang'], 1200) },
    { say: () => 'Pet me?', go: (d) => act(d, 'sit', 'sad', ['r-shy'], 1600) },
    { say: () => 'Wiggle wiggle!', go: (d) => act(d, 'sit', 'happy', ['r-wiggle'], 1500) },
  ];

  pack.forEach((d) => {
    d.el.addEventListener('mouseenter', () => {
      if (d.eating || treatRace) return;
      if (wake(d, `Yawn… I'm ${d.name}!`)) return;
      let r;
      do r = pick(REACTIONS);
      while (r === d.lastReaction);
      d.lastReaction = r;
      r.go(d);
      say(d, r.say(d));
    });
    d.el.addEventListener('click', () => {
      if (d.eating || treatRace) return;
      if (wake(d, 'Yawn… hi!')) return;
      act(d, 'sit', 'happy', ['r-bounce', 'm-heart'], 1500);
      hearts(d);
      say(d, pick(['Aww, thanks!', 'More pets!', 'You are the best!']));
    });
  });

  /* ---------- Treat race (double-click anywhere in play mode) ---------- */
  let treatRace = null; // { winner }

  window.packTreat = (clickX) => {
    if (treatRace) return;
    treatRace = { winner: null };
    const front = pack[0];
    dropTreat(clickX, feetY(front) - 8); // dropTreat + treat come from app.js
    const tx = treat.x;
    pack.forEach((d) => {
      clearTimeout(d.napTimer);
      d.sleeping = false;
      d.chasing = null;
      const fromLeft = d.x + width(d) / 2 < tx;
      const stop = fromLeft ? tx - 64 * d.scale : tx - 8 * d.scale;
      say(d, pick(['Treat!', 'Mine!', 'Ooh!']), 1200);
      goTo(d, stop, { run: true, done: () => arrive(d, fromLeft) });
    });
  };

  function arrive(d, fromLeft) {
    if (!treatRace || !treat) return;
    faceTowards(d, treat.x);
    if (treatRace.winner) {
      act(d, 'sit', 'sad', ['r-shy'], 2200);
      say(d, pick(['Aww…', 'No fair!', 'Next one is mine!']), 2000);
      return;
    }
    // first one there gets it: the treat hops to its lane and it munches away
    treatRace.winner = d;
    d.eating = true;
    treat.el.style.top = `${feetY(d) - 8}px`;
    setPose(d, 'walk', 'happy');
    d.el.classList.add('eating');
    say(d, 'Nom nom nom…', 2400);
    const order = fromLeft ? ['l', 'm', 'r'] : ['r', 'm', 'l'];
    order.forEach((side, i) => {
      setTimeout(() => {
        if (!treat) return;
        treat.el.querySelector(`.bite-${side}`).classList.add('gone');
        crumbs(treat.x + (fromLeft ? -8 : 8), feetY(d) - 8); // crumbs comes from app.js
      }, 500 + i * 620);
    });
    setTimeout(() => {
      treat?.el.remove();
      treat = null;
      d.eating = false;
      d.el.classList.remove('eating');
      act(d, 'sit', 'happy', ['r-hop', 'm-heart'], 1400);
      hearts(d);
      say(d, 'Yum! Thank you!');
      treatRace = null;
    }, 500 + order.length * 620 + 300);
  }

  // leaving play mode: tidy up any treat that's still lying on the grass
  addEventListener('themechange', () => {
    if (isPlay() || !treatRace) return;
    treat?.el.remove();
    treat = null;
    treatRace = null;
    pack.forEach((d) => { d.eating = false; d.target = null; d.el.classList.remove(...ALL_MOVES); setPose(d, 'sit'); });
  });
})();
