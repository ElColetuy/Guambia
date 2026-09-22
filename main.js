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

  // Link activo en el menú + acento de color por sección
  const links = [...document.querySelectorAll('.nav__links a')];
  const spy = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        links.forEach(l => l.classList.toggle('active', l.hash === '#' + e.target.id));
        root.dataset.accent = e.target.id;
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  document.querySelectorAll('section[id]').forEach(s => spy.observe(s));

  // Barra de progreso de scroll (solo si el navegador no anima scroll-timeline por CSS)
  const progressBar = document.querySelector('.progress-bar');
  const needsProgressFallback = progressBar && !(window.CSS && CSS.supports && CSS.supports('animation-timeline: scroll()'));

  // Foto y contenido del hero se mueven distinto al de scrollear (parallax + nav que se contrae)
  const heroBg = document.querySelector('.hero__bg');
  const heroInner = document.querySelector('.hero__inner');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const heroHeight = () => (document.querySelector('.hero')?.offsetHeight || window.innerHeight);

  {
    let ticking = false;
    let navScrolled = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;

        // Umbral con histéresis: evita que el nav tiemble entrando y
        // saliendo de "scrolled" cuando el scroll queda justo en el límite.
        if (!navScrolled && y > 40) { navScrolled = true; }
        else if (navScrolled && y < 12) { navScrolled = false; }
        nav.classList.toggle('nav--scrolled', navScrolled);

        if (!reduceMotion && heroBg) {
          heroBg.style.setProperty('--py', `${Math.min(y, 1000) * 0.25}px`);
        }
        if (!reduceMotion && heroInner) {
          const fade = Math.max(1 - y / (heroHeight() * 0.75), 0);
          heroInner.style.opacity = fade;
          heroInner.style.transform = `translateY(${Math.min(y * 0.18, 70)}px)`;
        }
        if (needsProgressFallback) {
          const max = document.documentElement.scrollHeight - window.innerHeight;
          const pct = max > 0 ? Math.min(y / max, 1) : 0;
          progressBar.style.transform = `scaleX(${pct})`;
        }
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  document.getElementById('year').textContent = new Date().getFullYear();
})();
