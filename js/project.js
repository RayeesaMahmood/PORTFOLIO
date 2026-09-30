/*
 * Live GitHub projects for the "More projects" list.
 *
 * Every time someone opens the portfolio, this reads your public repositories
 * from GitHub and:
 *   1. adds any repo that isn't already in the list, newest activity first
 *   2. adds "Updated 3 days ago" and a star count to every row with a GitHub link
 *   3. renumbers the rows
 *
 * The hand-written rows in index.html stay exactly as you wrote them, and if
 * GitHub can't be reached the page simply shows those rows.
 *
 * Control it from GitHub, no code changes needed:
 *   • Description  → the row's summary line   (repo ⚙ About → Description)
 *   • Website      → the "Live ↗" link        (repo ⚙ About → Website)
 *   • Topics       → the tag and tech line    (repo ⚙ About → Topics)
 *   • Add the topic "hide-from-portfolio" to keep a repo off the list.
 */
(function () {
  'use strict';

  var USER = 'RayeesaMahmood';
  var HIDE = ['RayeesaMahmood'];      // repos never shown (your profile README repo)
  var HIDE_TOPIC = 'hide-from-portfolio';
  var MAX_NEW = 12;                    // most auto-added rows
  var CACHE_KEY = 'gh-repos-v1';
  var CACHE_MS = 60 * 60 * 1000;       // refresh at most once an hour per visitor

  var list = document.getElementById('moreList');
  if (!list) return;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function ago(iso) {
    var s = (Date.now() - new Date(iso).getTime()) / 1000;
    var steps = [[31536000, 'year'], [2592000, 'month'], [604800, 'week'], [86400, 'day'], [3600, 'hour'], [60, 'minute']];
    for (var i = 0; i < steps.length; i++) {
      var n = Math.floor(s / steps[i][0]);
      if (n >= 1) return n + ' ' + steps[i][1] + (n > 1 ? 's' : '') + ' ago';
    }
    return 'just now';
  }
  // "RayCare-OS" → "RayCare OS", "kanz_hackathon" → "Kanz hackathon"
  function prettyName(name) {
    var s = name.replace(/[-_]+/g, ' ').trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  function readCache() {
    try {
      var c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (c && Date.now() - c.t < CACHE_MS && Array.isArray(c.repos)) return c.repos;
    } catch (e) { /* storage blocked */ }
    return null;
  }
  function writeCache(repos) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), repos: repos })); } catch (e) { /* ignore */ }
  }

  function fetchRepos() {
    var cached = readCache();
    if (cached) return Promise.resolve(cached);
    return fetch('https://api.github.com/users/' + USER + '/repos?per_page=100&sort=pushed', { headers: { Accept: 'application/vnd.github+json' } })
      .then(function (r) { if (!r.ok) throw new Error('GitHub ' + r.status); return r.json(); })
      .then(function (data) {
        // keep only the fields we use, so the cache stays small
        var repos = data.map(function (r) {
          return { name: r.name, description: r.description, homepage: r.homepage, html_url: r.html_url, language: r.language, topics: r.topics || [], fork: r.fork, archived: r.archived, has_pages: r.has_pages, pushed_at: r.pushed_at, stars: r.stargazers_count };
        });
        writeCache(repos);
        return repos;
      });
  }

  // Which repo (lower-case name) does a hand-written row point to?
  function repoOfRow(li) {
    var a = li.querySelector('a[href*="github.com/' + USER + '/"], a[href*="github.com/' + USER.toLowerCase() + '/"]');
    if (!a) return null;
    var m = a.getAttribute('href').match(/github\.com\/[^/]+\/([^/?#]+)/i);
    return m ? m[1].replace(/\.git$/, '').toLowerCase() : null;
  }

  function metaLine(repo) {
    var bits = ['Updated ' + ago(repo.pushed_at)];
    if (repo.stars) bits.push('★ ' + repo.stars);
    return '<p class="more-live mono">' + esc(bits.join(' · ')) + '</p>';
  }

  function toggle(btn) {
    btn.addEventListener('click', function () {
      var body = btn.nextElementSibling, open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', open ? 'true' : 'false'); body.hidden = !open;
    });
  }

  function newRow(repo) {
    var topics = (repo.topics || []).filter(function (t) { return t !== HIDE_TOPIC; });
    var tag = topics[0] ? cap(topics[0].replace(/-/g, ' ')) : (repo.language || 'Code');
    var tech = [repo.language].concat(topics.slice(0, 4).map(function (t) { return cap(t.replace(/-/g, ' ')); }))
      .filter(Boolean).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(' · ');
    var live = repo.homepage || (repo.has_pages ? 'https://' + USER.toLowerCase() + '.github.io/' + repo.name + '/' : '');
    var desc = repo.description || 'A project on GitHub. Open the code to see what it does.';

    var li = document.createElement('li');
    li.className = 'more-row more-auto';
    li.innerHTML =
      '<button type="button" class="more-sum" aria-expanded="false">' +
        '<span class="more-num mono"></span>' +
        '<span class="more-name">' + esc(prettyName(repo.name)) + '</span>' +
        '<span class="more-short">' + esc(desc) + '</span>' +
        '<span class="more-tag mono">' + esc(tag) + '</span><i aria-hidden="true">+</i>' +
      '</button>' +
      '<div class="more-body" hidden>' +
        '<p>' + esc(desc) + '</p>' +
        (tech ? '<p class="more-tech mono">' + esc(tech) + '</p>' : '') +
        metaLine(repo) +
        '<div class="more-links">' +
          (live ? '<a href="' + esc(live) + '" target="_blank" rel="noopener">Live ↗</a>' : '') +
          '<a href="' + esc(repo.html_url) + '" target="_blank" rel="noopener">Code ↗</a>' +
        '</div>' +
      '</div>';
    toggle(li.querySelector('.more-sum'));
    return li;
  }

  function renumber() {
    list.querySelectorAll('.more-row .more-num').forEach(function (el, i) {
      el.textContent = (i < 9 ? '0' : '') + (i + 1);
    });
  }

  function apply(repos) {
    var visible = repos.filter(function (r) {
      return !r.fork && !r.archived && HIDE.indexOf(r.name) < 0 && (r.topics || []).indexOf(HIDE_TOPIC) < 0;
    });
    var byName = {};
    visible.forEach(function (r) { byName[r.name.toLowerCase()] = r; });

    // 1. freshness line on hand-written rows
    var shown = {};
    list.querySelectorAll('.more-row').forEach(function (li) {
      var key = repoOfRow(li);
      if (!key) return;
      shown[key] = true;
      var repo = byName[key], body = li.querySelector('.more-body');
      if (!repo || !body || body.querySelector('.more-live')) return;
      var links = body.querySelector('.more-links');
      links.insertAdjacentHTML('beforebegin', metaLine(repo));
    });

    // 2. every other public repo, most recently updated first
    visible
      .filter(function (r) { return !shown[r.name.toLowerCase()]; })
      .sort(function (a, b) { return new Date(b.pushed_at) - new Date(a.pushed_at); })
      .slice(0, MAX_NEW)
      .forEach(function (r) { list.appendChild(newRow(r)); });

    renumber();

    // 3. say when GitHub last changed
    var latest = visible.reduce(function (m, r) { return !m || r.pushed_at > m ? r.pushed_at : m; }, null);
    var lead = document.querySelector('.more-head .lead-sm');
    if (lead && latest && !lead.querySelector('.more-sync')) {
      lead.insertAdjacentHTML('beforeend', ' <span class="more-sync mono">Synced with GitHub · last update ' + esc(ago(latest)) + '</span>');
    }
  }

  // Styles for the bits this script adds (kept here so it is one drop-in file).
  var css = document.createElement('style');
  css.textContent =
    '.more-auto{animation:moreIn .6s ease both}' +
    '@keyframes moreIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}' +
    '.more-live{font-size:11px !important;letter-spacing:.08em;color:var(--text-faint, var(--text-dim)) !important}' +
    '.more-sync{display:block;margin-top:8px;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--accent)}' +
    '@media (prefers-reduced-motion: reduce){.more-auto{animation:none}}';
  document.head.appendChild(css);

  fetchRepos().then(apply).catch(function (e) {
    // GitHub unreachable or rate-limited: the hand-written list stays as it is.
    if (window.console) console.info('Projects: showing the saved list (' + e.message + ')');
  });
})();
