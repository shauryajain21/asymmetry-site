/* Hero and small interactions.
   Hero: a pinned stage with a design-canvas board of listings. An agent cursor (Claude, ChatGPT,
   Muse, your agent) checks cards, rejects some with the reason, and buys the one that fits. As the
   visitor scrolls, the board grows to fill the screen, its listings move from products to services
   to food and restaurants, then the camera pulls back on a dense, endless canvas of listings that the
   agent checks off by the hundred, and finally the canvas pops into the rest of the page.
   Phones get the same story on a tall board that slides up under the headline. Touch tablets and
   reduced motion get a static board with one finished search. */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  // Cards: the glow follows the pointer.
  document.querySelectorAll('.spot').forEach(el => {
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });

  // Buttons lean a few pixels toward the pointer.
  if (finePointer && !reduce) {
    document.querySelectorAll('.pill').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) / r.width * 6}px, ${(e.clientY - r.top - r.height / 2) / r.height * 5}px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  // Contact form: each message is saved as a response in the team's Google Form.
  const form = document.getElementById('contact-form');
  const FIELDS = { name: 'entry.614648029', email: 'entry.1412051678', company: 'entry.588093152', message: 'entry.1890710485' };
  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const f = new FormData(form);
      const note = form.querySelector('.form-note');
      const button = form.querySelector('button');
      if (!f.get('name') || !f.get('email') || !form.querySelector('[name=email]').checkValidity()) {
        note.textContent = 'Add your name and a valid work email, then send again.';
        return;
      }
      if (f.get('website')) return; // filled only by bots
      const body = new URLSearchParams();
      for (const [k, entry] of Object.entries(FIELDS)) body.append(entry, f.get(k) || '');
      button.disabled = true;
      note.textContent = 'Sending…';
      try {
        // Google Forms sends no CORS headers, so the reply can't be read; a network failure still throws.
        await fetch(form.dataset.endpoint, { method: 'POST', mode: 'no-cors', body });
        form.reset();
        button.textContent = 'Thanks, we\'ll be in touch';
        note.textContent = '';
      } catch {
        button.disabled = false;
        note.textContent = 'That didn\'t go through. Check your connection and send again.';
      }
    });
  }

  // Problem tiles and the pipeline play once they scroll into view.
  document.querySelectorAll('.tiles, .pipeline').forEach(el => {
    el.querySelectorAll('.mini-grid i.seen').forEach((c, i) => c.style.setProperty('--d', i * 70));
    if (reduce || !('IntersectionObserver' in window)) { el.classList.add('seen'); return; }
    const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { el.classList.add('seen'); io.disconnect(); } }, { threshold: .3 });
    io.observe(el);
  });

  // Hero board.
  const stage = document.querySelector('.hero-scroll');
  const board = document.querySelector('.board');
  if (!stage || !board) return;
  const sticky = stage.querySelector('.hero-sticky');
  const copy = stage.querySelector('.hero-copy');
  const sets = [...board.querySelectorAll('.board-set')];
  const tag = board.querySelector('.set-tag');
  // Stage tabs across the top: every stage is listed and the current one is filled, so the change reads at a glance.
  const tabs = document.createElement('div');
  tabs.className = 'set-tabs';
  tabs.innerHTML = [...board.querySelectorAll('.board-set')].map(s => `<i data-k="${s.dataset.set}">${s.dataset.short ? `<span class="long">${s.dataset.name}</span><span class="short">${s.dataset.short}</span>` : s.dataset.name}</i>`).join('') + '<i data-k="all">Everything</i>';
  board.appendChild(tabs);
  const stage$ = k => {
    board.dataset.stage = k;
    tabs.querySelectorAll('i').forEach(t => t.classList.toggle('on', t.dataset.k === k));
  };
  const cursor = board.querySelector('.agent-cursor');
  const who = cursor.querySelector('em');
  const logo = cursor.querySelector('.logo');
  const ICONS = 'https://cdn.jsdelivr.net/npm/simple-icons@13.21.0/icons/';
  const AGENTS = [
    { name: 'Claude', color: '#d97757', icon: 'claude' },
    { name: 'ChatGPT', color: '#111111', icon: 'openai' },
    { name: 'Muse', color: '#7c5cff', mono: 'M' },
    { name: 'Your agent', color: '#2563eb', mono: '✦' },
  ];
  const BLURB = {
    products: 'Amazon, Target, Walmart, Etsy and independent brands',
    services: 'Cleaners, plumbers, doctors, hotels, flights',
    food: 'Delivery, groceries and restaurant tables',
  };
  const REASONS = {
    products: ['Over budget', 'Arrives too late', 'Wrong size', 'Out of stock', '3.6★ reviews', 'No free returns'],
    services: ['No slot this week', 'Over budget', '3.9★ reviews', 'Not licensed', 'Too far away', 'No free cancellation'],
    food: ['55 min delivery', 'Fully booked', 'Over budget', 'Closed tonight', 'No vegetarian options', '3.8★ reviews'],
  };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const shuffle = xs => xs.map(x => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  const narrow = matchMedia('(max-width: 860px)').matches;
  const isStatic = reduce || (!finePointer && !narrow);
  const mobile = !isStatic && narrow;
  let current = 0, round = 0, runId = 0, visible = true;

  const show = i => {
    current = i;
    sets.forEach((el, j) => el.classList.toggle('on', j === i));
    const key = sets[i].dataset.set;
    tag.querySelector('b').textContent = sets[i].dataset.name;
    tag.querySelector('span').textContent = BLURB[key];
    stage$(key);
    runId++; // the running search stops and a new one starts on this set
  };

  let target = null;
  let glide;
  // Near the right edge the name tag would be cut off, so it hangs to the left of the arrow instead.
  // Checked every frame while the cursor glides, so the tag never pokes off either edge on the way.
  const placeTag = () => {
    const b = board.getBoundingClientRect(), x = cursor.getBoundingClientRect().left - b.left;
    cursor.classList.toggle('flip', x + 20 + who.parentElement.offsetWidth > b.width - 14);
  };
  const moveTo = card => {
    target = card;
    const b = board.getBoundingClientRect(), r = card.getBoundingClientRect();
    cursor.style.setProperty('--ax', `${r.left - b.left + r.width * .62}px`);
    cursor.style.setProperty('--ay', `${r.top - b.top + r.height * .55}px`);
    cancelAnimationFrame(glide);
    const t0 = performance.now();
    const tick = () => { placeTag(); if (performance.now() - t0 < 600) glide = requestAnimationFrame(tick); };
    tick();
  };
  const reset = set => set.querySelectorAll('.pcard').forEach(c => { c.classList.remove('rejected', 'match'); c.querySelector('.verdict').textContent = ''; });
  const setAgent = a => {
    who.textContent = a.name;
    cursor.style.setProperty('--agent', a.color);
    logo.classList.toggle('mono', !a.icon);
    logo.textContent = a.mono || '';
    logo.style.setProperty('--logo', a.icon ? `url(${ICONS}${a.icon}.svg)` : 'none');
  };

  // One search: three quick rejections, then the match is bought. Fast, and abandoned if the set changes.
  const search = async () => {
    const id = runId, set = sets[current], key = set.dataset.set;
    reset(set);
    setAgent(AGENTS[round++ % AGENTS.length]);
    const [match, ...rest] = shuffle([...set.querySelectorAll('.pcard')]);
    const reasons = shuffle(REASONS[key]);
    for (const [i, card] of rest.slice(0, 3).entries()) {
      moveTo(card); await wait(625); if (id !== runId) return;
      card.querySelector('.verdict').textContent = `✕ ${reasons[i]}`;
      card.classList.add('rejected'); await wait(190); if (id !== runId) return;
    }
    moveTo(match); await wait(625); if (id !== runId) return;
    const v = match.querySelector('.verdict');
    v.textContent = '✓ Fits every requirement';
    match.classList.add('match'); await wait(840); if (id !== runId) return;
    v.textContent = key === 'food' && /pm$/.test(match.querySelector('.pmeta b').textContent) ? '✓ Booked' : '✓ Bought';
    await wait(960);
  };

  show(0);
  if (isStatic) {
    document.documentElement.classList.add('static-hero');
    board.classList.remove('boot');
    board.classList.add('pre');
    if (!reduce) {
      // Phones and touch screens: no scroll choreography, but the agent keeps shopping and the
      // board moves on to services, then food, every two searches.
      if ('IntersectionObserver' in window) new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(board);
      (async () => {
        await wait(500);
        for (let n = 1; ; n++) {
          if (visible && !document.hidden) {
            await search();
            if (n % 2 === 0) { board.classList.remove('pre'); show((current + 1) % sets.length); await wait(450); }
          } else await wait(500);
        }
      })();
      return;
    }
    const set = sets[0], cards = [...set.querySelectorAll('.pcard')];
    setAgent(AGENTS[0]);
    cards[1].classList.add('rejected'); cards[1].querySelector('.verdict').textContent = '✕ Over budget';
    cards[2].classList.add('rejected'); cards[2].querySelector('.verdict').textContent = '✕ Arrives too late';
    cards[4].classList.add('match'); cards[4].querySelector('.verdict').textContent = '✓ Fits every requirement';
    requestAnimationFrame(() => moveTo(cards[4]));
    return;
  }

  if (mobile) {
    document.documentElement.classList.add('mobile-hero');
    board.style.setProperty('--g', '1');
    board.style.setProperty('--cs', '1');
  }

  // The dense canvas: every drawing on the board, tiled hundreds of times.
  const dense = document.createElement('div');
  dense.className = 'board-dense';
  const tints = ['#ffe1cf', '#dbe8ff', '#dff3e4', '#fff0c2', '#f0e0ff'];
  const pics = [...board.querySelectorAll('.pimg svg')].map(svg =>
    'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90" stroke="#111" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${svg.innerHTML}</svg>`));
  // A phone's board is tall and narrow, so its canvas gets fewer columns and enough rows to fill it.
  const cols = mobile ? 14 : 32;
  const N = mobile ? cols * Math.ceil(sticky.offsetHeight / sticky.offsetWidth * cols * 1.25) : 640;
  if (mobile) dense.style.gridTemplateColumns = `repeat(${cols},1fr)`;
  dense.innerHTML = Array.from({ length: N }, (_, i) =>
    `<div class="dcard" style="--tint:${tints[i % 5]};--r:${(((i * 37) % 9) - 4) * .8}deg"><img src="${pics[(i * 7) % pics.length]}" alt=""></div>`).join('');
  board.insertBefore(dense, tag);
  const dcards = [...dense.children];
  const order = shuffle(dcards.map((_, i) => i));
  const winner = dcards[Math.floor(N / 2) + 14];

  // On the dense canvas, a crowd of agents works at once: several cursors hop between listings.
  const swarm = [...AGENTS, ...AGENTS].map((a, i) => {
    const el = document.createElement('div');
    el.className = 'agent-cursor swarm';
    el.innerHTML = `<svg viewBox="0 0 16 16"><path d="M1 1l5 14 2.2-6.1L14.5 6.5z"/></svg><span class="who"><i class="logo${a.icon ? '' : ' mono'}"></i><em>${a.name}</em></span>`;
    el.style.setProperty('--agent', a.color);
    const logoEl = el.querySelector('.logo');
    if (a.icon) logoEl.style.setProperty('--logo', `url(${ICONS}${a.icon}.svg)`); else logoEl.textContent = a.mono;
    el.style.transitionDuration = `${1.2 + (i % 4) * .15}s`;
    board.appendChild(el);
    return el;
  });
  const hop = () => {
    if (!board.classList.contains('is-dense')) return;
    const b = board.getBoundingClientRect();
    const seen = dcards.filter(c => { const r = c.getBoundingClientRect(); return r.left > b.left + 20 && r.right < b.right - 60 && r.top > b.top + 20 && r.bottom < b.bottom - 50; });
    if (!seen.length) return;
    swarm.forEach(el => {
      const c = seen[Math.floor(Math.random() * seen.length)], r = c.getBoundingClientRect();
      el.style.setProperty('--ax', `${r.left - b.left + r.width * .6}px`);
      el.style.setProperty('--ay', `${r.top - b.top + r.height * .5}px`);
      c.classList.add('chk');
    });
  };
  setInterval(hop, 1700);

  // Scroll choreography.
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  let checkedShown = 0;
  // Where each phase starts, as a share of the pinned scroll. Phones scroll a shorter stage (see site.css).
  const T = mobile
    ? { gather: .12, services: .3, food: .46, dense: .6, denseLen: .18, pop: .8, popLen: .15 }
    : { gather: .16, services: .3, food: .44, dense: .58, denseLen: .2, pop: .78, popLen: .16 };
  const layout = () => {
    const total = stage.offsetHeight - sticky.offsetHeight;
    const p = clamp(-stage.getBoundingClientRect().top / total);
    const st = sticky.getBoundingClientRect();
    const g = ease(clamp(p / T.gather));
    if (mobile) {
      // 1. phones: the board waits below the headline, then slides up to fill the screen as the headline lifts away
      const below = copy.offsetTop + copy.offsetHeight + 24;
      Object.assign(board.style, { left: '0px', top: `${lerp(below, 64, g)}px`, width: `${st.width}px`, height: `${st.height - 64}px` });
      if (target) moveTo(target);
    } else {
      // 1. gather: the canvas fills the screen from the start; the scattered cards gather into the board and grow
      Object.assign(board.style, { left: '0px', top: '64px', width: `${st.width}px`, height: `${st.height - 64}px` });
      board.style.setProperty('--g', String(g));
      // the opening wall's columns sit 16% apart, so on narrow screens the cards start smaller to keep a gap
      const cs0 = Math.min(.86, st.width * .145 / (sets[0].querySelector('.pcard').offsetWidth || 190));
      board.style.setProperty('--cs', String(lerp(cs0, 1, g)));
      if (target && g > 0 && g < 1) moveTo(target);
    }
    board.classList.toggle('pre', g < .5);
    // on phones the board slides over the headline, so the headline clears out of the way first
    copy.style.setProperty('--copy', String(1 - clamp(mobile ? g * 3 : g)));
    // 2. listings: products -> services -> food
    const want = p < T.services ? 0 : p < T.food ? 1 : 2;
    if (want !== current) show(want);
    // 3. dense: the camera pulls back on an endless canvas, the agent checks listings by the hundred
    const dIn = clamp((p - T.dense) / .05);
    const d = ease(clamp((p - T.dense) / T.denseLen));
    board.classList.toggle('is-dense', dIn > 0);
    dense.style.opacity = String(dIn);
    if (dIn > 0) {
      tag.querySelector('b').textContent = 'Everything';
      stage$('all');
      tag.querySelector('span').textContent = `${Math.round(d * 14200).toLocaleString('en-US')} listings checked`;
    } else if (tag.querySelector('b').textContent === 'Everything') show(current);
    const want2 = Math.floor(d * N * .9);
    if (want2 !== checkedShown) {
      order.forEach((idx, k) => dcards[idx].classList.toggle('chk', k < want2 && dcards[idx] !== winner));
      checkedShown = want2;
    }
    winner.classList.toggle('win', d > .92);
    // 4. pop: the canvas bursts past the screen and dissolves into the page
    const e = ease(clamp((p - T.pop) / T.popLen));
    const zoom = lerp(1, .32, d) * (1 + e * 9);
    dense.style.transform = `translate(-50%, -50%) scale(${zoom})`;
    dense.style.filter = e > 0 && !mobile ? `blur(${e * 6}px)` : '';
    board.style.setProperty('--board-o', String(1 - clamp((e - .25) / .75)));
    board.style.setProperty('--tag-o', String(1 - clamp(dIn * 1.5 + e * 3)));
    const ui = String(Math.min(mobile ? 1 : clamp((g - .5) * 2), 1 - clamp(e * 3)));
    tag.style.opacity = ui;
    tabs.style.opacity = ui;
    board.style.setProperty('--swarm-o', String(dIn * (1 - clamp(e * 4))));
  };
  addEventListener('scroll', layout, { passive: true });
  addEventListener('resize', layout);
  layout();
  requestAnimationFrame(() => requestAnimationFrame(() => board.classList.remove('boot')));

  // The visitor's cursor: cards drift at their own depth.
  board.addEventListener('pointermove', e => {
    const b = board.getBoundingClientRect();
    const dx = (e.clientX - b.left) / b.width - .5, dy = (e.clientY - b.top) / b.height - .5;
    sets[current].querySelectorAll('.pcard').forEach(c => {
      const d = parseFloat(c.style.getPropertyValue('--depth')) || .5;
      c.style.setProperty('--px', `${-dx * 26 * d}px`);
      c.style.setProperty('--py', `${-dy * 20 * d}px`);
    });
  });
  board.addEventListener('pointerleave', () => sets[current].querySelectorAll('.pcard').forEach(c => { c.style.removeProperty('--px'); c.style.removeProperty('--py'); }));

  if ('IntersectionObserver' in window) new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(sticky);
  (async () => {
    await wait(400);
    for (;;) {
      if (visible && !document.hidden) await search(); else await wait(400);
    }
  })();
})();
