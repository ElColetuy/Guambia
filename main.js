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
    // Primero se leen TODAS las posiciones y después se escribe (sin
    // intercalar), así el navegador hace un solo cálculo de layout por
    // frame. Solo se escribe si el valor cambió, y los elementos que ya
    // quedaron del todo fuera de pantalla se saltean (0 abajo, 1 arriba).
    const items = [...document.querySelectorAll('.reveal, .map')];
    const mapLine = document.querySelector('.map__line');
    const last = new Map();
    const apply = (el, p) => {
      if (last.get(el) === p) return;
      last.set(el, p);
      if (el.classList.contains('map')) { if (mapLine) mapLine.style.strokeDashoffset = String(700 * (1 - p)); }
      else el.style.setProperty('--p', p);
    };
    // Progreso 0→1 según cuánto del elemento ya cruzó la pantalla (mismo
    // criterio que animation-range: entry 0% cover 38% del CSS).
    let revealTicking = false;
    const updateReveal = () => {
      if (revealTicking) return;
      revealTicking = true;
      requestAnimationFrame(() => {
        const vh = window.innerHeight;
        const ps = items.map(el => {
          const r = el.getBoundingClientRect();
          const span = (r.height + vh) * 0.38;
          return Math.max(0, Math.min(1, +(((vh - r.top) / span)).toFixed(3)));
        });
        items.forEach((el, i) => apply(el, ps[i]));
        revealTicking = false;
      });
    };
    window.addEventListener('scroll', updateReveal, { passive: true });
    window.addEventListener('resize', updateReveal);
    window.addEventListener('pageshow', updateReveal);
    updateReveal();
  }

  // Tocar el logo del hero: da una vuelta de 360° sobre sí mismo, en 3D
  const logoImg = document.querySelector('.hero__title img');
  if (logoImg && !reduceMotion) {
    const spinLogo = () => {
      if (logoImg.classList.contains('spin')) return;
      logoImg.classList.add('spin');
      logoImg.addEventListener('animationend', () => logoImg.classList.remove('spin'), { once: true });
    };
    logoImg.addEventListener('click', spinLogo);
    setTimeout(spinLogo, 350);
  }

  if (document.querySelector('.hero')) nav.classList.add('nav--over');

  // Carrusel de proyectos
  const carousel = document.querySelector('[data-carousel]');
  if (carousel) {
    const track = carousel.querySelector('.projects');
    const prev = carousel.querySelector('[data-prev]');
    const next = carousel.querySelector('[data-next]');
    const step = () => { const c = track.querySelector('.project'); return c ? c.getBoundingClientRect().width + 20 : 300; };
    const behavior = reduceMotion ? 'auto' : 'smooth';
    prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior }));
    next.addEventListener('click', () => track.scrollBy({ left: step(), behavior }));
    let carTick = false;
    const updateCarousel = () => {
      prev.disabled = track.scrollLeft < 4;
      next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
    };
    track.addEventListener('scroll', () => {
      if (carTick) return;
      carTick = true;
      requestAnimationFrame(() => { updateCarousel(); carTick = false; });
    }, { passive: true });
    window.addEventListener('resize', updateCarousel);
    updateCarousel();

    // Pasa solo cada 4 s; se frena con mouse, foco, dedo, pestaña oculta o fuera de pantalla.
    if (!reduceMotion) {
      let timer = null, visible = false;
      const advance = () => {
        const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
        track.scrollTo({ left: atEnd ? 0 : track.scrollLeft + step(), behavior: 'smooth' });
      };
      const stop = () => { clearInterval(timer); timer = null; };
      const start = () => { stop(); if (visible && !document.hidden) timer = setInterval(advance, 4000); };
      carousel.addEventListener('mouseenter', stop);
      carousel.addEventListener('mouseleave', start);
      carousel.addEventListener('focusin', stop);
      carousel.addEventListener('focusout', start);
      carousel.addEventListener('touchstart', stop, { passive: true });
      carousel.addEventListener('touchend', () => setTimeout(start, 6000), { passive: true });
      document.addEventListener('visibilitychange', start);
      new IntersectionObserver(([e]) => { visible = e.isIntersecting; start(); }, { threshold: 0.3 }).observe(carousel);
    }
  }

  // Moneda animada (Lottie) al lado del botón "Quiero mi web"
  const coinBox = document.getElementById('navCoin');
  if (coinBox) {
    window.addEventListener('load', () => {
      if (!window.lottie) return;
      const coin = window.lottie.loadAnimation({ container: coinBox, renderer: 'svg', loop: false, autoplay: false, path: 'assets/coin.json' });
      if (reduceMotion) { coin.addEventListener('DOMLoaded', () => coin.goToAndStop(0, true)); return; }
      const play = () => coin.goToAndPlay(0, true);
      coin.addEventListener('DOMLoaded', () => { play(); setInterval(play, 3500); });
      coinBox.addEventListener('mouseenter', play);
    });
  }

  // El logo de la barra solo aparece cuando el logo grande del hero ya no se ve
  const heroLogoImg = document.querySelector('.hero__title img');
  if (heroLogoImg) {
    nav.classList.add('nav--logo-hidden');
    new IntersectionObserver(([e]) => {
      nav.classList.toggle('nav--logo-hidden', e.intersectionRatio > 0.35);
    }, { rootMargin: '-70px 0px 0px 0px', threshold: [0, 0.35, 0.7, 1] }).observe(heroLogoImg);
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
  const heroInner = document.querySelector('.hero__inner');
  const heroLogo = document.querySelector('.hero__title');
  let heroH = heroEl?.offsetHeight || window.innerHeight;
  const mobileView = window.matchMedia('(max-width: 860px)');
  // Única condición para tocar estilos del hero: lo que se oculta al salir
  // solo lo puede volver a mostrar el parallax, así que ambos van atados a
  // lo mismo (si no, el hero queda invisible al volver a subir).
  const heroAnimated = () => !reduceMotion && !mobileView.matches;
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
            if (heroInner && heroAnimated()) { heroInner.style.opacity = 0; }
          }
        }

        if (mobileView.matches) {
          [heroInner, heroLogo, heroBg].forEach(el => { if (el && el.style.cssText) el.style.cssText = ''; });
        }

        if (heroActive && heroAnimated()) {
          if (heroBg) {
            heroBg.style.transform = `translate3d(0, ${Math.min(y, 1000) * 0.25}px, 0)`;
          }
          if (heroInner) {
            const fade = Math.max(1 - y / (heroH * 0.75), 0);
            heroInner.style.opacity = fade;
            heroInner.style.transform = `translate3d(0, ${Math.min(y * 0.18, 70)}px, 0)`;
          }
          if (heroLogo) {
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
