(() => {
  const root = document.documentElement;
  const nav = document.querySelector('.nav');
  const themeBtn = document.getElementById('themeToggle');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
  // (ver styles.css) — ahí esto no corre nada de JS. Acá solo cubrimos
  // a los navegadores que todavía no lo soportan.
  const viewTimelineSupported = window.CSS && CSS.supports && CSS.supports('animation-timeline: view()');

  if (reduceMotion) {
    document.querySelectorAll('.reveal').forEach(el => el.style.setProperty('--p', 1));
  } else if (!viewTimelineSupported) {
    // Ojo con el rendimiento acá: en vez de recalcular getBoundingClientRect
    // de TODOS los .reveal en cada frame de scroll (carísimo en celulares,
    // sobre todo con muchas tarjetas), se mantiene con un IntersectionObserver
    // "grosero" (medio viewport de margen) un set chico con solo los
    // elementos cerca de la pantalla, y solo esos se recalculan.
    const revealEls = [...document.querySelectorAll('.reveal')];
    const mapEl = document.querySelector('.map');
    const mapLine = document.querySelector('.map__line');
    const active = new Set();
    const activateIO = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) active.add(e.target); else active.delete(e.target); });
    }, { rootMargin: '50% 0px 50% 0px' });
    revealEls.forEach(el => activateIO.observe(el));
    if (mapEl) activateIO.observe(mapEl);

    // Progreso 0→1 según cuánto del elemento ya cruzó la pantalla:
    // 0 = recién asoma por abajo, 1 = ya entró del todo. El rango es
    // más largo que el elemento en sí (38% del alto+viewport) para que
    // la animación se note mientras el elemento está en pantalla, no
    // solo en el instante en que cruza el borde. Mismo criterio que el
    // animation-range del CSS (entry 0% cover 38%).
    const progressOf = el => {
      const r = el.getBoundingClientRect();
      const span = (r.height + window.innerHeight) * 0.38;
      const raw = (window.innerHeight - r.top) / span;
      return Math.max(0, Math.min(1, raw));
    };

    let revealTicking = false;
    const updateReveal = () => {
      if (revealTicking) return;
      revealTicking = true;
      requestAnimationFrame(() => {
        active.forEach(el => {
          const p = progressOf(el);
          if (el === mapEl) { if (mapLine) mapLine.style.strokeDashoffset = String(700 * (1 - p)); }
          else el.style.setProperty('--p', p.toFixed(3));
        });
        revealTicking = false;
      });
    };
    window.addEventListener('scroll', updateReveal, { passive: true });
    window.addEventListener('resize', updateReveal);
    updateReveal();
  }

  // Tocar el logo del hero: da una vuelta de 360° sobre sí mismo, en 3D
  const logoImg = document.querySelector('.hero__title img');
  if (logoImg && !reduceMotion) {
    logoImg.addEventListener('click', () => {
      if (logoImg.classList.contains('spin')) return;
      logoImg.classList.add('spin');
      logoImg.addEventListener('animationend', () => logoImg.classList.remove('spin'), { once: true });
    });
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
  let docScrollMax = 0;
  const measureDocHeight = () => { docScrollMax = document.documentElement.scrollHeight - window.innerHeight; };
  if (needsProgressFallback) measureDocHeight();

  // Botón de "volver arriba": aparece después del hero
  const toTop = document.getElementById('toTop');
  if (toTop) {
    toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));
  }

  // Foto y contenido del hero se mueven distinto al de scrollear (parallax
  // + nav que se contrae). Todo esto solo importa mientras el hero está
  // cerca de la pantalla: una vez que quedó bien atrás, se deja de tocar
  // por completo (nada de estilos ni de cálculos) para no gastar tiempo de
  // cada frame de scroll en algo que ya ni se ve — esto es lo que más
  // pesaba en celulares, porque corría en TODO el largo de la página.
  const heroEl = document.querySelector('.hero');
  const heroBg = document.querySelector('.hero__bg');
  const heroFg = document.querySelector('.hero__fg');
  const heroInner = document.querySelector('.hero__inner');
  const heroLogo = document.querySelector('.hero__title');
  let heroH = heroEl?.offsetHeight || window.innerHeight;
  const mobileView = window.matchMedia('(max-width: 860px)');
  let heroActive = true;
  const remeasureHero = () => { heroH = heroEl?.offsetHeight || window.innerHeight; };
  window.addEventListener('resize', remeasureHero);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasureHero);

  {
    let ticking = false;
    let navScrolled = false;
    let pastHero = false;
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

        const showAt = heroH * 0.6;
        if (toTop) {
          if (!pastHero && y > showAt) { pastHero = true; toTop.classList.add('show'); }
          else if (pastHero && y < showAt * 0.7) { pastHero = false; toTop.classList.remove('show'); }
        }

        // Un poco más de margen que "showAt" para no cortar el parallax
        // mientras el hero todavía se está terminando de desvanecer.
        const heroShouldBeActive = y < heroH * 1.1;
        if (heroShouldBeActive !== heroActive) {
          heroActive = heroShouldBeActive;
          if (!heroActive) {
            // Se sale del hero: deja los estilos en su estado final en vez
            // de a mitad de animación, y no los vuelve a tocar hasta volver.
            if (heroInner) { heroInner.style.opacity = 0; }
          }
        }

        if (heroActive && !mobileView.matches) {
          if (!reduceMotion && heroBg) {
            heroBg.style.transform = `translate3d(0, ${Math.min(y, 1000) * 0.25}px, 0)`;
          }
          if (!reduceMotion && heroFg) {
            // Se mueve más rápido y se agranda más que el fondo: da la
            // sensación de que el primer plano avanza hacia la cámara.
            const yf = Math.min(y, 900);
            heroFg.style.transform = `translate3d(0, ${yf * 0.09}px, 0) scale(${1.06 + yf * 0.0005})`;
          }
          if (!reduceMotion && heroInner) {
            const fade = Math.max(1 - y / (heroH * 0.75), 0);
            heroInner.style.opacity = fade;
            heroInner.style.transform = `translate3d(0, ${Math.min(y * 0.18, 70)}px, 0)`;
          }
          if (!reduceMotion && heroLogo) {
            // El logo se corre hacia la izquierda al bajar, y vuelve solo a
            // su lugar al subir (es una función directa de "y", no un
            // interruptor: por eso se deshace solo, como todo lo demás).
            heroLogo.style.transform = `translate3d(${-Math.min(y, 500) * 0.16}px, 0, 0)`;
          }
        }

        if (needsProgressFallback) {
          const pct = docScrollMax > 0 ? Math.min(y / docScrollMax, 1) : 0;
          progressBar.style.transform = `scaleX(${pct})`;
        }
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', () => { measureDocHeight(); onScroll(); });
    onScroll();
  }

  document.getElementById('year').textContent = new Date().getFullYear();
})();
