(() => {
  'use strict';

  /* Settings you can edit */
  const CONFIG = {
    snowStart: 8,          // flakes on screen when the page opens
    snowRampSeconds: 120,  // seconds until the snowfall reaches full strength
    defaultVolume: 0.4     // 0 (silent) to 1 (full)
  };

  const KEY_CURSOR = 'thedoftoca.cursor';
  const KEY_SNOW = 'thedoftoca.snow';
  const KEY_MUSIC = 'thedoftoca.music';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const store = {
    get(key) {
      try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
    },
    del(key) {
      try { localStorage.removeItem(key); } catch { /* ignore */ }
    }
  };

  const svgURI = (svg) => 'data:image/svg+xml,' + encodeURIComponent(svg);
  const $ = (id) => document.getElementById(id);
  const root = document.documentElement;
  const status = $('status');

  function say(message) { status.textContent = message; }

  /* ---------- Avatar (set by you in index.html, not by visitors) ---------- */

  const avatarImg = $('avatar');
  const FALLBACK_AVATAR = svgURI(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">' +
    '<rect width="200" height="200" fill="#162038"/>' +
    '<circle cx="100" cy="78" r="36" fill="#E8ECF4"/>' +
    '<path d="M28 200c0-46 32-74 72-74s72 28 72 74z" fill="#E8ECF4"/></svg>'
  );

  function useFallbackAvatar() {
    if (avatarImg.src !== FALLBACK_AVATAR) avatarImg.src = FALLBACK_AVATAR;
  }

  avatarImg.addEventListener('error', useFallbackAvatar);
  if (avatarImg.complete && avatarImg.naturalWidth === 0) useFallbackAvatar();

  /* ---------- Snow: starts light and builds up over time ---------- */

  const canvas = $('snow');
  const ctx = canvas.getContext('2d');
  const snow = { flakes: [], on: false, raf: 0, last: 0, elapsed: 0, w: 0, h: 0, max: 0 };

  function sizeSnow() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    snow.w = window.innerWidth;
    snow.h = window.innerHeight;
    canvas.width = Math.round(snow.w * dpr);
    canvas.height = Math.round(snow.h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    snow.max = Math.round(Math.min(320, Math.max(90, (snow.w * snow.h) / 5000)));
  }

  function newFlake() {
    const r = 1.5 + Math.random() * 3.2;
    return {
      x: Math.random() * snow.w,
      y: -r - Math.random() * snow.h * 0.3,
      r,
      vy: 28 + r * 13 + Math.random() * 10,
      sway: 8 + Math.random() * 18,
      phase: Math.random() * Math.PI * 2,
      speed: 0.4 + Math.random() * 0.8,
      alpha: 0.55 + Math.random() * 0.4
    };
  }

  function targetCount() {
    const progress = Math.min(1, snow.elapsed / CONFIG.snowRampSeconds);
    return Math.round(CONFIG.snowStart + (snow.max - CONFIG.snowStart) * progress);
  }

  function snowFrame(now) {
    const dt = Math.min(0.05, (now - snow.last) / 1000);
    snow.last = now;
    snow.elapsed += dt;

    const target = targetCount();
    while (snow.flakes.length < target) snow.flakes.push(newFlake());

    ctx.clearRect(0, 0, snow.w, snow.h);
    ctx.fillStyle = '#fff';

    for (const f of snow.flakes) {
      f.y += f.vy * dt;
      f.phase += f.speed * dt;
      if (f.y - f.r > snow.h) Object.assign(f, newFlake());
      ctx.globalAlpha = f.alpha;
      ctx.beginPath();
      ctx.arc(f.x + Math.sin(f.phase) * f.sway, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    snow.raf = requestAnimationFrame(snowFrame);
  }

  function startSnow() {
    if (snow.on) return;
    snow.on = true;
    snow.elapsed = 0;
    snow.flakes = [];
    snow.last = performance.now();
    sizeSnow();
    snow.raf = requestAnimationFrame(snowFrame);
  }

  function stopSnow() {
    if (!snow.on) return;
    snow.on = false;
    cancelAnimationFrame(snow.raf);
    snow.flakes = [];
    ctx.clearRect(0, 0, snow.w, snow.h);
  }

  window.addEventListener('resize', () => { if (snow.on) sizeSnow(); });

  const snowToggle = $('snow-toggle');

  function setSnow(on, persist = true) {
    if (on) startSnow(); else stopSnow();
    snowToggle.setAttribute('aria-pressed', String(on));
    snowToggle.textContent = on ? 'Snow: on' : 'Snow: off';
    if (persist) store.set(KEY_SNOW, on);
  }

  snowToggle.addEventListener('click', () => {
    setSnow(snowToggle.getAttribute('aria-pressed') !== 'true');
  });

  /* ---------- Music ---------- */

  const music = $('music');
  const musicBtn = $('music-toggle');
  const volumeInput = $('music-volume');

  const saved = store.get(KEY_MUSIC) || {};
  const musicState = {
    on: saved.on !== false,
    volume: Number.isFinite(saved.volume) ? Math.min(1, Math.max(0, saved.volume)) : CONFIG.defaultVolume
  };

  music.volume = musicState.volume;
  volumeInput.value = String(musicState.volume);

  function updateMusicUI() {
    if (music.error) {
      musicBtn.textContent = 'Music unavailable';
      musicBtn.disabled = true;
      volumeInput.disabled = true;
      return;
    }
    musicBtn.textContent = music.paused ? 'Play music' : 'Pause music';
  }

  async function playMusic() {
    try {
      await music.play();
      return true;
    } catch {
      return false;
    } finally {
      updateMusicUI();
    }
  }

  // Browsers block sound until the visitor interacts with the page.
  // If autoplay is blocked, start the music on their first click, tap, or key press.
  function armUnlock() {
    const events = ['pointerdown', 'keydown', 'touchstart'];
    const unlock = (e) => {
      if (e.target instanceof Element && e.target.closest('.music-controls')) return;
      events.forEach((name) => window.removeEventListener(name, unlock, true));
      if (musicState.on) playMusic();
    };
    events.forEach((name) => window.addEventListener(name, unlock, true));
  }

  function saveMusic() { store.set(KEY_MUSIC, musicState); }

  musicBtn.addEventListener('click', async () => {
    if (music.paused) {
      musicState.on = true;
      const ok = await playMusic();
      if (!ok) say('Your browser blocked playback. Try the button again.');
    } else {
      musicState.on = false;
      music.pause();
      updateMusicUI();
    }
    saveMusic();
  });

  volumeInput.addEventListener('input', () => {
    musicState.volume = Number(volumeInput.value);
    music.volume = musicState.volume;
    saveMusic();
  });

  music.addEventListener('play', updateMusicUI);
  music.addEventListener('pause', updateMusicUI);
  music.addEventListener('error', () => {
    updateMusicUI();
    console.warn('No music found. Add a file named music.mp3 next to index.html.');
  });

  if (music.error || music.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
    updateMusicUI();
  } else if (musicState.on) {
    playMusic().then((ok) => { if (!ok) armUnlock(); });
  } else {
    updateMusicUI();
  }

  /* ---------- Cursors ---------- */

  const cursorFrom = (svg, x, y) => `url("${svgURI(svg)}") ${x} ${y}, auto`;

  const CURSORS = [
    { id: 'default', label: 'Default' },
    { id: 'crosshair', label: 'Crosshair', css: 'crosshair' },
    {
      id: 'arrow',
      label: 'Blue arrow',
      css: cursorFrom(
        '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">' +
        '<path d="M4 2l20 12-9 2-4 9z" fill="#7B9CF0" stroke="#0D1424" stroke-width="2" stroke-linejoin="round"/></svg>',
        4, 2
      )
    },
    {
      id: 'ring',
      label: 'Ring',
      css: cursorFrom(
        '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">' +
        '<circle cx="16" cy="16" r="11" fill="none" stroke="#7B9CF0" stroke-width="3"/></svg>',
        16, 16
      )
    },
    {
      id: 'dot',
      label: 'Dot',
      css: cursorFrom(
        '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">' +
        '<circle cx="16" cy="16" r="6" fill="#E8ECF4" stroke="#0D1424" stroke-width="2"/></svg>',
        16, 16
      )
    },
    { id: 'follower', label: 'Follower' }
  ];

  const DEFAULT_CURSOR = { id: 'default' };
  const cursorOptions = $('cursor-options');

  /* Follower: a dot that tracks the pointer and a ring that trails it */
  const ring = document.createElement('div');
  ring.className = 'follower-ring';
  const dot = document.createElement('div');
  dot.className = 'follower-dot';
  document.body.append(ring, dot);

  const follow = { x: 0, y: 0, rx: 0, ry: 0, seen: false, raf: 0, active: false };

  function onPointerMove(e) {
    follow.x = e.clientX;
    follow.y = e.clientY;
    if (!follow.seen) {
      follow.rx = follow.x;
      follow.ry = follow.y;
      follow.seen = true;
      ring.classList.add('on');
      dot.classList.add('on');
    }
    dot.style.transform = `translate(${follow.x}px, ${follow.y}px)`;
    const target = e.target instanceof Element ? e.target : null;
    ring.classList.toggle('hot', Boolean(target && target.closest('a, button, label, input')));
  }

  function followLoop() {
    const ease = reduceMotion ? 1 : 0.18;
    follow.rx += (follow.x - follow.rx) * ease;
    follow.ry += (follow.y - follow.ry) * ease;
    ring.style.transform = `translate(${follow.rx}px, ${follow.ry}px)`;
    follow.raf = requestAnimationFrame(followLoop);
  }

  function startFollower() {
    if (follow.active) return;
    follow.active = true;
    window.addEventListener('pointermove', onPointerMove);
    follow.raf = requestAnimationFrame(followLoop);
  }

  function stopFollower() {
    if (!follow.active) return;
    follow.active = false;
    window.removeEventListener('pointermove', onPointerMove);
    cancelAnimationFrame(follow.raf);
    follow.seen = false;
    ring.classList.remove('on', 'hot');
    dot.classList.remove('on');
  }

  function cursorCss(choice) {
    if (choice.id === 'custom' && choice.data) return `url("${choice.data}") 16 16, auto`;
    const preset = CURSORS.find((c) => c.id === choice.id);
    return preset && preset.css ? preset.css : null;
  }

  function renderCursorOptions(choice) {
    cursorOptions.textContent = '';

    const entries = CURSORS.map((c) => ({ id: c.id, label: c.label, choice: { id: c.id } }));
    if (choice.id === 'custom' && choice.data) {
      entries.push({ id: 'custom', label: 'Your image', choice });
    }

    entries.forEach((entry) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'opt';
      button.textContent = entry.label;
      button.setAttribute('aria-pressed', String(entry.id === choice.id));
      button.addEventListener('click', () => {
        setCursor(entry.choice);
        say(entry.label + ' cursor selected.');
      });
      cursorOptions.appendChild(button);
    });
  }

  function setCursor(choice, persist = true) {
    stopFollower();
    root.classList.remove('custom-cursor', 'hide-cursor');
    root.style.removeProperty('--cursor');

    if (choice.id === 'follower') {
      root.classList.add('hide-cursor');
      startFollower();
    } else {
      const css = cursorCss(choice);
      if (css) {
        root.style.setProperty('--cursor', css);
        root.classList.add('custom-cursor');
      }
    }

    renderCursorOptions(choice);
    if (persist && !store.set(KEY_CURSOR, choice)) {
      say('Your browser blocked saving this. It will reset when you leave.');
    }
  }

  function squareImage(file, size, mime, quality) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        const sx = (img.naturalWidth - side) / 2;
        const sy = (img.naturalHeight - side) / 2;
        const c = document.createElement('canvas');
        c.width = size;
        c.height = size;
        c.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, size, size);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL(mime, quality));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('unreadable'));
      };
      img.src = url;
    });
  }

  $('cursor-upload').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = await squareImage(file, 32, 'image/png');
      setCursor({ id: 'custom', data });
      say('Cursor updated.');
    } catch {
      say('That file could not be read. Try a PNG or JPG.');
    }
  });

  /* ---------- Reset and startup ---------- */

  $('reset').addEventListener('click', () => {
    store.del(KEY_CURSOR);
    store.del(KEY_SNOW);
    store.del(KEY_MUSIC);

    setCursor(DEFAULT_CURSOR, false);
    setSnow(!reduceMotion, false);

    musicState.on = true;
    musicState.volume = CONFIG.defaultVolume;
    music.volume = musicState.volume;
    volumeInput.value = String(musicState.volume);
    if (!music.error) playMusic();

    say('Back to the defaults.');
  });

  setCursor(store.get(KEY_CURSOR) || DEFAULT_CURSOR, false);

  const savedSnow = store.get(KEY_SNOW);
  setSnow(typeof savedSnow === 'boolean' ? savedSnow : !reduceMotion, false);
})();
