/* johannacampos.com — shared behaviour: mobile nav + How I Can Help tabs */
(function () {
  // Mobile nav toggle
  var nav = document.querySelector('.site-nav');
  var toggle = nav && nav.querySelector('.nav-toggle');
  if (toggle) {
    var setOpen = function (open) {
      nav.classList.toggle('nav-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    };
    toggle.addEventListener('click', function () { setOpen(!nav.classList.contains('nav-open')); });
    nav.querySelectorAll('.nav-links a').forEach(function (a) {
      a.addEventListener('click', function () { setOpen(false); });
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
    window.matchMedia('(min-width: 768px)').addEventListener('change', function (mq) { if (mq.matches) setOpen(false); });
  }

  // Contact form: Formspree redirects back with ?sent=true after a successful
  // send, so swap the form for the thank-you note.
  var form = document.getElementById('contact-form');
  if (form && /[?&]sent=true/.test(location.search)) {
    var ok = document.getElementById('form-success');
    form.hidden = true;
    if (ok) { ok.hidden = false; ok.setAttribute('tabindex', '-1'); ok.focus(); }
  }

  // Tabs (How I Can Help). Deep links use each panel's data-slug, e.g.
  // how-i-can-help.html#design-deliver. Slugs deliberately differ from element
  // ids so the browser doesn't jump-scroll past the tab bar on arrival.
  var tablist = document.querySelector('[role="tablist"]');
  if (!tablist) return;
  var tabs = Array.prototype.slice.call(tablist.querySelectorAll('[role="tab"]'));
  var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute('aria-controls')); });

  function select(i, opts) {
    opts = opts || {};
    tabs.forEach(function (t, j) {
      var on = i === j;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      panels[j].classList.toggle('is-active', on);
    });
    if (opts.focus) tabs[i].focus();
    if (opts.updateHash) history.replaceState(null, '', '#' + panels[i].dataset.slug);
  }

  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { select(i, { updateHash: true }); });
    t.addEventListener('keydown', function (e) {
      var n = tabs.length, next = null;
      if (e.key === 'ArrowRight') next = (i + 1) % n;
      else if (e.key === 'ArrowLeft') next = (i - 1 + n) % n;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = n - 1;
      if (next !== null) { e.preventDefault(); select(next, { focus: true, updateHash: true }); }
    });
  });

  function fromHash() {
    var slug = location.hash.slice(1);
    var i = panels.findIndex(function (p) { return p.dataset.slug === slug; });
    select(i < 0 ? 0 : i);
  }
  window.addEventListener('hashchange', fromHash);
  fromHash();
})();
