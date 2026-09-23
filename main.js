(() => {
  const root = document.documentElement;
  const nav = document.querySelector('.nav');
  const themeBtn = document.getElementById('themeToggle');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Efecto de "decodificación" (scramble) para textos ----------
  // Sustituye las letras del texto real por caracteres al azar y las va revelando de
  // izquierda a derecha hasta mostrar el texto final; los espacios, números y signos
  // de puntuación quedan fijos desde el principio (no se scramblean). Se dispara junto
  // con el resto del reveal (fade/slide) de cada bloque, nunca antes ni por separado.
  const SCRAMBLE_LOWER = 'abcdefghijklmnñopqrstuvwxyz';
  const SCRAMBLE_UPPER = SCRAMBLE_LOWER.toUpperCase();
  const LETTER_RE = /[a-zA-ZñÑáéíóúÁÉÍÓÚüÜ]/;

  function scrambleReveal(el, { speed = 22, min = 450, max = 1500 } = {}) {
    if (!el || el.dataset.scrambled) return;
    el.dataset.scrambled = '1';
    if (reduceMotion) return; // el DOM ya tiene el texto final; no animamos nada

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

  // Aplica el scramble a los textos "de lectura" dentro de un contenedor que recién
  // entra en pantalla (párrafos, ítems de lista, kickers, subtítulos de tarjeta/proyecto).
  // Deja afuera los .title (tienen su propio relleno de color, ver más abajo) y los
  // botones/links sueltos.
  function scrambleWithin(elOrRoot) {
    if (!elOrRoot) return;
    const targets = elOrRoot.matches && elOrRoot.matches('p, li, figcaption, h3, .kicker, .person__role')
      ? [elOrRoot]
      : [...elOrRoot.querySelectorAll('p, li, figcaption, h3, .kicker, .person__role')];
    targets.forEach(t => scrambleReveal(t));
  }

  // HERO: el texto de bajada ya está a la vista al cargar, así que decodifica solo
  // (no depende de scroll).
  const heroLead = document.querySelector('.hero__lead');
  if (heroLead) setTimeout(() => scrambleReveal(heroLead), 250);

  // Alto real del footer, para el efecto de "telón" de .contact (ver styles.css). Puro CSS
  // (position: sticky), funciona incluso si GSAP no llega a cargar.
  const footer = document.querySelector('.footer');
  const syncFooterHeight = () => {
    if (!footer) return;
    root.style.setProperty('--footer-h', `${footer.offsetHeight}px`);
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  };
  syncFooterHeight();
  window.addEventListener('resize', syncFooterHeight);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncFooterHeight);

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

  // Marca en <html> si GSAP no está disponible (CDN caído, red que lo bloquea, etc.),
  // para que el CSS pueda usar reveals propios donde GSAP normalmente haría de más
  // (ver .no-gsap .map.is-visible .map__line en styles.css).
  if (!(window.gsap && window.ScrollTrigger)) root.classList.add('no-gsap');

  // ======================================================================
  // APARICIÓN AL HACER SCROLL — mecanismo único, en CSS + Intersection
  // Observer puro, SIN depender de GSAP ni de ningún CDN externo.
  // (Antes esto vivía adentro del "if (window.gsap)"; si el script de GSAP
  // no llegaba a cargar — CDN caído, red que lo bloquea, etc. — el sitio
  // entero se quedaba estático, sin ningún reveal. Ahora esta parte corre
  // siempre. GSAP, si carga, solo se usa para efectos extra que no dependen
  // de esto: relleno de color del título, parallax del hero, el skew de
  // Proyectos y el trazo del mapa — ver más abajo.)
  // ======================================================================
  if (reduceMotion) {
    document.querySelectorAll('.reveal, .person').forEach(el => el.classList.add('is-visible'));
  } else {
    // Cascada entre tarjetas de una misma grilla (.cards, .projects): cada hija
    // recibe su índice en --reveal-i, que .reveal.is-visible usa como
    // transition-delay (ver styles.css) para que aparezcan una a una.
    document.querySelectorAll('.cards, .projects').forEach(grid => {
      [...grid.children].forEach((card, i) => {
        card.style.setProperty('--reveal-i', i);
        card.dataset.revealIndex = i;
      });
    });

    const revealIO = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const delay = (Number(el.dataset.revealIndex) || 0) * 80;
        el.classList.add('is-visible');
        setTimeout(() => scrambleWithin(el), delay);
        revealIO.unobserve(el);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -10% 0px' });
    document.querySelectorAll('.reveal').forEach(el => revealIO.observe(el));

    // EQUIPO: mismo mecanismo (CSS + IO), la foto y el texto de cada persona
    // se revelan juntos apenas esa tarjeta entra en pantalla.
    const personIO = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const person = entry.target;
        person.classList.add('is-visible');
        setTimeout(() => scrambleWithin(person), 150);
        personIO.unobserve(person);
      });
    }, { threshold: 0.2 });
    document.querySelectorAll('.person').forEach(el => personIO.observe(el));
  }

  // ---------- Extras solo-GSAP: relleno de color del título, parallax del
  // hero, skew de Proyectos y trazo del mapa. Si el CDN de GSAP no carga,
  // esta parte simplemente no corre — el título queda de un solo color fijo,
  // el mapa se ve ya dibujado y Proyectos no se inclina — nada se rompe ni
  // queda invisible, porque ninguno de esos estados "de reposo" depende de
  // que GSAP los toque (ver los valores por defecto en styles.css). ----------
  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);

    // Texto grande: relleno de color palabra por palabra, según el acento de cada sección
    const SECTION_ACCENT = { proyectos: '--red', equipo: '--red', nosotros: '--celeste' };
    document.querySelectorAll('.title').forEach(title => {
      const words = title.textContent.trim().split(/\s+/).map(w => `<span class="word">${w}</span>`).join(' ');
      title.innerHTML = words;
      const wordEls = [...title.querySelectorAll('.word')];

      if (reduceMotion) {
        gsap.set(wordEls, { color: getComputedStyle(root).getPropertyValue('--ink').trim() });
        return;
      }
      const accentVar = SECTION_ACCENT[title.closest('section[id]')?.id] || '--blue';
      const accent = getComputedStyle(root).getPropertyValue(accentVar).trim();
      gsap.timeline({
        scrollTrigger: { trigger: title, start: 'top 85%', end: 'top 45%', scrub: 0.6 },
      }).to(wordEls, { color: accent, duration: .5, stagger: .4, ease: 'none' });
    });

    // HERO: parallax de fondo + fade/translateY del contenido al abandonar la sección
    const heroBg = document.querySelector('.hero__bg');
    const heroInner = document.querySelector('.hero__inner');
    if (heroInner && !reduceMotion) {
      const heroRange = { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true };
      if (heroBg) gsap.to(heroBg, { yPercent: 15, ease: 'none', scrollTrigger: { ...heroRange } });
      gsap.to(heroInner, { opacity: 0, y: -70, ease: 'none', scrollTrigger: { ...heroRange } });
    }

    // PROYECTOS: el grid se inclina según la velocidad del scroll y se endereza solo al frenar
    if (!reduceMotion) {
      const projectsGrid = document.querySelector('.projects');
      if (projectsGrid) {
        const skewProxy = { skew: 0 };
        const clampSkew = gsap.utils.clamp(-8, 8);
        const setSkew = gsap.quickSetter(projectsGrid, 'skewY', 'deg');
        ScrollTrigger.create({
          trigger: projectsGrid,
          start: 'top bottom',
          end: 'bottom top',
          onUpdate: self => {
            const skew = clampSkew(self.getVelocity() / -300);
            if (Math.abs(skew) > Math.abs(skewProxy.skew)) skewProxy.skew = skew;
            gsap.to(skewProxy, { skew: 0, duration: .8, ease: 'power3.out', overwrite: true, onUpdate: () => setSkew(skewProxy.skew) });
          },
        });
      }
    }

    // NOSOTROS: pin breve + dibujo del contorno del mapa, atado a ese scroll bloqueado.
    // Por defecto (CSS) la línea ya está dibujada; acá la ocultamos primero para
    // poder animar el trazo, y solo lo hacemos si GSAP efectivamente cargó.
    const mapLine = document.querySelector('.map__line');
    if (mapLine) {
      const len = mapLine.getTotalLength();
      if (reduceMotion) {
        gsap.set(mapLine, { strokeDasharray: len, strokeDashoffset: 0 });
      } else {
        gsap.set(mapLine, { strokeDasharray: len, strokeDashoffset: len });
        const navH = nav.offsetHeight || 70;
        ScrollTrigger.create({
          trigger: '#nosotros',
          start: `top top+=${navH}`,
          end: '+=700',
          pin: true,
          scrub: 1,
          animation: gsap.to(mapLine, { strokeDashoffset: 0, ease: 'none' }),
        });
      }
    }

    // Los web fonts pueden correr el layout después del primer cálculo de ScrollTrigger
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => ScrollTrigger.refresh());
    }
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

  // Nav que se contrae al bajar (el parallax del hero ahora lo maneja GSAP más arriba)
  {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;

        nav.classList.toggle('nav--scrolled', y > 8);

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
