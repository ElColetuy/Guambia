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

  // Aparición atada al scroll, como una película: bajar adelanta la
  // animación, subir la rebobina, y el movimiento pasa mientras el
  // elemento cruza la pantalla (no de golpe al tocar un borde).
  // Chrome/Edge lo hacen nativo en CSS con animation-timeline: view()
  // (ver styles.css). Acá solo cubrimos a los navegadores que todavía
  // no lo soportan, calculando el mismo progreso 0→1 a mano.
  const reduceMotionReveal = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const viewTimelineSupported = window.CSS && CSS.supports && CSS.supports('animation-timeline: view()');

  if (reduceMotionReveal) {
    document.querySelectorAll('.reveal').forEach(el => el.style.setProperty('--p', 1));
  } else if (!viewTimelineSupported) {
    const revealEls = [...document.querySelectorAll('.reveal')];
    const mapEl = document.querySelector('.map');
    const mapLine = document.querySelector('.map__line');

    // Progreso 0→1 según cuánto del elemento ya cruzó la pantalla:
    // 0 = recién asoma por abajo, 1 = ya entró del todo. El rango es
    // más largo que el elemento en sí (55% del alto+viewport) para que
    // la animación se note mientras el elemento está en pantalla, no
    // solo en el instante en que cruza el borde. Mismo criterio que el
    // animation-range del CSS (entry 0% cover 55%).
    const progressOf = el => {
      const r = el.getBoundingClientRect();
      const span = (r.height + window.innerHeight) * 0.55;
      const raw = (window.innerHeight - r.top) / span;
      return Math.max(0, Math.min(1, raw));
    };

    let revealTicking = false;
    const updateReveal = () => {
      if (revealTicking) return;
      revealTicking = true;
      requestAnimationFrame(() => {
        revealEls.forEach(el => el.style.setProperty('--p', progressOf(el).toFixed(3)));
        if (mapEl && mapLine) mapLine.style.strokeDashoffset = String(1000 * (1 - progressOf(mapEl)));
        revealTicking = false;
      });
    };
    window.addEventListener('scroll', updateReveal, { passive: true });
    window.addEventListener('resize', updateReveal);
    updateReveal();
  }

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
  const heroFg = document.querySelector('.hero__fg');
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
        if (!reduceMotion && heroFg) {
          // Se mueve más rápido y se agranda más que el fondo: da la
          // sensación de que el primer plano avanza hacia la cámara.
          const yf = Math.min(y, 900);
          heroFg.style.setProperty('--pyf', `${yf * 0.42}px`);
          heroFg.style.setProperty('--sf', `${1.18 + yf * 0.00042}`);
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
