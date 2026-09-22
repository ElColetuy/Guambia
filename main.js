(() => {
  const root = document.documentElement;
  const nav = document.querySelector('.nav');
  const themeBtn = document.getElementById('themeToggle');

  // Modo claro / oscuro
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  const currentTheme = () => root.dataset.theme || (systemDark.matches ? 'dark' : 'light');
  const paintIcon = () => { themeBtn.textContent = currentTheme() === 'dark' ? '☾' : '☀'; };
  themeBtn.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('guambia-theme', next); } catch (e) {}
    paintIcon();
  });
  systemDark.addEventListener('change', paintIcon);
  paintIcon();

  // Menú en celular
  const burger = document.getElementById('burger');
  const setMenu = open => {
    nav.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', open);
    burger.textContent = open ? '✕' : '☰';
  };
  burger.addEventListener('click', () => setMenu(!nav.classList.contains('menu-open')));
  document.querySelectorAll('.nav__links a').forEach(a => a.addEventListener('click', () => setMenu(false)));

  // Aparición al bajar
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  // Link activo en el menú
  const links = [...document.querySelectorAll('.nav__links a')];
  const spy = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) links.forEach(l => l.classList.toggle('active', l.hash === '#' + e.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  document.querySelectorAll('section[id]').forEach(s => spy.observe(s));

  // La foto del hero baja más lento que el contenido
  const heroBg = document.querySelector('.hero__bg');
  if (heroBg && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        heroBg.style.setProperty('--py', `${Math.min(scrollY, 1000) * 0.25}px`);
        ticking = false;
      });
    }, { passive: true });
  }

  document.getElementById('year').textContent = new Date().getFullYear();
})();
