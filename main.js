(() => {
  const root = document.documentElement;
  const nav = document.querySelector('.nav');
  const themeBtn = document.getElementById('themeToggle');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pointerFine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

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

  // ---------- Cursor propio (solo con mouse de verdad, no en celular/tablet) ----------
  // Un puntito pegado al cursor y un aro que lo sigue con un poco de
  // retraso; los dos crecen sobre botones, tarjetas y links.
  if (pointerFine && !reduceMotion) {
    const dot = document.createElement('div'); dot.className = 'cursor-dot'; dot.setAttribute('aria-hidden', 'true');
    const ring = document.createElement('div'); ring.className = 'cursor-ring'; ring.setAttribute('aria-hidden', 'true');
    document.body.append(dot, ring);
    document.body.classList.add('has-cursor');

    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my, seen = false;
    window.addEventListener('mousemove', e => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate(${mx}px, ${my}px)`;
      if (!seen) { seen = true; ring.style.transform = `translate(${mx}px, ${my}px)`; rx = mx; ry = my; document.body.classList.add('cursor-visible'); }
    }, { passive: true });
    document.addEventListener('mouseleave', () => document.body.classList.remove('cursor-visible'));
    document.addEventListener('mouseenter', () => document.body.classList.add('cursor-visible'));

    const ringTick = () => {
      rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
      ring.style.transform = `translate(${rx}px, ${ry}px)`;
      requestAnimationFrame(ringTick);
    };
    requestAnimationFrame(ringTick);

    const HOVER_SEL = 'a, button, .card, .project, .person, .values li, input, textarea, select';
    document.addEventListener('mouseover', e => { if (e.target.closest(HOVER_SEL)) document.body.classList.add('cursor-hover'); });
    document.addEventListener('mouseout', e => { if (e.target.closest(HOVER_SEL)) document.body.classList.remove('cursor-hover'); });
    document.addEventListener('mousedown', () => document.body.classList.add('cursor-down'));
    document.addEventListener('mouseup', () => document.body.classList.remove('cursor-down'));

    // Botones con tirón magnético: se corren un poco hacia el mouse.
    document.querySelectorAll('.ink-btn').forEach(btn => {
      btn.addEventListener('mousemove', e => {
        const r = btn.getBoundingClientRect();
        const mx2 = e.clientX - r.left - r.width / 2;
        const my2 = e.clientY - r.top - r.height / 2;
        btn.style.transform = `translate(${mx2 * 0.22}px, ${my2 * 0.32 - 2}px)`;
      });
      btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
    });
  }

  // ---------- Efecto de "decodificarse" en los textos ----------
  // Arranca cada texto en caracteres al azar y los va revelando de
  // izquierda a derecha hasta el texto real, como si se descifrara.
  // Espacios, números y signos de puntuación no se scramblean.
  const SCRAMBLE_LOWER = 'abcdefghijklmnñopqrstuvwxyz';
  const SCRAMBLE_UPPER = SCRAMBLE_LOWER.toUpperCase();
  const LETTER_RE = /[a-zA-ZñÑáéíóúÁÉÍÓÚüÜ]/;

  function scrambleReveal(el, { speed = 6, min = 110, max = 320 } = {}) {
    if (!el || el.dataset.scrambled) return;
    el.dataset.scrambled = '1';
    if (reduceMotion) return;

    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) nodes.push({ node, final: node.nodeValue });
    let letterCount = 0;
    nodes.forEach(n => { for (const c of n.final) if (LETTER_RE.test(c)) letterCount++; });
    if (!letterCount) return;

    const duration = Math.min(max, Math.max(min, letterCount * speed));
    const start = performance.now();

    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      let budget = Math.floor(t * letterCount);
      nodes.forEach(({ node, final }) => {
        let out = '';
        for (const c of final) {
          if (!LETTER_RE.test(c)) { out += c; continue; }
          if (budget > 0) { out += c; budget--; }
          else out += (c === c.toUpperCase() ? SCRAMBLE_UPPER : SCRAMBLE_LOWER)[(Math.random() * SCRAMBLE_LOWER.length) | 0];
        }
        node.nodeValue = out;
      });
      if (t < 1) requestAnimationFrame(frame);
      else nodes.forEach(({ node, final }) => { node.nodeValue = final; });
    }
    requestAnimationFrame(frame);
  }

  // Aplica el scramble a los textos "de lectura" adentro de un bloque que
  // recién entra en pantalla (párrafos, ítems, kickers, subtítulos). Deja
  // afuera los .title grandes (tienen su propio relleno de color) y los
  // botones/links sueltos, para no marear la lectura de la home.
  function scrambleWithin(elOrRoot) {
    if (!elOrRoot) return;
    const sel = 'p, li, figcaption, h3, .kicker';
    const targets = elOrRoot.matches && elOrRoot.matches(sel) ? [elOrRoot] : [...elOrRoot.querySelectorAll(sel)];
    targets.forEach(t => scrambleReveal(t));
  }

  if (!reduceMotion) {
    const scrambleIO = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { scrambleWithin(e.target); scrambleIO.unobserve(e.target); }
      });
    }, { threshold: 0, rootMargin: '0px 0px -10% 0px' });
    document.querySelectorAll('.reveal').forEach(el => scrambleIO.observe(el));

    // El texto del hero ya está a la vista al cargar: no depende de scroll.
    const heroLead = document.querySelector('.hero__lead');
    if (heroLead) setTimeout(() => scrambleReveal(heroLead), 250);
  }

  // Aparición atada al scroll, como una película: bajar adelanta la
  // animación, subir la rebobina, y el movimiento pasa mientras el
  // elemento cruza la pantalla (no de golpe al tocar un borde).
  // Chrome/Edge lo hacen nativo en CSS con animation-timeline: view()
  // (ver styles.css). Acá solo cubrimos a los navegadores que todavía
  // no lo soportan, calculando el mismo progreso 0→1 a mano.
  const viewTimelineSupported = window.CSS && CSS.supports && CSS.supports('animation-timeline: view()');

  if (reduceMotion) {
    document.querySelectorAll('.reveal').forEach(el => el.style.setProperty('--p', 1));
  } else if (!viewTimelineSupported) {
    const revealEls = [...document.querySelectorAll('.reveal')];
    const mapEl = document.querySelector('.map');
    const mapLine = document.querySelector('.map__line');

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
        revealEls.forEach(el => el.style.setProperty('--p', progressOf(el).toFixed(3)));
        if (mapEl && mapLine) mapLine.style.strokeDashoffset = String(700 * (1 - progressOf(mapEl)));
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

  // Botón de "volver arriba": aparece después del hero
  const toTop = document.getElementById('toTop');
  if (toTop) {
    toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));
  }

  // Foto y contenido del hero se mueven distinto al de scrollear (parallax + nav que se contrae)
  const heroBg = document.querySelector('.hero__bg');
  const heroFg = document.querySelector('.hero__fg');
  const heroInner = document.querySelector('.hero__inner');
  const heroLogo = document.querySelector('.hero__title');
  const heroHeight = () => (document.querySelector('.hero')?.offsetHeight || window.innerHeight);

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

        if (toTop) {
          const showAt = heroHeight() * 0.6;
          if (!pastHero && y > showAt) { pastHero = true; toTop.classList.add('show'); }
          else if (pastHero && y < showAt * 0.7) { pastHero = false; toTop.classList.remove('show'); }
        }

        if (!reduceMotion && heroBg) {
          heroBg.style.setProperty('--py', `${Math.min(y, 1000) * 0.25}px`);
        }
        if (!reduceMotion && heroFg) {
          // Se mueve más rápido y se agranda más que el fondo: da la
          // sensación de que el primer plano avanza hacia la cámara.
          const yf = Math.min(y, 900);
          // El movimiento es chico a propósito (menos que el overscan del
          // CSS) para que nunca se abra un hueco arriba; el "avance" lo da
          // sobre todo el agrandado (scale), que sí puede crecer libre.
          heroFg.style.setProperty('--pyf', `${yf * 0.09}px`);
          heroFg.style.setProperty('--sf', `${1.06 + yf * 0.0005}`);
        }
        if (!reduceMotion && heroInner) {
          const fade = Math.max(1 - y / (heroHeight() * 0.75), 0);
          heroInner.style.opacity = fade;
          heroInner.style.transform = `translateY(${Math.min(y * 0.18, 70)}px)`;
        }
        if (!reduceMotion && heroLogo) {
          // El logo se corre hacia la izquierda al bajar, y vuelve solo a
          // su lugar al subir (es una función directa de "y", no un
          // interruptor: por eso se deshace solo, como todo lo demás).
          heroLogo.style.transform = `translateX(${-Math.min(y, 500) * 0.16}px)`;
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
