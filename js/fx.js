/* ============================================================
   Rayeesa Mahmood — portfolio interactions + WebGL scenes
   Plain JS + Three.js (UMD, js/three.min.js). No build step.
   ============================================================ */
(function(){
  'use strict';

  var root = document.documentElement;
  var mq = function(q){ try{ return window.matchMedia(q).matches; }catch(e){ return false; } };
  var reduce = mq('(prefers-reduced-motion: reduce)');
  var fine = mq('(hover:hover) and (pointer:fine)');
  var small = window.innerWidth < 760;
  var clamp = function(v,a,b){ return Math.max(a, Math.min(b, v)); };
  var lerp = function(a,b,t){ return a + (b - a) * t; };

  /* one shared animation ticker for all the lightweight DOM effects */
  var tickers = [];
  function onTick(fn){ tickers.push(fn); }
  (function loop(t){ for (var i = 0; i < tickers.length; i++) tickers[i](t); requestAnimationFrame(loop); })(0);

  function whenVisible(el, cb, margin){
    if (!('IntersectionObserver' in window)) { cb(true); return; }
    new IntersectionObserver(function(es){ cb(es[0].isIntersecting); }, { rootMargin: margin || '0px' }).observe(el);
  }
  function onReady(fn){
    if (root.classList.contains('is-ready')) fn(); else window.addEventListener('portfolio:ready', fn, { once: true });
  }

  /* ---------------- nav: mobile toggle, theme, active section ---------------- */
  var nav = document.querySelector('.nav');
  var navToggle = document.getElementById('navToggle');
  var navLinks = document.getElementById('navLinks');
  if (navToggle && nav) {
    navToggle.addEventListener('click', function(){
      var open = nav.classList.toggle('nav-open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    navLinks.querySelectorAll('a').forEach(function(a){
      a.addEventListener('click', function(){ nav.classList.remove('nav-open'); navToggle.setAttribute('aria-expanded','false'); });
    });
  }
  var themeToggle = document.getElementById('themeToggle');
  if (themeToggle) themeToggle.addEventListener('click', function(){
    var t = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    try { localStorage.setItem('theme', t); } catch(e) {}
    root.setAttribute('data-theme', t);
  });
  if ('IntersectionObserver' in window && navLinks) {
    var linkFor = {};
    navLinks.querySelectorAll('a').forEach(function(a){ linkFor[a.getAttribute('href').slice(1)] = a; });
    var secIO = new IntersectionObserver(function(es){
      es.forEach(function(e){
        var a = linkFor[e.target.id]; if (!a) return;
        if (e.isIntersecting) { navLinks.querySelectorAll('a.active').forEach(function(x){ x.classList.remove('active'); }); a.classList.add('active'); }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('main section[id]').forEach(function(s){ secIO.observe(s); });
  }

  /* ---------------- scroll progress ---------------- */
  var bar = document.getElementById('scrollBar');
  var scrollY = window.scrollY;
  function onScroll(){
    scrollY = window.scrollY;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    if (bar) bar.style.transform = 'scaleX(' + (max > 0 ? scrollY / max : 0).toFixed(4) + ')';
  }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* ---------------- reveal on scroll ---------------- */
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function(es){
      es.forEach(function(e){ if (e.isIntersecting) { e.target.classList.add('in-view'); io.unobserve(e.target); } });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(function(el){ io.observe(el); });
    var sweep = function(){
      var vh = window.innerHeight;
      document.querySelectorAll('.reveal:not(.in-view)').forEach(function(el){
        var r = el.getBoundingClientRect(); if (r.top < vh - 20 && r.bottom > 0) el.classList.add('in-view');
      });
    };
    window.addEventListener('scroll', function(){ requestAnimationFrame(sweep); }, { passive: true });
  } else {
    revealEls.forEach(function(el){ el.classList.add('in-view'); });
  }

  /* ---------------- one-shot light beams ---------------- */
  if (!reduce && 'IntersectionObserver' in window) {
    var beamIO = new IntersectionObserver(function(es){
      es.forEach(function(e){ if (e.isIntersecting) { e.target.classList.add('beam-in'); beamIO.unobserve(e.target); } });
    }, { threshold: 0.25 });
    document.querySelectorAll('.section-beam-wrap').forEach(function(el){ beamIO.observe(el); });
  }

  /* ---------------- hero name: split into 3D letters ---------------- */
  var heroName = document.getElementById('heroName');
  if (heroName) {
    var gi = 0;
    heroName.querySelectorAll('[data-split]').forEach(function(line, li){
      var text = line.textContent.trim(); line.textContent = '';
      line.setAttribute('aria-hidden', 'true');
      Array.prototype.forEach.call(text, function(c){
        var s = document.createElement('span');
        s.className = c === ' ' ? 'sp' : 'ch';
        s.textContent = c;
        s.style.setProperty('--i', gi++);
        if (li === 1) s.style.setProperty('--d', '140ms');
        line.appendChild(s);
      });
    });
    var paintFill = function(){
      var chars = heroName.querySelectorAll('.hero-big-line-fill .ch'); if (!chars.length) return;
      var first = chars[0], last = chars[chars.length - 1];
      var w = last.offsetLeft + last.offsetWidth - first.offsetLeft;
      chars.forEach(function(c){ c.style.setProperty('--lw', w + 'px'); c.style.setProperty('--lx', -(c.offsetLeft - first.offsetLeft) + 'px'); });
    };
    paintFill();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(paintFill);
    window.addEventListener('resize', paintFill);
    onReady(function(){ setTimeout(function(){ heroName.classList.add('settled'); }, 1900); });
  }

  /* ---------------- hero: pointer parallax on the type + ID card ---------------- */
  var hero = document.getElementById('hero');
  var pointer = { x: 0, y: 0, tx: 0, ty: 0, inHero: false };
  if (hero && fine && !reduce) {
    hero.addEventListener('pointermove', function(e){
      var r = hero.getBoundingClientRect();
      pointer.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
      pointer.ty = ((e.clientY - r.top) / r.height) * 2 - 1;
    });
    hero.addEventListener('pointerleave', function(){ pointer.tx = 0; pointer.ty = 0; });
    var idCard = document.getElementById('idCard');
    onTick(function(){
      pointer.x = lerp(pointer.x, pointer.tx, 0.07); pointer.y = lerp(pointer.y, pointer.ty, 0.07);
      if (scrollY > window.innerHeight * 1.2) return;
      if (heroName && !hero.classList.contains('gl-name')) heroName.style.transform = 'perspective(1400px) rotateY(' + (pointer.x * 5).toFixed(2) + 'deg) rotateX(' + (-pointer.y * 4).toFixed(2) + 'deg) translate3d(' + (pointer.x * -10).toFixed(1) + 'px,' + (scrollY * 0.18).toFixed(1) + 'px,0)';
      if (idCard && !idCard.classList.contains('is-tilting')) idCard.style.transform = 'translate3d(' + (pointer.x * 14).toFixed(1) + 'px,' + (pointer.y * 10).toFixed(1) + 'px,0) rotate(2deg)';
    });
  } else if (hero && heroName && !reduce) {
    window.addEventListener('scroll', function(){ if (scrollY < window.innerHeight * 1.2 && !hero.classList.contains('gl-name')) heroName.style.transform = 'translate3d(0,' + (scrollY * 0.15).toFixed(1) + 'px,0)'; }, { passive: true });
  }

  /* ---------------- live clock on the ID card ---------------- */
  var clock = document.getElementById('idClock');
  if (clock) {
    var fmt;
    try { fmt = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' }); } catch(e) {}
    var tickClock = function(){ if (fmt) clock.textContent = 'Hyderabad · ' + fmt.format(new Date()).toUpperCase() + ' IST'; };
    tickClock(); setInterval(tickClock, 20000);
  }

  /* ---------------- 3D tilt with glare (spring-smoothed) ---------------- */
  if (fine && !reduce) {
    document.querySelectorAll('.tilt').forEach(function(el){
      var glare = document.createElement('span'); glare.className = 'tilt-glare'; glare.setAttribute('aria-hidden', 'true');
      el.appendChild(glare);
      var big = el.offsetWidth > 520;
      var maxX = big ? 5 : 10, maxY = big ? 7 : 12;
      var s = { rx: 0, ry: 0, trx: 0, try_: 0, lift: 0, tlift: 0, on: false, running: false };
      var isId = el.id === 'idCard';
      function frame(){
        s.rx = lerp(s.rx, s.trx, 0.12); s.ry = lerp(s.ry, s.try_, 0.12); s.lift = lerp(s.lift, s.tlift, 0.12);
        var base = isId ? ' rotate(2deg)' : '';
        el.style.transform = 'perspective(1100px) rotateX(' + s.rx.toFixed(2) + 'deg) rotateY(' + s.ry.toFixed(2) + 'deg) translate3d(0,' + (-s.lift).toFixed(2) + 'px,0)' + base;
        if (!s.on && Math.abs(s.rx) < .02 && Math.abs(s.ry) < .02 && s.lift < .05) {
          s.running = false; el.style.transform = isId ? 'rotate(2deg)' : ''; el.style.transition = ''; el.classList.remove('is-tilting'); return;
        }
        requestAnimationFrame(frame);
      }
      function kick(){ if (!s.running) { s.running = true; requestAnimationFrame(frame); } }
      el.addEventListener('pointerenter', function(e){ if (e.pointerType !== 'mouse') return; s.on = true; el.style.transition = 'border-color .3s, box-shadow .4s, background .3s'; el.classList.add('is-tilting'); s.tlift = big ? 4 : 6; kick(); });
      el.addEventListener('pointermove', function(e){
        if (!s.on) return;
        var r = el.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        s.trx = (0.5 - y) * maxX * 2; s.try_ = (x - 0.5) * maxY * 2;
        el.style.setProperty('--gx', (x * 100).toFixed(1) + '%'); el.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
        kick();
      });
      el.addEventListener('pointerleave', function(){ s.on = false; s.trx = 0; s.try_ = 0; s.tlift = 0; kick(); });
    });
  }

  /* ---------------- magnetic buttons ---------------- */
  if (fine && !reduce) {
    document.querySelectorAll('.magnetic').forEach(function(b){
      b.addEventListener('pointermove', function(e){
        var r = b.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        b.style.transform = 'translate(' + (dx * 0.22).toFixed(1) + 'px,' + (dy * 0.34).toFixed(1) + 'px)';
      });
      b.addEventListener('pointerleave', function(){ b.style.transform = ''; });
    });
  }

  /* ---------------- cursor glow ---------------- */
  var glow = document.getElementById('cursorGlow');
  if (glow && fine && !reduce) {
    var gp = { x: -999, y: -999, tx: -999, ty: -999 };
    window.addEventListener('pointermove', function(e){
      if (e.pointerType !== 'mouse') return;
      gp.tx = e.clientX; gp.ty = e.clientY;
      if (gp.x < -900) { gp.x = gp.tx; gp.y = gp.ty; root.classList.add('cursor-on'); }
    }, { passive: true });
    document.addEventListener('pointerleave', function(){ root.classList.remove('cursor-on'); });
    onTick(function(){
      gp.x = lerp(gp.x, gp.tx, 0.14); gp.y = lerp(gp.y, gp.ty, 0.14);
      glow.style.transform = 'translate3d(' + gp.x.toFixed(1) + 'px,' + gp.y.toFixed(1) + 'px,0)';
    });
  }

  /* ---------------- counters ---------------- */
  var stats = document.querySelector('.hero-stats');
  if (stats && !reduce && 'IntersectionObserver' in window) {
    var counted = false;
    new IntersectionObserver(function(es, obs){
      if (!es[0].isIntersecting || counted) return; counted = true; obs.disconnect();
      stats.querySelectorAll('[data-count]').forEach(function(el, k){
        var target = parseFloat(el.dataset.count), dec = parseInt(el.dataset.decimals || '0', 10), suf = el.dataset.suffix || '';
        var t0 = performance.now() + k * 120, dur = 1600;
        (function step(now){
          var p = clamp((now - t0) / dur, 0, 1), e = 1 - Math.pow(2, -10 * p);
          var val = (target * (p === 1 ? 1 : e)); el.textContent = (el.dataset.sep ? Math.round(val).toLocaleString('en-US') : val.toFixed(dec)) + suf;
          if (p < 1) requestAnimationFrame(step);
        })(t0);
        el.textContent = (0).toFixed(dec) + suf;
      });
    }, { threshold: 0.6 }).observe(stats);
  }

  /* ---------------- journey: drag to scroll + progress rail ---------------- */
  var track = document.getElementById('journeyTrack'), fill = document.getElementById('journeyFill');
  if (track) {
    var updRail = function(){
      var max = track.scrollWidth - track.clientWidth;
      if (fill) fill.style.width = (12 + 88 * (max > 0 ? track.scrollLeft / max : 1)).toFixed(1) + '%';
    };
    track.addEventListener('scroll', updRail, { passive: true }); updRail(); window.addEventListener('resize', updRail);
    var drag = null;
    track.addEventListener('pointerdown', function(e){ if (e.pointerType !== 'mouse') return; drag = { x: e.clientX, left: track.scrollLeft, moved: false }; });
    window.addEventListener('pointermove', function(e){
      if (!drag) return; var dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) > 4) { drag.moved = true; track.classList.add('dragging'); }
      if (drag.moved) track.scrollLeft = drag.left - dx;
    });
    window.addEventListener('pointerup', function(){ if (drag) { track.classList.remove('dragging'); drag = null; } });
  }

  /* ---------------- hero layers: pointer parallax ---------------- */
  var layers = document.getElementById('layers');
  if (layers && !reduce) {
    onTick(function(){
      if (scrollY > window.innerHeight * 1.2) return;
      layers.style.setProperty('--lrx', (16 - pointer.y * 9).toFixed(2) + 'deg');
      layers.style.setProperty('--lry', ((window.innerWidth < 640 ? 12 : 22) + pointer.x * 14).toFixed(2) + 'deg');
      layers.style.setProperty('--lty', (-scrollY * 0.12).toFixed(1) + 'px');
    });
  }

  /* ---------------- hero code: typed line by line ---------------- */
  var codeEl = document.getElementById('heroCode');
  if (codeEl) {
    var CODE = [
      [['c','# MediCore · claims agent pipeline']],
      [['v','STAGES'],['',' = ['],['s','"symptoms"'],['',', '],['s','"diagnosis"'],['',',']],
      [['','          '],['s','"procedure"'],['',', '],['s','"claim"'],['',', '],['s','"fraud"'],['',']']],
      [],
      [['k','def '],['f','review'],['','(patient):']],
      [['','    ctx = {'],['s','"patient"'],['',': patient}']],
      [['k','    for '],['','stage '],['k','in '],['v','STAGES'],['',':']],
      [['','        ctx = agents[stage].'],['f','run'],['','(ctx)']],
      [['','        '],['f','log'],['','(stage, ctx.confidence)']],
      [['k','    return '],['','ctx.decision  '],['c','# approve / flag']]
    ];
    var caret = document.createElement('span'); caret.className = 'caret';
    var lineEl = function(i){ var d = document.createElement('div'); var ln = document.createElement('span'); ln.className = 'ln'; ln.textContent = i + 1; d.appendChild(ln); codeEl.appendChild(d); return d; };
    var renderAll = function(){
      codeEl.textContent = '';
      CODE.forEach(function(tokens, i){ var d = lineEl(i); tokens.forEach(function(t){ var s = document.createElement('span'); if (t[0]) s.className = t[0]; s.textContent = t[1]; d.appendChild(s); }); if (!tokens.length) d.appendChild(document.createTextNode(' ')); });
      codeEl.lastChild.appendChild(caret);
    };
    if (reduce) renderAll();
    else onReady(function(){
      codeEl.textContent = '';
      var li = 0, ti = 0, ci = 0, cur = null, span = null;
      (function type(){
        if (li >= CODE.length) { if (codeEl.lastChild) codeEl.lastChild.appendChild(caret); return; }
        if (!cur) { cur = lineEl(li); cur.appendChild(caret); }
        var tokens = CODE[li];
        if (ti >= tokens.length) { if (!tokens.length) cur.insertBefore(document.createTextNode(' '), caret); li++; ti = 0; ci = 0; cur = null; span = null; return setTimeout(type, 120); }
        var tk = tokens[ti];
        if (!span) { span = document.createElement('span'); if (tk[0]) span.className = tk[0]; cur.insertBefore(span, caret); }
        span.textContent += tk[1].charAt(ci++);
        if (ci >= tk[1].length) { ti++; ci = 0; span = null; }
        setTimeout(type, tk[1].charAt(ci - 1) === ' ' ? 8 : 26 + Math.random() * 30);
      })();
    });
  }

  /* ---------------- web design: before / after slider ---------------- */
  var ba = document.getElementById('beforeAfter');
  if (ba) {
    var stageBA = ba.querySelector('.ba-stage'), handle = document.getElementById('baHandle');
    var pos = 50, setPos = function(p){ pos = clamp(p, 2, 98); stageBA.style.setProperty('--pos', pos + '%'); handle.setAttribute('aria-valuenow', Math.round(pos)); };
    var fromEvent = function(e){ var r = stageBA.getBoundingClientRect(); setPos((e.clientX - r.left) / r.width * 100); };
    var baDrag = false;
    stageBA.addEventListener('pointerdown', function(e){ baDrag = true; stageBA.classList.add('dragging'); if (stageBA.setPointerCapture) stageBA.setPointerCapture(e.pointerId); fromEvent(e); });
    stageBA.addEventListener('pointermove', function(e){ if (baDrag) fromEvent(e); });
    var endBA = function(){ baDrag = false; stageBA.classList.remove('dragging'); };
    stageBA.addEventListener('pointerup', endBA); stageBA.addEventListener('pointercancel', endBA);
    handle.addEventListener('keydown', function(e){
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { setPos(pos - 5); e.preventDefault(); }
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { setPos(pos + 5); e.preventDefault(); }
      if (e.key === 'Home') { setPos(2); e.preventDefault(); } if (e.key === 'End') { setPos(98); e.preventDefault(); }
    });
    setPos(50);
    if (!reduce && 'IntersectionObserver' in window) {
      var hinted = false;
      new IntersectionObserver(function(es, o){
        if (!es[0].isIntersecting || hinted) return; hinted = true; o.disconnect();
        var t0 = performance.now();
        (function sweep(now){
          if (baDrag) return;
          var p = clamp((now - t0) / 2200, 0, 1), e = p < .5 ? 4*p*p*p : 1 - Math.pow(-2*p + 2, 3) / 2;
          setPos(p < .5 ? lerp(50, 82, e * 2) : lerp(82, 50, (e - .5) * 2));
          if (p < 1) requestAnimationFrame(sweep);
        })(t0);
      }, { threshold: 0.6 }).observe(stageBA);
    }
  }

  /* ---------------- contact: topic chips + copy email ---------------- */
  var mail = document.getElementById('cv3Mail'), mailText = document.getElementById('cv3MailText');
  document.querySelectorAll('.cv3-chip').forEach(function(chip, _, all){
    chip.addEventListener('click', function(){
      all.forEach(function(c){ c.setAttribute('aria-pressed', c === chip ? 'true' : 'false'); });
      var topic = chip.dataset.topic;
      if (mail) mail.href = 'mailto:rayeesamahmood8098@gmail.com?subject=' + encodeURIComponent('Let’s talk about ' + topic);
      if (mailText) mailText.textContent = 'Email me about ' + topic;
    });
  });
  var copyBtn = document.getElementById('cv3Copy');
  if (copyBtn) copyBtn.addEventListener('click', function(){
    var email = 'rayeesamahmood8098@gmail.com';
    var done = function(){ copyBtn.textContent = 'Copied'; setTimeout(function(){ copyBtn.textContent = 'Copy'; }, 1800); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(email).then(done, function(){ copyBtn.textContent = 'Select it'; });
    else copyBtn.textContent = 'Select it';
  });

  /* ---------------- SELECTED WORK: pinned depth tour ---------------- */
  var tourTrack = document.getElementById('tourTrack');
  if (tourTrack) {
    var tItems = Array.prototype.slice.call(tourTrack.querySelectorAll('.tour-item'));
    var TN = tItems.length, tStage = tourTrack.querySelector('.tour-stage');
    var tNum = document.getElementById('tourNum'), tBar = document.getElementById('tourBar');
    tourTrack.style.setProperty('--n', TN);
    tItems.forEach(function(el){ el.style.setProperty('--acc', el.dataset.accent); });
    var fitScreens = function(){
      tourTrack.querySelectorAll('.scr').forEach(function(s){ var inner = s.querySelector('.scr-inner'); if (inner) inner.style.setProperty('--k', (s.clientWidth / 560).toFixed(4)); });
    };
    fitScreens(); window.addEventListener('resize', fitScreens);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitScreens);

    var lastK = -1;
    var updateTour = function(){
      var r = tourTrack.getBoundingClientRect(), vh = window.innerHeight, total = tourTrack.offsetHeight - vh;
      if (r.bottom < -vh || r.top > vh * 2) return;
      var p = clamp(-r.top / (total || 1), 0, 1), f = p * (TN - 1);
      var blurOK = !small;
      tItems.forEach(function(el, i){
        var d = i - f, s, o, b, y;
        if (d >= 0) { var dd = Math.min(d, 1.6); s = 1 - dd * 0.4; o = 1 - dd * 0.66; b = dd * 5; y = -dd * 7; }
        else { var a = -d; s = 1 + a * 1.5; o = 1 - a * 1.8; b = a * 12; y = a * 10; }
        o = clamp(o, 0, 1);
        el.style.transform = 'translate(-50%, calc(-50% + ' + y.toFixed(2) + 'vh)) scale(' + s.toFixed(4) + ')';
        el.style.opacity = o.toFixed(3);
        el.style.filter = (blurOK && b > 0.3) ? 'blur(' + b.toFixed(1) + 'px)' : 'none';
        el.style.zIndex = String(d >= 0 ? Math.round(40 - d * 10) : 50);
        el.style.visibility = o < 0.01 ? 'hidden' : 'visible';
        el.classList.toggle('is-active', Math.abs(d) < 0.35);
      });
      var k = clamp(Math.round(f), 0, TN - 1);
      if (k !== lastK) { lastK = k; tNum.textContent = String(k + 1).padStart(2, '0'); tStage.style.setProperty('--acc', tItems[k].dataset.accent); }
      tBar.style.width = (p * 100).toFixed(2) + '%';
    };
    if (!reduce) {
      var tTick = false;
      window.addEventListener('scroll', function(){ if (!tTick) { tTick = true; requestAnimationFrame(function(){ updateTour(); tTick = false; }); } }, { passive: true });
      window.addEventListener('resize', updateTour); updateTour();
    }

    // details toggles (tour + more list)
    document.querySelectorAll('.tour-details-btn').forEach(function(btn){
      btn.addEventListener('click', function(){
        var panel = btn.closest('.tour-meta').querySelector('.tour-details');
        var open = btn.getAttribute('aria-expanded') !== 'true';
        btn.setAttribute('aria-expanded', open ? 'true' : 'false'); panel.hidden = !open;
      });
    });
    document.querySelectorAll('.more-sum').forEach(function(btn){
      btn.addEventListener('click', function(){
        var body = btn.nextElementSibling, open = btn.getAttribute('aria-expanded') !== 'true';
        btn.setAttribute('aria-expanded', open ? 'true' : 'false'); body.hidden = !open;
      });
    });

    // "Take me on a tour": drives the scroll through each project, any user input stops it
    var tourBtn = document.getElementById('tourBtn'), tourTxt = document.getElementById('tourBtnText');
    var touring = false, tourTimer = null, animId = null, autoScrolling = false;
    var stopTour = function(){
      touring = false; clearTimeout(tourTimer); cancelAnimationFrame(animId); autoScrolling = false;
      if (tourBtn) { tourBtn.setAttribute('aria-pressed', 'false'); tourTxt.textContent = 'Take me on a tour'; }
    };
    var glide = function(to, dur, done){
      var from = window.scrollY, t0 = performance.now(); autoScrolling = true;
      (function step(now){
        if (!touring) return;
        var p = clamp((now - t0) / dur, 0, 1), e = p < .5 ? 4*p*p*p : 1 - Math.pow(-2*p + 2, 3) / 2;
        window.scrollTo({ top: from + (to - from) * e, behavior: 'instant' });
        if (p < 1) animId = requestAnimationFrame(step); else { autoScrolling = false; done && done(); }
      })(t0);
    };
    var startTour = function(){
      touring = true; tourBtn.setAttribute('aria-pressed', 'true'); tourTxt.textContent = 'Stop the tour';
      var top = tourTrack.getBoundingClientRect().top + window.scrollY, total = tourTrack.offsetHeight - window.innerHeight, i = 0;
      if (reduce) { window.scrollTo({ top: top, behavior: 'auto' }); stopTour(); return; }
      (function next(){
        if (!touring) return;
        var y = top + total * (i / (TN - 1));
        glide(y, i === 0 ? 1300 : 1900, function(){
          if (!touring) return; i++;
          if (i < TN) tourTimer = setTimeout(next, 2600);
          else tourTimer = setTimeout(function(){
            var more = document.getElementById('moreList');
            glide(more.getBoundingClientRect().top + window.scrollY - 160, 1500, stopTour);
          }, 2400);
        });
      })();
    };
    if (tourBtn) tourBtn.addEventListener('click', function(){ touring ? stopTour() : startTour(); });
    document.querySelectorAll('[data-tour-go]').forEach(function(btn){
      btn.addEventListener('click', function(){
        stopTour();
        var i = parseInt(btn.dataset.tourGo, 10), top = tourTrack.getBoundingClientRect().top + window.scrollY, total = tourTrack.offsetHeight - window.innerHeight;
        window.scrollTo({ top: top + total * (i / (TN - 1)), behavior: reduce ? 'auto' : 'smooth' });
      });
    });
    ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(function(ev){
      window.addEventListener(ev, function(e){ if (touring && !(ev === 'mousedown' && e.target.closest('#tourBtn')) && !(ev === 'keydown' && e.target.closest('#tourBtn'))) stopTour(); }, { passive: true });
    });
  }


  /* ---------------- HERO fallback: the same particle name drawn with Canvas 2D ----------------
     used whenever WebGL is missing, blocked or draws nothing, so the effect always shows */
  var hero2DStarted = false;
  function hero2D(){
    if (hero2DStarted || !hero || !heroName || reduce) return false;
    hero2DStarted = true;
    try {
      var cv = document.createElement('canvas'); cv.className = 'hero-2d'; cv.setAttribute('aria-hidden', 'true');
      var old = document.getElementById('heroGL'); if (old) old.style.display = 'none';
      hero.insertBefore(cv, hero.firstChild);
      var ctx = cv.getContext('2d'); if (!ctx) throw 0;
      var DPR = Math.min(window.devicePixelRatio || 1, 2), W = 1, H = 1;
      var N = 0, P = null, V = null, HX, HY, CI, SZ, PH, buckets = [];
      var STN = small ? 160 : 320, ST = [];
      for (var i = 0; i < STN; i++) ST.push({ x: Math.random(), y: Math.random(), r: .4 + Math.random() * 1.1, p: Math.random() * 6.28 });
      var PAL = [];
      function mix(a, b, t){ return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)]; }
      var cA = [255,122,48], cB = [255,178,56], cC = [255,77,106], cW = [255,242,226];
      PAL.push('rgb(255,242,226)', 'rgb(255,226,190)');
      for (var q = 0; q < 12; q++) { var t = q / 11, c = t < .5 ? mix(cB, cA, t * 2) : mix(cA, cC, (t - .5) * 2); PAL.push('rgb(' + c.join(',') + ')'); }
      function offsetIn(el){ var x = 0, y = 0; while (el && el !== hero) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; } return { x: x, y: y }; }
      function sample(){
        var chars = heroName.querySelectorAll('.ch'); if (!chars.length) return;
        var fs = parseFloat(getComputedStyle(heroName).fontSize);
        var off = document.createElement('canvas'); off.width = W; off.height = H;
        var g = off.getContext('2d'); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
        g.font = '700 ' + fs + 'px "Space Grotesk", Arial, sans-serif';
        var capH = g.measureText('M').actualBoundingBoxAscent || fs * .7, x1 = [1e9, -1e9], splitY = 1e9;
        chars.forEach(function(c){
          var o = offsetIn(c), fill = !!c.closest('.hero-big-line-fill');
          g.fillText(c.textContent, o.x + c.offsetWidth / 2, o.y + c.offsetHeight / 2 + capH / 2);
          if (fill) { splitY = Math.min(splitY, o.y); x1[0] = Math.min(x1[0], o.x); x1[1] = Math.max(x1[1], o.x + c.offsetWidth); }
        });
        var data = g.getImageData(0, 0, W, H).data, maxN = small ? 3200 : 7000, step = Math.max(3, Math.round(fs / 55)), list;
        for (;;) { list = []; for (var y = 0; y < H; y += step) for (var x = 0; x < W; x += step) if (data[(y * W + x) * 4 + 3] > 128) list.push(x, y); if (list.length / 2 <= maxN) break; step++; }
        var n = list.length / 2, oP = P, oN = N;
        N = n; P = new Float32Array(N * 2); V = new Float32Array(N * 2); HX = new Float32Array(N); HY = new Float32Array(N); CI = new Uint8Array(N); SZ = new Float32Array(N); PH = new Float32Array(N);
        for (var k = 0; k < N; k++) {
          var sx = list[k*2] + (Math.random() - .5) * step * .7, sy = list[k*2+1] + (Math.random() - .5) * step * .7;
          HX[k] = sx; HY[k] = sy; PH[k] = Math.random() * 6.28; SZ[k] = Math.max(.8, step * (.2 + Math.random() * .16));
          CI[k] = sy >= splitY ? 2 + Math.round(clamp((sx - x1[0]) / (x1[1] - x1[0] || 1), 0, 1) * 11) : (Math.random() < .8 ? 0 : 1);
          if (oP && k < oN) { P[k*2] = oP[k*2]; P[k*2+1] = oP[k*2+1]; }
          else { var a = Math.random() * 6.28, r = Math.max(W, H) * (.35 + Math.random() * .6); P[k*2] = W / 2 + Math.cos(a) * r; P[k*2+1] = H / 2 + Math.sin(a) * r * .7; }
        }
        buckets = PAL.map(function(){ return []; }); for (k = 0; k < N; k++) buckets[CI[k]].push(k);
        hero.classList.add('gl-name');
      }
      function layout(){
        W = hero.clientWidth; H = hero.clientHeight;
        cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); cv.style.width = W + 'px'; cv.style.height = H + 'px';
        sample();
      }
      var rsT; window.addEventListener('resize', function(){ clearTimeout(rsT); rsT = setTimeout(layout, 180); });
      layout(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
      var m = { x: -1e4, y: -1e4, px: 0, py: 0, on: false, vx: 0, vy: 0 };
      function loc(e){ var r = hero.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
      hero.addEventListener('pointermove', function(e){ var w = loc(e); m.x = w.x; m.y = w.y; m.on = true; }, { passive: true });
      hero.addEventListener('pointerleave', function(){ m.on = false; });
      hero.addEventListener('pointerdown', function(e){
        if (e.target.closest('a,button') || !P) return;
        var w = loc(e), R = 420;
        for (var k = 0; k < N; k++) { var dx = P[k*2] - w.x, dy = P[k*2+1] - w.y, d = Math.sqrt(dx*dx + dy*dy) + .01; if (d < R) { var f = (1 - d / R) * 30; V[k*2] += dx / d * f; V[k*2+1] += dy / d * f; } }
        if (e.pointerType !== 'mouse') { m.x = w.x; m.y = w.y; m.on = true; setTimeout(function(){ m.on = false; }, 400); }
      });
      var t0 = performance.now(), last = t0, intro = t0;
      function frame(now){
        requestAnimationFrame(frame);
        var hr = hero.getBoundingClientRect(); if (hr.bottom < -50 || hr.top > (window.innerHeight || 800) + 50) { last = now; return; }
        var dt = Math.min(2, (now - last) / 16.67); last = now;
        var t = (now - t0) / 1000, ip = clamp((now - intro) / 2200, 0, 1), alpha = ease2(clamp(ip * 1.6, 0, 1));
        m.vx = lerp(m.vx, m.x - m.px, .5); m.vy = lerp(m.vy, m.y - m.py, .5); m.px = m.x; m.py = m.y;
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H);
        // stars
        ctx.fillStyle = '#fff2e2';
        for (var s = 0; s < STN; s++) { var st = ST[s]; ctx.globalAlpha = alpha * (.25 + .35 * (Math.sin(t * 1.3 + st.p) * .5 + .5)); ctx.fillRect(st.x * W, st.y * H, st.r, st.r); }
        if (P) {
          var K = (.006 + .042 * ease2(ip)) * dt, D = Math.pow(.85, dt), R = 120 * clamp(W / 1440, .5, 1.3), R2 = R * R, F = 7.5 * dt;
          for (var k = 0; k < N; k++) {
            var i2 = k * 2, px = P[i2], py = P[i2+1];
            var vx = V[i2] + (HX[k] + Math.sin(t * .9 + PH[k]) * .9 - px) * K, vy = V[i2+1] + (HY[k] + Math.cos(t * .8 + PH[k]) * .9 - py) * K;
            if (m.on) { var dx = px - m.x, dy = py - m.y, d2 = dx*dx + dy*dy; if (d2 < R2) { var d = Math.sqrt(d2) + .01, f = 1 - d / R; f = f * f * F; vx += dx / d * f + m.vx * f * .06; vy += dy / d * f + m.vy * f * .06; } }
            vx *= D; vy *= D; V[i2] = vx; V[i2+1] = vy; P[i2] = px + vx * dt; P[i2+1] = py + vy * dt;
          }
          ctx.globalAlpha = alpha * .95;
          for (var b = 0; b < buckets.length; b++) {
            var bk = buckets[b]; if (!bk.length) continue;
            ctx.fillStyle = PAL[b]; ctx.beginPath();
            for (var j = 0; j < bk.length; j++) { var kk = bk[j], sz = SZ[kk]; ctx.moveTo(P[kk*2] + sz, P[kk*2+1]); ctx.arc(P[kk*2], P[kk*2+1], sz, 0, 6.2832); }
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
      }
      function ease2(x){ return 1 - Math.pow(1 - x, 3); }
      requestAnimationFrame(frame);
      return true;
    } catch (e) {
      hero.classList.remove('gl-name');
      return false;
    }
  }

  /* ============================================================
     WebGL (Three.js)
     ============================================================ */
  var THREE = window.THREE;
  if (!THREE) { hero2D(); return; }

  var SHADER_V = [
    'uniform float uTime; uniform float uPR; uniform float uWave; uniform float uIntro; uniform float uSize;',
    'attribute float aSize; attribute float aPhase; attribute vec3 aColor;',
    'varying vec3 vColor; varying float vAlpha;',
    'void main(){',
    '  vec3 p = position;',
    '  float w = sin(uTime * 1.6 + aPhase + p.y * 2.2) * uWave;',
    '  p += normalize(p + vec3(1e-4)) * w;',
    '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
    '  gl_Position = projectionMatrix * mv;',
    '  float tw = 0.62 + 0.38 * sin(uTime * 2.1 + aPhase * 3.0);',
    '  gl_PointSize = aSize * uSize * uPR * (260.0 / -mv.z) * (0.35 + 0.65 * uIntro);',
    '  vColor = aColor; vAlpha = tw * uIntro;',
    '}'
  ].join('\n');
  var SHADER_F = [
    'uniform float uOpacity; varying vec3 vColor; varying float vAlpha;',
    'void main(){',
    '  float d = length(gl_PointCoord - 0.5);',
    '  float a = pow(smoothstep(0.5, 0.0, d), 1.7);',
    '  gl_FragColor = vec4(vColor, a * vAlpha * uOpacity);',
    '}'
  ].join('\n');

  var COL = { a: new THREE.Color('#ff7a30'), b: new THREE.Color('#ffb238'), c: new THREE.Color('#ff4d6a'), w: new THREE.Color('#fff2e2') };

  function makeRenderer(canvas, maxPR){
    try {
      var r = new THREE.WebGLRenderer({ canvas: canvas, antialias: !small, alpha: true, powerPreference: 'high-performance' });
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPR));
      r.setClearColor(0x000000, 0);
      return r;
    } catch(e) { return null; }
  }
  function glowTexture(){
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,255,255,.55)');
    grd.addColorStop(0.6, 'rgba(255,255,255,.12)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    var t = new THREE.CanvasTexture(c); return t;
  }
  function pointCloud(positions, colors, sizes, shared, opts){
    var n = positions.length / 3, phases = new Float32Array(n);
    for (var i = 0; i < n; i++) phases[i] = Math.random() * 6.283;
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    var m = new THREE.ShaderMaterial({
      uniforms: { uTime: shared.uTime, uPR: shared.uPR, uIntro: shared.uIntro, uWave: { value: opts.wave || 0 }, uOpacity: { value: opts.opacity == null ? 1 : opts.opacity }, uSize: { value: opts.size || 1 } },
      vertexShader: SHADER_V, fragmentShader: SHADER_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    return new THREE.Points(g, m);
  }
  function fib(n, r){
    var out = new Float32Array(n * 3), golden = Math.PI * (3 - Math.sqrt(5));
    for (var i = 0; i < n; i++) {
      var y = 1 - (i / (n - 1)) * 2, rr = Math.sqrt(1 - y * y), phi = i * golden;
      out[i*3] = Math.cos(phi) * rr * r; out[i*3+1] = y * r; out[i*3+2] = Math.sin(phi) * rr * r;
    }
    return out;
  }
  function gradientColor(t, target){
    // orange -> amber -> rose across t in [0,1]
    if (t < 0.5) target.copy(COL.b).lerp(COL.a, t * 2); else target.copy(COL.a).lerp(COL.c, (t - 0.5) * 2);
    return target;
  }
  var tmpC = new THREE.Color();
  var ease = { outBack: function(x){ var c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }, outCubic: function(x){ return 1 - Math.pow(1 - x, 3); } };

  /* ---------------- HERO: your name as interactive 3D particles ---------------- */
  function heroFallback(){ if (hero) hero.classList.remove('gl-name'); var c = document.getElementById('heroGL'); if (c) c.style.display = 'none'; hero2D(); }
  try { (function heroScene(){
    var canvas = document.getElementById('heroGL'); if (!canvas || !hero) return;
    var renderer = makeRenderer(canvas, small ? 1.5 : 2); if (!renderer) { heroFallback(); return; }
    var PR = renderer.getPixelRatio();
    var scene = new THREE.Scene();
    var FOV = 35, camera = new THREE.PerspectiveCamera(FOV, 1, 1, 20000);
    var W = 1, H = 1, DIST = 1000;
    var shared = { uTime: { value: 0 }, uPR: { value: PR }, uIntro: { value: reduce ? 1 : 0 } };

    // background stars (reuse the shared twinkling point shader)
    var SN = small ? 700 : 1500, sp = new Float32Array(SN*3), sc = new Float32Array(SN*3), ss = new Float32Array(SN);
    for (var i = 0; i < SN; i++) {
      sp[i*3] = (Math.random() - .5) * 5000; sp[i*3+1] = (Math.random() - .5) * 3200; sp[i*3+2] = -600 - Math.random() * 2600;
      tmpC.copy(COL.w).lerp(COL.b, Math.random() * .4); sc[i*3] = tmpC.r; sc[i*3+1] = tmpC.g; sc[i*3+2] = tmpC.b; ss[i] = 1 + Math.random() * 2.2;
    }
    var stars = pointCloud(sp, sc, ss, shared, { opacity: 0.8, size: 9 });
    scene.add(stars);

    // the name
    var group = new THREE.Group(); scene.add(group);
    var NAME_V = [
      'uniform float uPR; uniform float uDist; uniform float uIntro;',
      'attribute float aSize; attribute vec3 aColor;',
      'varying vec3 vColor; varying float vA;',
      'void main(){',
      '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
      '  gl_Position = projectionMatrix * mv;',
      '  float k = uDist / -mv.z;',
      '  gl_PointSize = aSize * uPR * k;',
      '  vColor = aColor * (0.85 + 0.35 * clamp((k - 1.0) * 3.0, 0.0, 1.0));',
      '  vA = uIntro;',
      '}'].join('\n');
    var NAME_F = [
      'varying vec3 vColor; varying float vA;',
      'void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.15, d); gl_FragColor = vec4(vColor, a * vA * 0.95); }'].join('\n');
    var nameMat = new THREE.ShaderMaterial({
      uniforms: { uPR: { value: PR }, uDist: { value: DIST }, uIntro: shared.uIntro },
      vertexShader: NAME_V, fragmentShader: NAME_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    var pts = null, N = 0, P, V, HX, HY, HZ, PH;

    function offsetIn(el, stop){ var x = 0, y = 0; while (el && el !== stop) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; } return { x: x, y: y }; }

    function sample(){
      var chars = heroName ? heroName.querySelectorAll('.ch') : [];
      if (!chars.length) return false;
      var fs = parseFloat(getComputedStyle(heroName).fontSize);
      var off = document.createElement('canvas'); off.width = W; off.height = H;
      var g = off.getContext('2d'); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      g.font = '700 ' + fs + 'px "Space Grotesk", Arial, sans-serif';
      var capH = g.measureText('M').actualBoundingBoxAscent || fs * 0.7;
      var lineOf = [], lineX = [[1e9, -1e9], [1e9, -1e9]];
      chars.forEach(function(c){
        var o = offsetIn(c, hero), li = c.closest('.hero-big-line-fill') ? 1 : 0;
        var cx = o.x + c.offsetWidth / 2, base = o.y + c.offsetHeight / 2 + capH / 2;
        g.fillText(c.textContent, cx, base);
        lineX[li][0] = Math.min(lineX[li][0], o.x); lineX[li][1] = Math.max(lineX[li][1], o.x + c.offsetWidth);
        lineOf.push([o.y, o.y + c.offsetHeight, li]);
      });
      var data = g.getImageData(0, 0, W, H).data;
      var maxN = small ? 6000 : 20000, step = Math.max(2, Math.round(fs / 70)), list = [];
      for (;;) {
        list = [];
        for (var y = 0; y < H; y += step) for (var x = 0; x < W; x += step) if (data[(y * W + x) * 4 + 3] > 128) list.push(x, y);
        if (list.length / 2 <= maxN) break; step++;
      }
      var n = list.length / 2;
      var old = P, oldN = N;
      N = n; P = new Float32Array(N*3); V = new Float32Array(N*3); HX = new Float32Array(N); HY = new Float32Array(N); HZ = new Float32Array(N); PH = new Float32Array(N);
      var col = new Float32Array(N*3), siz = new Float32Array(N);
      var splitY = 0; lineOf.forEach(function(l){ if (l[2] === 1) splitY = splitY ? Math.min(splitY, l[0]) : l[0]; });
      for (var k = 0; k < N; k++) {
        var sx = list[k*2] + (Math.random() - .5) * step * .6, sy = list[k*2+1] + (Math.random() - .5) * step * .6;
        HX[k] = sx - W / 2; HY[k] = H / 2 - sy; HZ[k] = (Math.random() - .5) * 24; PH[k] = Math.random() * 6.283;
        var li = sy >= splitY ? 1 : 0;
        if (li === 1) { gradientColor(clamp((sx - lineX[1][0]) / (lineX[1][1] - lineX[1][0] || 1), 0, 1), tmpC); }
        else { tmpC.copy(COL.w).lerp(COL.b, Math.random() * .18); }
        col[k*3] = tmpC.r; col[k*3+1] = tmpC.g; col[k*3+2] = tmpC.b;
        siz[k] = step * (0.8 + Math.random() * 0.5);
        if (old && k < oldN) { P[k*3] = old[k*3]; P[k*3+1] = old[k*3+1]; P[k*3+2] = old[k*3+2]; }
        else { var a = Math.random() * 6.283, r = Math.max(W, H) * (0.4 + Math.random() * .8); P[k*3] = Math.cos(a) * r; P[k*3+1] = Math.sin(a) * r * .7; P[k*3+2] = -1600 + Math.random() * 2200; }
      }
      if (pts) { group.remove(pts); pts.geometry.dispose(); }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(P, 3).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
      geo.setAttribute('aSize', new THREE.BufferAttribute(siz, 1));
      pts = new THREE.Points(geo, nameMat); pts.frustumCulled = false; group.add(pts);
      hero.classList.add('gl-name');
      return true;
    }

    function layout(){
      W = hero.clientWidth; H = hero.clientHeight;
      renderer.setSize(W, H, false); camera.aspect = W / H;
      DIST = (H / 2) / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
      camera.position.set(0, 0, DIST); camera.near = 1; camera.far = DIST + 4000; camera.updateProjectionMatrix();
      nameMat.uniforms.uDist.value = DIST;
      if (!reduce) sample();
    }
    var rsT; window.addEventListener('resize', function(){ clearTimeout(rsT); rsT = setTimeout(layout, 180); });
    layout();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ layout(); });

    // pointer: repel, brush and click-to-scatter
    var m = { x: 0, y: 0, px: 0, py: 0, on: false, vx: 0, vy: 0 };
    function toWorld(e){ var r = hero.getBoundingClientRect(); return { x: e.clientX - r.left - W / 2, y: H / 2 - (e.clientY - r.top) }; }
    hero.addEventListener('pointermove', function(e){ var w = toWorld(e); m.x = w.x; m.y = w.y; m.on = true; }, { passive: true });
    hero.addEventListener('pointerleave', function(){ m.on = false; });
    hero.addEventListener('pointerdown', function(e){
      if (e.target.closest('a,button') || !P) return;
      var w = toWorld(e), R = 480;
      for (var k = 0; k < N; k++) {
        var dx = P[k*3] - w.x, dy = P[k*3+1] - w.y, d = Math.sqrt(dx*dx + dy*dy) + .01;
        if (d < R) { var f = (1 - d / R) * 34; V[k*3] += dx / d * f; V[k*3+1] += dy / d * f; V[k*3+2] += (Math.random() * 1.4 - .2) * f; }
      }
      if (e.pointerType !== 'mouse') { m.x = w.x; m.y = w.y; m.on = true; setTimeout(function(){ m.on = false; }, 400); }
    });

    var t0 = performance.now(), last = t0, introStart = null, running = false, checked = false, failed = false;
    canvas.classList.add('on');
    function beginIntro(){ if (introStart == null) introStart = performance.now(); }
    onReady(beginIntro);
    setTimeout(beginIntro, 2600);               // fallback if the preloader event never arrives
    if (root.classList.contains('is-ready')) beginIntro();
    canvas.addEventListener('webglcontextlost', function(e){ e.preventDefault(); failed = true; heroFallback(); });

    // after the intro, confirm particles are really on screen; otherwise show the normal lettering
    function verify(){
      if (checked || !pts || N === 0) return; checked = true;
      try {
        var gl = renderer.getContext(), buf = renderer.getDrawingBufferSize(new THREE.Vector2());
        var sx = buf.x / W, sy = buf.y / H, px = new Uint8Array(4), hits = 0, tries = Math.min(40, N);
        for (var j = 0; j < tries; j++) {
          var k = Math.floor(j * N / tries), cx = Math.round((P[k*3] + W / 2) * sx), cy = Math.round((P[k*3+1] + H / 2) * sy);
          if (cx < 0 || cy < 0 || cx >= buf.x || cy >= buf.y) continue;
          gl.readPixels(cx, cy, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          if (px[0] + px[1] + px[2] + px[3] > 30) hits++;
        }
        if (hits === 0 || gl.isContextLost()) { failed = true; heroFallback(); }
      } catch (e) { failed = true; heroFallback(); }
    }

    function frame(now){
      if (failed) { running = false; return; }
      requestAnimationFrame(frame);
      var hr = hero.getBoundingClientRect();
      if (hr.bottom < -50 || hr.top > (window.innerHeight || 800) + 50) { last = now; return; }
      var dt = Math.min(2, (now - last) / 16.67); last = now;
      var t = (now - t0) / 1000; shared.uTime.value = t;
      var ip = introStart == null ? 0 : clamp((now - introStart) / 2200, 0, 1);
      if (shared.uIntro.value < 1) shared.uIntro.value = ease.outCubic(clamp(ip * 1.6, 0, 1));
      m.vx = lerp(m.vx, m.x - m.px, .5); m.vy = lerp(m.vy, m.y - m.py, .5); m.px = m.x; m.py = m.y;
      if (P) {
        var K = (0.006 + 0.042 * ease.outCubic(ip)) * dt, D = Math.pow(0.85, dt);
        var fsScale = clamp(W / 1440, 0.5, 1.3), R = 120 * fsScale, R2 = R * R, F = 7.5 * dt;
        for (var k = 0; k < N; k++) {
          var i3 = k * 3, px = P[i3], py = P[i3+1], pz = P[i3+2];
          var hx = HX[k] + Math.sin(t * .9 + PH[k]) * .9, hy = HY[k] + Math.cos(t * .8 + PH[k]) * .9;
          var vx = V[i3] + (hx - px) * K, vy = V[i3+1] + (hy - py) * K, vz = V[i3+2] + (HZ[k] - pz) * K;
          if (m.on && ip > 0) {
            var dx = px - m.x, dy = py - m.y, d2 = dx*dx + dy*dy;
            if (d2 < R2) {
              var d = Math.sqrt(d2) + .01, f = 1 - d / R; f = f * f * F;
              vx += dx / d * f + m.vx * f * .06; vy += dy / d * f + m.vy * f * .06; vz += f * 5;
            }
          }
          vx *= D; vy *= D; vz *= D;
          V[i3] = vx; V[i3+1] = vy; V[i3+2] = vz;
          P[i3] = px + vx * dt; P[i3+1] = py + vy * dt; P[i3+2] = pz + vz * dt;
        }
        pts.geometry.attributes.position.needsUpdate = true;
      }
      group.rotation.y = lerp(group.rotation.y, pointer.x * 0.12, .05);
      group.rotation.x = lerp(group.rotation.x, pointer.y * 0.08, .05);
      stars.rotation.z += 0.00008 * dt;
      renderer.render(scene, camera);
      if (!checked && ip >= 0.7) verify();
    }
    function start(){ if (!running && !reduce) { running = true; last = performance.now(); requestAnimationFrame(frame); } }
    if (reduce) { shared.uIntro.value = 1; renderer.render(scene, camera); return; }
    // never let the loop die: it only skips work while the hero is scrolled away
    document.addEventListener('visibilitychange', function(){ if (!document.hidden) start(); });
    window.addEventListener('focus', start); window.addEventListener('pageshow', start);
    start();
  })(); } catch (err) { heroFallback(); }



})();
