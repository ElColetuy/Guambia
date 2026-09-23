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
    const targets = elOrRoot.matches && elOrRoot.matches('p, li, figcaption, h3, .kicker')
      ? [elOrRoot]
      : [...elOrRoot.querySelectorAll('p, li, figcaption, h3, .kicker')];
    targets.forEach(t => scrambleReveal(t));
  }
  function scrambleBatch(list, staggerMs = 100) {
    list.forEach((el, i) => setTimeout(() => scrambleWithin(el), i * staggerMs));
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

  // Aparición al bajar, parallax y relleno de color — con GSAP + ScrollTrigger si están disponibles
  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);

    // 1) Texto grande: relleno de color palabra por palabra, según el acento de cada sección
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

    // Algunos .reveal (.contact__box, .project) tienen su propia transition CSS para el
    // hover; la apagamos mientras GSAP anima transform/opacity para que no compitan.
    const animGuard = els => ({
      onStart: () => els.forEach(el => el.classList.add('is-animating')),
      onComplete: () => els.forEach(el => el.classList.remove('is-animating')),
    });

    // 2) Entradas para bloques de texto sueltos (intros, contacto...) y grupos de proyectos.
    // Una sola vez al entrar en vista; no se revierten al salir (evita el parpadeo de
    // ir y venir al scrollear de un lado a otro). El título de cada sección ya tiene su
    // propio reveal (el relleno de color palabra por palabra, más arriba), así que no
    // lleva además este fade — apilar los dos era ruido, no dos ideas. El texto de cada
    // bloque decodifica (scramble) al mismo tiempo que aparece.
    const TEXT_SEL = '.reveal:not(.card):not(.project)';
    const GROUP_SEL = '.project.reveal';

    if (reduceMotion) {
      gsap.set(`${TEXT_SEL}, ${GROUP_SEL}`, { opacity: 1, x: 0, y: 0, rotate: 0, scale: 1, filter: 'none' });
    } else {
      gsap.set(TEXT_SEL, { opacity: 0, y: 34, scale: .97 });
      // Tarjetas de proyectos: solo fade-in + translateY, rápido y en cascada muy junta
      // (ver video de referencia) — sin slide lateral ni rotación.
      gsap.set(GROUP_SEL, { opacity: 0, y: 30 });

      ScrollTrigger.batch(TEXT_SEL, {
        start: 'top 88%',
        onEnter: b => {
          gsap.to(b, { opacity: 1, y: 0, scale: 1, duration: .9, ease: 'power3.out', stagger: .1, overwrite: true, ...animGuard(b) });
          scrambleBatch(b);
        },
      });

      ScrollTrigger.batch(GROUP_SEL, {
        start: 'top 90%',
        onEnter: b => {
          gsap.to(b, { opacity: 1, y: 0, duration: .45, ease: 'power2.out', stagger: .08, overwrite: true, ...animGuard(b) });
          scrambleBatch(b, 80);
        },
      });
    }

    // 3) HERO: parallax de fondo + fade/translateY del contenido al abandonar la sección
    const heroBg = document.querySelector('.hero__bg');
    const heroInner = document.querySelector('.hero__inner');
    if (heroInner) {
      if (reduceMotion) {
        gsap.set(heroInner, { opacity: 1, y: 0 });
      } else {
        const heroRange = { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true };
        if (heroBg) gsap.to(heroBg, { yPercent: 15, ease: 'none', scrollTrigger: { ...heroRange } });
        gsap.to(heroInner, { opacity: 0, y: -70, ease: 'none', scrollTrigger: { ...heroRange } });
      }
    }

    // 4) SERVICIOS: fade-up leve una sola vez al entrar, alternando el lado de origen.
    // El bloque de tarjetas queda deliberadamente tranquilo: el momento audaz de esta
    // página es el skew de Proyectos y el trazo del mapa (ver 5 y 6 más abajo).
    if (reduceMotion) {
      gsap.set('.cards .card', { opacity: 1, y: 0, rotate: 0, scale: 1, filter: 'none' });
    } else {
      document.querySelectorAll('.cards .card').forEach((card, i) => {
        const isLeft = i % 2 === 0; // grid de 2 columnas
        const guard = animGuard([card]);
        gsap.fromTo(card,
          { y: 36, opacity: 0, scale: .97, rotate: isLeft ? -1.5 : 1.5 },
          {
            y: 0, opacity: 1, scale: 1, rotate: 0, duration: .7, ease: 'power3.out',
            scrollTrigger: { trigger: card, start: 'top 90%', toggleActions: 'play none none none' },
            ...guard,
            onStart: () => { guard.onStart(); scrambleWithin(card); },
          }
        );
      });
    }

    // 5) PROYECTOS: el grid se inclina según la velocidad del scroll y se endereza solo al frenar
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

    // 6) NOSOTROS: pin breve + dibujo del contorno del mapa, atado a ese scroll bloqueado
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

    // 7) EQUIPO: fotos con clip-path reveal, seguidas de un fade-in del texto (con scramble)
    if (reduceMotion) {
      gsap.set('.avatar', { clipPath: 'inset(0 0 0% 0)' });
    } else {
      document.querySelectorAll('.person').forEach(person => {
        const avatar = person.querySelector('.avatar');
        const textBits = [person.querySelector('.person__head > div'), ...person.querySelectorAll(':scope > p')].filter(Boolean);
        gsap.set(avatar, { clipPath: 'inset(0 0 100% 0)' });
        gsap.set(textBits, { opacity: 0, y: 16 });

        ScrollTrigger.create({
          trigger: person,
          start: 'top 85%',
          once: true,
          onEnter: () => {
            gsap.to(avatar, { clipPath: 'inset(0% 0 0% 0)', duration: 1, ease: 'power4.inOut' });
            gsap.to(textBits, { opacity: 1, y: 0, duration: .7, delay: .3, stagger: .08, ease: 'power2.out' });
            scrambleReveal(person.querySelector('.person__role'));
            person.querySelectorAll(':scope > p').forEach(p => scrambleReveal(p));
          },
        });
      });
    }

    // Los web fonts pueden correr el layout después del primer cálculo de ScrollTrigger
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => ScrollTrigger.refresh());
    }
  } else {
    // Fallback si el CDN de GSAP no cargó: aparición en cascada vía Intersection Observer.
    // Las tarjetas de una misma grilla (.cards, .projects) reciben un --reveal-i según su
    // posición, que .reveal.in usa como transition-delay (ver styles.css) para que aparezcan
    // una a una en vez de todas juntas.
    document.querySelectorAll('.cards, .projects').forEach(grid => {
      [...grid.children].forEach((card, i) => card.style.setProperty('--reveal-i', i));
    });

    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('in'); scrambleWithin(e.target); io.unobserve(e.target); }
      });
    }, { threshold: 0.15 });
    document.querySelectorAll('.reveal').forEach(el => io.observe(el));
    // El reveal de Equipo (clip-path/opacity) está oculto por CSS, no por .reveal: mostrarlo a mano.
    document.querySelectorAll('.person .avatar').forEach(el => { el.style.clipPath = 'none'; });
    document.querySelectorAll('.person__head > div, .person > p').forEach(el => { el.style.opacity = '1'; });
    document.querySelectorAll('.person__role, .person > p').forEach(el => scrambleReveal(el));
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
