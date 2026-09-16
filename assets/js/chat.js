/* johannacampos.com — scripted chat (v2). No AI: visitors pick from
   pre-written questions in src/_data/chat.yml and get pre-written answers. */
(function () {
  var root = document.querySelector('[data-chat]');
  var dataEl = document.getElementById('chat-data');
  if (!root || !dataEl) return;

  var data = JSON.parse(dataEl.textContent);
  var log = root.querySelector('.chat-log');
  var choices = root.querySelector('.chat-choices');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var asked = [];
  var noteSent = false;
  var busy = false;
  var run = 0; // bumps on restart so an in-flight reply stops quietly

  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, reduceMotion ? 0 : ms); });
  }

  function scrollDown() {
    log.scrollTo({ top: log.scrollHeight, behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  function el(tag, cls, html) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html != null) node.innerHTML = html;
    return node;
  }

  // Links in the copy are written relative to the site root ("about.html").
  function resolve(url) {
    if (!url || /^([a-z]+:|\/|#)/i.test(url)) return url;
    return '/' + url;
  }

  function fixLinks(node) {
    node.querySelectorAll('a[href]').forEach(function (a) {
      a.setAttribute('href', resolve(a.getAttribute('href')));
    });
  }

  function escapeHtml(text) {
    var d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
  }

  // Copy can mention the visitor with {name}.
  function fill(bubbles, name) {
    return bubbles.map(function (html) { return html.split('{name}').join(escapeHtml(name || '')); });
  }

  function greeting() {
    var h = new Date().getHours();
    var g = data.greetings || {};
    return h < 12 ? g.morning : h < 18 ? g.afternoon : g.evening;
  }

  // One run of messages from Johanna: avatar beside the first bubble,
  // a typing indicator before each one.
  function say(bubbles, actions) {
    var myRun = run;
    var group = el('div', 'chat-row chat-row--her');
    var avatar = el('img', 'chat-row-avatar');
    avatar.src = resolve(data.avatar);
    avatar.alt = '';
    group.appendChild(avatar);
    var stack = el('div', 'chat-stack');
    group.appendChild(stack);
    log.appendChild(group);

    var chain = Promise.resolve();
    bubbles.forEach(function (html) {
      chain = chain.then(function () {
        if (myRun !== run) return;
        var typing = el('div', 'chat-typing', '<span></span><span></span><span></span>');
        typing.setAttribute('aria-label', 'Johanna is typing');
        stack.appendChild(typing);
        scrollDown();
        var text = html.replace(/<[^>]+>/g, '');
        return wait(Math.min(1500, 450 + text.length * 12)).then(function () {
          if (myRun !== run) return;
          var bubble = el('p', 'chat-bubble', html);
          fixLinks(bubble);
          stack.replaceChild(bubble, typing);
          scrollDown();
          return wait(250);
        });
      });
    });
    return chain.then(function () {
      if (myRun !== run || !actions || !actions.length) return;
      var row = el('div', 'chat-actions');
      actions.forEach(function (a) {
        var link = el('a', 'chat-action');
        link.textContent = a.label;
        link.href = resolve(a.url);
        if (a.external) { link.target = '_blank'; link.rel = 'noopener'; }
        row.appendChild(link);
      });
      stack.appendChild(row);
      scrollDown();
    });
  }

  function youSay(text) {
    var row = el('div', 'chat-row chat-row--you');
    var bubble = el('p', 'chat-bubble');
    bubble.textContent = text;
    row.appendChild(bubble);
    log.appendChild(row);
    scrollDown();
  }

  function chip(label, onClick, extraClass) {
    var b = el('button', 'chat-chip' + (extraClass ? ' ' + extraClass : ''));
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  function showChoices() {
    choices.innerHTML = '';
    data.topics.forEach(function (t, i) {
      if (asked.indexOf(i) === -1) choices.appendChild(chip(t.question, function () { choose(i); }));
    });
    if (data.note && !noteSent) choices.appendChild(chip(data.note.chip, startNote, 'chat-chip--note'));
    if (asked.length || noteSent) choices.appendChild(chip(data.restart, restart, 'chat-chip--quiet'));
  }

  // A text box in place of the choices. Resolves with the trimmed answer
  // ('' when an optional question is skipped).
  function ask(opts) {
    return new Promise(function (done) {
      var n = data.note;
      choices.innerHTML = '';
      var form = el('form', 'chat-input');
      var field = el(opts.multiline ? 'textarea' : 'input', 'chat-field');
      if (opts.multiline) field.rows = 3; else field.type = opts.type || 'text';
      field.placeholder = opts.placeholder;
      field.setAttribute('aria-label', opts.placeholder);
      if (opts.autocomplete) field.setAttribute('autocomplete', opts.autocomplete);
      field.required = !opts.optional;
      form.appendChild(field);

      var row = el('div', 'chat-input-actions');
      row.appendChild(chip(data.restart, restart, 'chat-chip--quiet'));
      if (opts.optional) row.appendChild(chip(n.skip_label, function () { done(''); }, 'chat-chip--quiet'));
      var send = el('button', 'chat-send');
      send.type = 'submit';
      send.textContent = n.send_label;
      row.appendChild(send);
      form.appendChild(row);

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var value = field.value.trim();
        if (!opts.optional && !value) { field.focus(); return; }
        done(value);
      });
      if (opts.multiline) {
        field.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
        });
      }
      choices.appendChild(form);
      field.focus({ preventScroll: true });
    });
  }

  function startNote() {
    if (busy) return;
    busy = true;
    var n = data.note;
    var myRun = run;
    var info = {};
    function live() { if (myRun !== run) throw 'stale'; }
    choices.innerHTML = '';
    youSay(n.you_say);

    wait(350)
      .then(function () { return say(n.ask_name); })
      .then(function () { live(); return ask({ placeholder: 'Your name', autocomplete: 'name' }); })
      .then(function (name) {
        live(); info.name = name; youSay(name); choices.innerHTML = '';
        return say(fill(n.ask_about, name));
      })
      .then(function () { live(); return ask({ placeholder: 'e.g. Head of product at a health startup', autocomplete: 'organization-title', optional: true }); })
      .then(function (about) {
        live(); info.about = about; if (about) youSay(about); choices.innerHTML = '';
        return say(fill(n.ask_email, info.name));
      })
      .then(function () { live(); return ask({ type: 'email', placeholder: 'you@example.com', autocomplete: 'email' }); })
      .then(function (email) {
        live(); info.email = email; youSay(email); choices.innerHTML = '';
        return say(fill(n.ask_message, info.name));
      })
      .then(function () { live(); return ask({ multiline: true, placeholder: 'Write your note…' }); })
      .then(function (message) {
        live(); youSay(message); choices.innerHTML = '';
        var body = new FormData();
        body.append('_subject', 'Note from the chat on johannacampos.com/v2');
        body.append('name', info.name);
        body.append('email', info.email);
        body.append('What they do', info.about || '(skipped)');
        body.append('message', message);
        return fetch(n.endpoint, { method: 'POST', body: body, headers: { Accept: 'application/json' } })
          .then(function (res) { return res.ok; }, function () { return false; });
      })
      .then(function (ok) {
        live();
        if (ok) noteSent = true;
        return say(fill(ok ? n.thanks : n.error, info.name));
      })
      .then(function () {
        live(); busy = false; showChoices();
      })
      .catch(function (e) { if (e !== 'stale') throw e; });
  }

  function choose(i) {
    if (busy) return;
    busy = true;
    var t = data.topics[i];
    var myRun = run;
    asked.push(i);
    choices.innerHTML = '';
    youSay(t.question);

    var actions = t.buttons.slice();
    if (t.book) actions.push({ label: data.book.label, url: data.book.url, external: true });

    wait(350)
      .then(function () { return say(t.answer, actions); })
      .then(function () {
        if (myRun !== run) return;
        var left = data.topics.length - asked.length;
        if (left) return wait(500).then(function () { return say(data.more); });
        return wait(500).then(function () {
          return say(data.done, [{ label: data.book.label, url: data.book.url, external: true }]);
        });
      })
      .then(function () {
        if (myRun !== run) return;
        busy = false;
        showChoices();
      });
  }

  function start() {
    busy = true;
    var myRun = run;
    var opening = [greeting()].concat(data.opening).filter(Boolean);
    say(opening).then(function () {
      if (myRun !== run) return;
      busy = false;
      showChoices();
    });
  }

  function restart() {
    run++;
    asked = [];
    busy = false;
    log.innerHTML = '';
    choices.innerHTML = '';
    start();
  }

  // Start typing once the chat scrolls into view, so the greeting isn't missed.
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) {
        io.disconnect();
        start();
      }
    }, { threshold: 0.35 });
    io.observe(root);
  } else {
    start();
  }
})();
