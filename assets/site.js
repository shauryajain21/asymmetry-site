/* Progressive enhancement. Without JavaScript (or with reduced motion) the shelf figure
   shows its end state: every listing checked, one pick, bought and looked after. With it,
   the checks run in order, then the purchase moves along its timeline. */
(() => {
  document.documentElement.classList.add('js');
  const bench = document.querySelector('.results');
  if (bench) {
    if ('IntersectionObserver' in window) {
      const seen = new IntersectionObserver(entries => {
        if (entries.some(e => e.isIntersecting)) { bench.classList.add('seen'); seen.disconnect(); }
      }, { threshold: .25 });
      seen.observe(bench.querySelector('.bench-table'));
    } else bench.classList.add('seen');
  }
  const shelf = document.querySelector('.shelf');
  if (!shelf) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const cells = [...shelf.querySelectorAll('.cell')];
  const checks = [...shelf.querySelectorAll('.checks li')];
  const count = shelf.querySelector('.count b');
  const pick = shelf.querySelector('.pick');
  const after = [...shelf.querySelectorAll('.after-track li')];
  const total = cells.length;
  let timers = [];

  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  const setCount = n => { count.textContent = n; };
  const reset = () => {
    timers.forEach(clearTimeout);
    timers = [];
    cells.forEach(c => { c.classList.remove('out', 'win'); c.style.transitionDelay = ''; });
    checks.forEach(li => li.classList.remove('active', 'done'));
    pick.classList.remove('show');
    after.forEach(li => li.classList.remove('on'));
    setCount(total);
  };
  const finish = () => {
    timers.forEach(clearTimeout);
    timers = [];
    cells.forEach(c => { c.style.transitionDelay = ''; c.classList.toggle('out', c.dataset.out !== undefined); c.classList.toggle('win', c.dataset.out === undefined); });
    checks.forEach(li => { li.classList.remove('active'); li.classList.add('done'); });
    pick.classList.add('show');
    after.forEach(li => li.classList.add('on'));
    setCount(1);
  };
  const play = () => {
    if (reducedMotion.matches) return finish();
    reset();
    const step = 1150;
    checks.forEach((li, i) => {
      const stage = String(i + 1);
      const t = 500 + i * step;
      later(t, () => li.classList.add('active'));
      later(t + 250, () => {
        cells.filter(c => c.dataset.out === stage).forEach((c, j) => {
          c.style.transitionDelay = `${(j * 37) % 320}ms`;
          c.classList.add('out');
        });
      });
      later(t + 950, () => { li.classList.remove('active'); li.classList.add('done'); setCount(li.dataset.left); });
    });
    const end = 500 + checks.length * step;
    later(end, () => { cells.find(c => c.dataset.out === undefined).classList.add('win'); });
    later(end + 450, () => pick.classList.add('show'));
    after.forEach((li, i) => later(end + 1100 + i * 750, () => li.classList.add('on')));
  };

  // The page loads showing the finished picture; the animation runs, and repeats, while the card is on screen.
  shelf.querySelector('.replay').addEventListener('click', play);
  if ('IntersectionObserver' in window && !reducedMotion.matches) {
    let visible = false, loop = null;
    const cycle = () => { if (!visible) return; play(); loop = setTimeout(cycle, 500 + checks.length * 1150 + 1100 + after.length * 750 + 4000); };
    new IntersectionObserver(entries => {
      const now = entries.some(e => e.isIntersecting);
      if (now && !visible) { visible = true; cycle(); }
      if (!now && visible) { visible = false; clearTimeout(loop); finish(); }
    }, { threshold: .25 }).observe(shelf.querySelector('.shelf-card'));
  } else {
    finish();
  }
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) finish(); });
})();
