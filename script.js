(() => {
  'use strict';

  const KEY_AVATAR = 'thedoftoca.avatar';
  const KEY_CURSOR = 'thedoftoca.cursor';
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

  const avatarImg = $('avatar');
  const avatarOptions = $('avatar-options');
  const cursorOptions = $('cursor-options');
  const status = $('status');

  function say(message) { status.textContent = message; }

  /* ---------- Avatars ---------- */

  const AVATARS = [
    {
      id: 'silhouette',
      label: 'Silhouette',
      src: svgURI(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">' +
        '<rect width="200" height="200" fill="#17191C"/>' +
        '<circle cx="100" cy="78" r="36" fill="#E3E5E6"/>' +
        '<path d="M28 200c0-46 32-74 72-74s72 28 72 74z" fill="#E3E5E6"/></svg>'
      )
    },
    {
      id: 'door',
      label: 'Open door',
      src: svgURI(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">' +
        '<rect width="200" height="200" fill="#E3E5E6"/>' +
        '<rect x="58" y="28" width="84" height="148" fill="#17191C"/>' +
        '<polygon points="112,46 142,28 142,176 112,160" fill="#E3E5E6"/>' +
        '<polygon points="58,28 112,46 112,160 58,176" fill="#1F4FA3"/></svg>'
      )
    },
    {
      id: 'chain',
      label: 'Chain',
      src: svgURI(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">' +
        '<rect width="200" height="200" fill="#1F4FA3"/>' +
        '<rect x="34" y="70" width="86" height="60" rx="30" fill="none" stroke="#E3E5E6" stroke-width="12"/>' +
        '<rect x="80" y="70" width="86" height="60" rx="30" fill="none" stroke="#17191C" stroke-width="12"/></svg>'
      )
    },
    {
      id: 'initial',
      label: 'Letter T',
      src: svgURI(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">' +
        '<rect width="200" height="200" fill="#E3E5E6"/>' +
        '<rect x="46" y="44" width="108" height="28" fill="#17191C"/>' +
        '<rect x="86" y="44" width="28" height="118" fill="#17191C"/>' +
        '<rect x="132" y="140" width="22" height="22" fill="#1F4FA3"/></svg>'
      )
    }
  ];

  const DEFAULT_AVATAR = { type: 'preset', id: 'silhouette' };

  function avatarSource(choice) {
    if (choice && choice.type === 'upload' && choice.data) return choice.data;
    const preset = AVATARS.find((a) => a.id === (choice && choice.id)) || AVATARS[0];
    return preset.src;
  }

  function renderAvatarOptions(choice) {
    avatarOptions.textContent = '';

    const entries = AVATARS.map((a) => ({ id: a.id, label: a.label, src: a.src, choice: { type: 'preset', id: a.id } }));
    if (choice && choice.type === 'upload' && choice.data) {
      entries.push({ id: 'upload', label: 'Your upload', src: choice.data, choice });
    }

    entries.forEach((entry) => {
      const pressed = entry.id === 'upload'
        ? choice.type === 'upload'
        : choice.type === 'preset' && choice.id === entry.id;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'opt opt-avatar';
      button.setAttribute('aria-label', entry.label);
      button.setAttribute('aria-pressed', String(pressed));
      button.title = entry.label;

      const img = document.createElement('img');
      img.src = entry.src;
      img.alt = '';
      button.appendChild(img);

      button.addEventListener('click', () => {
        setAvatar(entry.choice);
        say(entry.label + ' selected.');
      });
      avatarOptions.appendChild(button);
    });
  }

  function setAvatar(choice, persist = true) {
    avatarImg.src = avatarSource(choice);
    renderAvatarOptions(choice);
    if (persist && !store.set(KEY_AVATAR, choice)) {
      say('Your browser blocked saving this. It will reset when you leave.');
    }
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
        '<path d="M4 2l20 12-9 2-4 9z" fill="#1F4FA3" stroke="#E3E5E6" stroke-width="2" stroke-linejoin="round"/></svg>',
        4, 2
      )
    },
    {
      id: 'ring',
      label: 'Ring',
      css: cursorFrom(
        '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">' +
        '<circle cx="16" cy="16" r="11" fill="none" stroke="#1F4FA3" stroke-width="3"/></svg>',
        16, 16
      )
    },
    {
      id: 'dot',
      label: 'Dot',
      css: cursorFrom(
        '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">' +
        '<circle cx="16" cy="16" r="6" fill="#17191C" stroke="#E3E5E6" stroke-width="2"/></svg>',
        16, 16
      )
    },
    { id: 'follower', label: 'Follower' }
  ];

  const DEFAULT_CURSOR = { id: 'default' };
  const root = document.documentElement;

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

  function loop() {
    const ease = reduceMotion ? 1 : 0.18;
    follow.rx += (follow.x - follow.rx) * ease;
    follow.ry += (follow.y - follow.ry) * ease;
    ring.style.transform = `translate(${follow.rx}px, ${follow.ry}px)`;
    follow.raf = requestAnimationFrame(loop);
  }

  function startFollower() {
    if (follow.active) return;
    follow.active = true;
    window.addEventListener('pointermove', onPointerMove);
    follow.raf = requestAnimationFrame(loop);
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

  /* ---------- Uploads ---------- */

  function squareImage(file, size, mime, quality) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        const sx = (img.naturalWidth - side) / 2;
        const sy = (img.naturalHeight - side) / 2;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        canvas.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, size, size);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL(mime, quality));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('unreadable'));
      };
      img.src = url;
    });
  }

  $('avatar-upload').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = await squareImage(file, 256, 'image/jpeg', 0.88);
      setAvatar({ type: 'upload', data });
      say('Avatar updated.');
    } catch {
      say('That file could not be read. Try a PNG or JPG.');
    }
  });

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
    store.del(KEY_AVATAR);
    store.del(KEY_CURSOR);
    setAvatar(DEFAULT_AVATAR, false);
    setCursor(DEFAULT_CURSOR, false);
    say('Back to the defaults.');
  });

  setAvatar(store.get(KEY_AVATAR) || DEFAULT_AVATAR, false);
  setCursor(store.get(KEY_CURSOR) || DEFAULT_CURSOR, false);
})();
