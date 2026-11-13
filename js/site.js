/* The website's one small script. No framework, no trackers, no cookies.

   What it does:
   1. Reads the site's settings (data/site.json). A copy is stamped into js/site-data.js by tools/build.py so the
      pages also work when opened from disk; on a web host the live file is read too, so a change to site.json
      shows at once.
   2. Puts those settings into the page: the product's name, her name, prices, download links, contact details.
      The same words are already in the HTML (tools/build.py stamps them), so the page is right without this script.
   3. Draws the plans with the monthly / yearly switch.
   4. Sends the two forms (free trial, buy) to the operator's server and asks it about a payment on the thank-you
      page. See "the operator's server" below: it is the only place a request leaves this website.

   The only thing kept in the browser is the reference of a purchase in progress (sessionStorage, gone when the tab
   closes), so the thank-you page can ask how that payment went. */
(function () {
  'use strict';

  var SITE = window.SITE || {};
  var root = document.documentElement;
  var PAGE = root.getAttribute('data-page') || '';

  /* ------------------------------------------------------------------------------------------ small helpers */
  function $(sel, el) { return (el || document).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function isNum(x) { return typeof x === 'number' && isFinite(x) && x >= 0; }
  function plans(S) { return Array.isArray(S.plans) ? S.plans.filter(function (p) { return p && p.id; }) : []; }
  /* period: 'monthly', 'yearly' or 'once' (the one-time licence, only for a plan with price_once) */
  function priceOf(p, period) { return period === 'once' ? p.price_once : period === 'yearly' ? p.price_yearly : p.price_monthly; }
  function priced(p) { return isNum(p.price_monthly) || isNum(p.price_yearly) || isNum(p.price_once); }
  function query(name) {
    var m = new RegExp('[?&]' + name + '=([^&#]*)').exec(window.location.search);
    return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : '';
  }

  /* Every setting as plain words, by a dotted name: name, employee, company.legal_name, downloads.mac ...
     tools/build.py has the same list; keep the two alike. */
  function values(S) {
    var V = {};
    (function walk(prefix, node) {
      Object.keys(node || {}).forEach(function (k) {
        var v = node[k];
        if (k.charAt(0) === '_' || k === 'plans' || k === 'every_plan') return;
        if (v && typeof v === 'object' && !Array.isArray(v)) walk(prefix + k + '.', v);
        else if (typeof v === 'string' || typeof v === 'number') V[prefix + k] = String(v).trim();
      });
    })('', S);
    V.employee = V.employee_name || '';
    V.employee_initial = V.employee.charAt(0).toUpperCase();
    V.year = String(new Date().getFullYear());
    V.owner = V['company.legal_name'] || V.name || '';
    V.trial_cta = 'Start your ' + (V.trial_days || '') + '-day free trial';
    V.api_base = (V.api_base || '').replace(/\/+$/, '');
    V.can_trial = V.api_base ? '1' : '';
    V.can_buy = V.api_base && plans(S).some(priced) && S.buying_open !== false ? '1' : '';
    var once = plans(S).filter(function (p) { return isNum(p.price_once); })[0];   /* the one-time licence, if any */
    V.once_price = once ? money(once.price_once, once.currency) : '';
    V.once_plan = once ? String(once.name || '') : '';
    var digits = (V.support_whatsapp || '').replace(/\D/g, '');
    V.wa_link = digits ? 'https://wa.me/' + digits : '';
    V.has_contact = V.support_email || V.wa_link ? '1' : '';
    V.has_social = ['linkedin', 'x', 'instagram', 'youtube'].some(function (k) { return V['social.' + k]; }) ? '1' : '';
    return V;
  }
  function fill(template, V) {
    return String(template).replace(/\{([\w.]+)\}/g, function (_, key) { return V[key] == null ? '' : V[key]; });
  }

  /* ------------------------------------------------------------------------------------------ money, in words */
  function groupIndian(whole) {
    var s = String(whole);
    if (s.length <= 3) return s;
    return s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + s.slice(-3);
  }
  function money(amount, currency) {
    var whole = Math.floor(amount);
    var paise = Math.round((amount - whole) * 100);
    if (paise === 100) { whole += 1; paise = 0; }
    var cents = paise ? '.' + (paise < 10 ? '0' : '') + paise : '';
    if (!currency || currency === 'INR') return '₹' + groupIndian(whole) + cents;
    return currency + ' ' + String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + cents;
  }
  /* What a year paid at once saves against twelve monthly payments, or null when either price is missing. */
  function saving(p) {
    if (!isNum(p.price_monthly) || !isNum(p.price_yearly) || p.price_monthly <= 0) return null;
    var amount = p.price_monthly * 12 - p.price_yearly;
    if (amount <= 0) return null;
    var months = amount / p.price_monthly;
    return { amount: amount, months: Math.abs(months - Math.round(months)) < 1e-9 ? Math.round(months) : 0 };
  }
  function monthsFree(n) { return n === 1 ? '1 month free' : n + ' months free'; }
  function periodNote(S) {
    var list = plans(S).map(saving).filter(Boolean);
    if (!list.length) {
      return plans(S).some(function (p) { return isNum(p.price_monthly) || isNum(p.price_yearly); })
        ? '' : 'Paying for a year at once will cost less than twelve monthly payments. The saving shows here once prices are announced.';
    }
    var same = list.every(function (s) { return s.months && s.months === list[0].months; });
    return same ? 'Pay for a year at once and get ' + monthsFree(list[0].months) + '.' : 'Paying for a year at once costs less than twelve monthly payments.';
  }

  /* ------------------------------------------------------------------------------------------ the plans
     One card per plan. tools/build.py draws the same cards into pricing.html for people without JavaScript:
     change one, change the other. */
  function planCard(p, period, V) {
    var price = priceOf(p, period), has = isNum(price), cur = p.currency || 'INR';
    var cta = esc(V.trial_cta);
    var quiet = !p.ai_included, hot = !!p.highlight && !quiet;
    var out = '<article class="plan' + (hot ? ' is-highlight' : '') + (quiet ? ' plan-wide' : '') + '" data-plan="' + esc(p.id) + '">';
    out += '<div class="plan-top"><h3 class="plan-name">' + esc(p.name) + '</h3>';
    out += '<p class="plan-blurb">' + esc(p.blurb || '') + '</p></div>';
    out += '<div class="plan-cost">';
    if (has) {
      out += '<p class="plan-price"><span class="amount">' + esc(money(price, cur)) + '</span> <span class="per">' + (period === 'yearly' ? 'a year' : 'a month') + '</span></p>';
      var s = saving(p), extra = '';
      if (period === 'yearly' && s) {
        extra = '<p class="plan-saving">' + (s.months ? monthsFree(s.months) + ': you save ' : 'You save ') + esc(money(s.amount, cur)) + ' a year</p>';
      } else if (period !== 'yearly' && isNum(p.price_yearly)) {
        extra = '<p class="plan-alt">or ' + esc(money(p.price_yearly, cur)) + ' a year' + (s && s.months ? ', ' + monthsFree(s.months) : '') + '</p>';
      }
      out += extra + '<p class="plan-note">' + esc(V.price_note || '') + '</p>';
    } else {
      out += '<p class="plan-price soon">Price announced soon</p>';
    }
    out += '</div>';
    out += '<div class="plan-ai"><span class="tag' + (p.ai_included ? ' info' : '') + '">' + (p.ai_included ? 'AI included' : 'Your own AI key') + '</span>';
    out += '<p>' + esc(p.allowance || (p.ai_included ? 'Monthly allowance announced soon' : 'You pay your AI provider directly for what she uses.')) + '</p></div>';
    var feats = Array.isArray(p.features) ? p.features.filter(Boolean) : [];
    if (feats.length) out += '<ul class="ticks">' + feats.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>';
    out += '<div class="plan-actions"><a class="btn' + (hot ? ' brand' : '') + '" href="trial.html">' + cta + '</a>';
    out += '<a class="btn quiet" href="help.html#contact" data-talk="' + esc(p.name) + ' plan">Talk to us</a></div>';
    return out + onceBlock(p, V) + '</article>';
  }
  /* The quiet "or pay once" row of a plan that can also be bought once (price_once). The same as once_block in
     tools/build.py. It does not change with the monthly / yearly switch: it is a third way to pay, for this plan only. */
  function onceBlock(p, V) {
    if (!isNum(p.price_once)) return '';
    var href = 'buy.html?plan=' + encodeURIComponent(p.id) + '&period=once';
    var out = '<div class="plan-once">';
    out += '<div class="plan-once-top"><h4 class="plan-once-name">Or pay once</h4>';
    out += '<p class="plan-blurb">One payment instead of paying every month or year.</p></div>';
    out += '<div class="plan-once-cost"><p class="plan-price"><span class="amount">' + esc(money(p.price_once, p.currency || 'INR')) + '</span> <span class="per">once</span></p>';
    out += '<p class="plan-note">' + esc(V.price_note || '') + '</p></div>';
    out += '<div class="plan-once-what"><ul class="ticks"><li>The licence does not expire</li>';
    out += '<li>Support and updates for one year from the day you pay</li></ul>';
    out += '<p>After that year she keeps working. What her AI uses is billed to your own Anthropic account.</p></div>';
    out += '<div class="plan-once-act"><a class="btn" href="' + esc(href) + '">Pay once</a></div>';
    return out + '</div>';
  }
  /* A plan we run on our own servers (hosted: true, the Managed plan): its own wide card under the others, with what
     we do and, said plainly, what is different. No trial button and no paying once. The same as hosted_card in
     tools/build.py. */
  function costHtml(p, period, V) {
    var price = priceOf(p, period), cur = p.currency || 'INR';
    if (!isNum(price)) return '<p class="plan-price soon">Price announced soon</p>';
    var out = '<p class="plan-price"><span class="amount">' + esc(money(price, cur)) + '</span> <span class="per">' + (period === 'yearly' ? 'a year' : 'a month') + '</span></p>';
    var s = saving(p);
    if (period === 'yearly' && s) out += '<p class="plan-saving">' + (s.months ? monthsFree(s.months) + ': you save ' : 'You save ') + esc(money(s.amount, cur)) + ' a year</p>';
    else if (period !== 'yearly' && isNum(p.price_yearly)) out += '<p class="plan-alt">or ' + esc(money(p.price_yearly, cur)) + ' a year' + (s && s.months ? ', ' + monthsFree(s.months) : '') + '</p>';
    return out + '<p class="plan-note">' + esc(V.price_note || '') + '</p>';
  }
  function hostedCard(p, period, V) {
    var href = 'buy.html?plan=' + encodeURIComponent(p.id) + (period === 'yearly' ? '&period=yearly' : '');
    var out = '<article class="plan plan-host" data-plan="' + esc(p.id) + '"><div class="plan-host-main">';
    out += '<div class="plan-top"><h3 class="plan-name">' + esc(p.name) + '</h3>';
    out += '<p class="plan-blurb">' + esc(p.blurb || '') + '</p></div>';
    out += '<div class="plan-cost">' + costHtml(p, period, V) + '</div>';
    out += '<div class="plan-ai"><span class="tag info">AI included</span><p>' + esc(p.allowance || 'Monthly allowance announced soon') + '</p></div>';
    out += '<div class="plan-actions"><a class="btn" href="' + esc(href) + '">Buy ' + esc(p.name) + '</a>';
    out += '<a class="btn quiet" href="help.html#contact" data-talk="' + esc(p.name) + ' plan">Talk to us</a></div>';
    out += '</div><div class="plan-host-more">';
    var feats = Array.isArray(p.features) ? p.features.filter(Boolean) : [];
    if (feats.length) out += '<h4 class="plan-host-h">What we do</h4><ul class="ticks">' + feats.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>';
    var diff = Array.isArray(p.different) ? p.different.filter(Boolean) : [];
    if (diff.length) out += '<div class="plan-host-diff"><h4 class="plan-host-h">What is different on this plan</h4><ul class="dots">' + diff.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul></div>';
    return out + '</div></article>';
  }
  function plansHtml(S, period) {
    var V = values(S), all = plans(S);
    var main = all.filter(function (p) { return p.ai_included && !p.hosted; }), other = all.filter(function (p) { return !p.ai_included && !p.hosted; });
    var hosted = all.filter(function (p) { return p.hosted; });
    var out = '';
    if (main.length) out += '<div class="plans plans-' + Math.min(main.length, 4) + '">' + main.map(function (p) { return planCard(p, period, V); }).join('') + '</div>';
    if (other.length) out += '<div class="plans-quiet">' + other.map(function (p) { return planCard(p, period, V); }).join('') + '</div>';
    if (hosted.length) {
      out += '<div class="plans-host"><div class="plans-host-head"><p class="eyebrow">Or we run her for you</p>';
      out += '<p class="plans-host-lead">The same employee, on our servers instead of a machine in your office.</p></div>';
      out += hosted.map(function (p) { return hostedCard(p, period, V); }).join('') + '</div>';
    }
    return out;
  }
  function drawPlans(S) {
    var box = $('[data-plans]');
    if (!box) return;
    var checked = $('input[name="period"]:checked', $('[data-period]') || document);
    var period = checked && checked.value === 'yearly' ? 'yearly' : 'monthly';
    box.innerHTML = plansHtml(S, period);
    var note = $('[data-period-note]');
    if (note) { note.textContent = periodNote(S); note.hidden = !note.textContent; }
    var list = $('[data-every-plan]');
    if (list && Array.isArray(S.every_plan)) list.innerHTML = S.every_plan.filter(Boolean).map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('');
    talkLinks(values(S), box);
  }

  /* ------------------------------------------------------------------------------------------ the settings, into the page */
  function talkLinks(V, scope) {
    $$('[data-talk]', scope).forEach(function (a) {
      var subject = a.getAttribute('data-talk') || '';
      if (V.support_email) a.setAttribute('href', 'mailto:' + V.support_email + (subject ? '?subject=' + encodeURIComponent(V.name + ': ' + subject) : ''));
      else a.setAttribute('href', PAGE === 'help' ? '#contact' : 'help.html#contact');
    });
  }
  function applyWords(S) {
    var V = values(S);
    $$('[data-s]').forEach(function (el) {
      var key = el.getAttribute('data-s');
      var text = V[key] || el.getAttribute('data-empty') || '';
      if (el.textContent !== text) el.textContent = text;
      if (el.hasAttribute('data-empty')) el.classList.toggle('fill', !V[key]);
    });
    $$('*').forEach(function (el) {
      for (var i = 0; i < el.attributes.length; i++) {
        var a = el.attributes[i];
        if (a.name.indexOf('data-tpl-') === 0) el.setAttribute(a.name.slice(9), fill(a.value, V));
      }
    });
    $$('[data-if]').forEach(function (el) { el.hidden = !V[el.getAttribute('data-if')]; });
    $$('[data-unless]').forEach(function (el) { el.hidden = !!V[el.getAttribute('data-unless')]; });
    talkLinks(V);
    var title = root.getAttribute('data-title');
    if (title) document.title = fill(title, V);
    return V;
  }

  /* ------------------------------------------------------------------------------------------ the operator's server
     The only three calls this website makes to a server, each in one function. api_base comes from data/site.json.

       startTrial(form)      POST {api_base}/buy/trial      {name, company, email, country, accept_terms, terms_version}
                             The answer is always the same sentence: check your inbox.
       startCheckout(form)   POST {api_base}/buy/checkout   {plan, period ('monthly', 'yearly' or 'once'), name, company, email, country, state, gstin,
                                                             billing_address, accept_terms, terms_version}
                             answers {checkout, pay_url, amount: {subtotal_paise, gst_paise, total_paise}}.
                             "checkout" is kept for this tab; the buyer pays on pay_url, the payment company's own page.
       paymentStatus()       POST {api_base}/buy/status     {checkout}
                             answers {message, hosted}: a sentence for the thank-you page. The licence key is never
                             shown on the website; it comes by e-mail. hosted true: a plan we run on our servers
                             (Managed), which has no key and no downloads; the page then shows what happens instead.

     When the server refuses, the sentence it sends ("error", "message" or "detail") is shown as it is.
     While api_base is empty nothing is sent and the answer says, in plain words, that this opens soon: the site
     never pretends that a trial or a purchase happened. */
  var API = { trial: '/buy/trial', checkout: '/buy/checkout', status: '/buy/status' };
  var KEPT = 'buy.checkout', KEPT_HOSTED = 'buy.hosted';
  var WORDS = {
    trialSoon: 'Free trials open soon. Talk to us and we will tell you the day they do.',
    trialSent: 'Check your inbox. Your trial key and the download links are on their way.',
    buySoon: 'Buying online opens soon. Talk to us and we will set you up.',
    offline: 'We could not reach our server. Check your internet connection and try again.',
    failed: 'That did not go through. Try again in a minute, or talk to us.',
    noStatus: 'We could not check your payment just now. If you paid, your licence key and the download links are on their way by e-mail.',
    hostedPaid: 'If you have just paid, we are setting her up on our servers. You will get an e-mail with her address.',
    hostedNoStatus: 'We could not check your payment just now. If you paid, we are setting her up on our servers and will e-mail you her address.'
  };
  function apiBase() { return String(SITE.api_base || '').trim().replace(/\/+$/, ''); }
  function field(form, name) {
    var el = form.elements[name];
    if (!el) return '';
    return String(el.value == null ? '' : el.value).trim();
  }
  function sentence(x) { return typeof x === 'string' && x.trim() ? x.trim().slice(0, 400) : ''; }
  function kept(value, key) {
    try {
      if (value === undefined) return window.sessionStorage.getItem(key || KEPT) || '';
      window.sessionStorage.setItem(key || KEPT, value);
    } catch (e) { /* a browser that refuses storage: the thank-you page then shows its plain words */ }
    return '';
  }
  /* A plan we run on our servers (hosted: true): no key and no downloads; she is set up for the buyer. */
  function isHosted(p) { return !!(p && p.hosted); }
  function showFor(hosted, scope) {
    $$('[data-for-hosted]', scope).forEach(function (el) { el.hidden = !hosted; });
    $$('[data-for-own]', scope).forEach(function (el) { el.hidden = hosted; });
  }
  async function post(path, body) {
    var res, data = null;
    try {
      res = await fetch(apiBase() + path, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(body), credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer'
      });
    } catch (e) {
      return { ok: false, error: WORDS.offline };
    }
    try { data = await res.json(); } catch (e) { data = null; }
    if (res.ok && data && typeof data === 'object' && data.ok !== false) return { ok: true, data: data };
    data = data && typeof data === 'object' ? data : {};
    return { ok: false, error: sentence(data.message) || sentence(data.detail) || sentence(data.error) || WORDS.failed };   // the server's sentence first; its `error` field is a short code
  }

  /* Free trial. {ok: true, message} means the server took the request; the key and the links go out by e-mail. */
  async function startTrial(form) {
    if (!apiBase()) return { ok: false, soon: true, error: WORDS.trialSoon };
    var answer = await post(API.trial, {
      name: field(form, 'name'), company: field(form, 'company'), email: field(form, 'email'), country: field(form, 'country'),
      accept_terms: !!(form.elements.accept_terms && form.elements.accept_terms.checked), terms_version: String(SITE.terms_version || '')
    });
    if (!answer.ok) return answer;
    return { ok: true, message: sentence(answer.data.message) || WORDS.trialSent };
  }
  /* Buy. {ok: true, pay_url, amount} means a checkout is open: its reference is kept for this tab, and the buyer
     pays on pay_url, the payment company's own page. */
  async function startCheckout(form) {
    if (!apiBase()) return { ok: false, soon: true, error: WORDS.buySoon };
    var answer = await post(API.checkout, {
      plan: field(form, 'plan'), period: ({ yearly: 'yearly', once: 'once' })[field(form, 'period')] || 'monthly',
      name: field(form, 'name'), company: field(form, 'company'), email: field(form, 'email'),
      country: field(form, 'country'), state: field(form, 'state'), gstin: field(form, 'gstin').toUpperCase(),
      billing_address: field(form, 'billing_address'),
      accept_terms: !!(form.elements.accept_terms && form.elements.accept_terms.checked), terms_version: String(SITE.terms_version || '')
    });
    if (!answer.ok) return answer;
    var d = answer.data;
    if (!sentence(d.checkout) || !/^https:\/\/\S+$/i.test(String(d.pay_url || ''))) return { ok: false, error: WORDS.failed };
    kept(String(d.checkout));
    var bought = plans(SITE).filter(function (p) { return p.id === field(form, 'plan'); })[0];
    kept(isHosted(bought) ? '1' : '', KEPT_HOSTED);
    return { ok: true, checkout: String(d.checkout), pay_url: String(d.pay_url), amount: d.amount && typeof d.amount === 'object' ? d.amount : null };
  }
  /* Thank-you page: how did the payment of this tab's checkout go? {ok: true, message} or {ok: false, error}.
     {none: true} when there is nothing to ask about (no purchase was started in this tab, or no server yet). */
  async function paymentStatus() {
    var checkout = kept();
    if (!apiBase() || !checkout) return { ok: false, none: true, error: '' };
    var answer = await post(API.status, { checkout: checkout });
    if (!answer.ok) return { ok: false, error: WORDS.noStatus };
    var message = sentence(answer.data.message);
    return message ? { ok: true, message: message, hosted: answer.data.hosted === true } : { ok: false, error: WORDS.noStatus };
  }
  window.startTrial = startTrial;
  window.startCheckout = startCheckout;
  window.paymentStatus = paymentStatus;

  /* ------------------------------------------------------------------------------------------ the forms */
  function busy(form, on, label) {
    var b = $('button[type="submit"]', form);
    if (!b) return;
    if (on) { b.setAttribute('data-label', b.textContent); b.textContent = label; b.disabled = true; }
    else { b.textContent = b.getAttribute('data-label') || b.textContent; b.disabled = false; }
  }
  function say(form, text) {
    var s = $('[data-form-status]', form);
    if (s) s.textContent = text || '';
  }
  function show(panel) {
    panel.hidden = false;
    var h = $('h1, h2', panel);
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    var top = panel.getBoundingClientRect().top + window.pageYOffset - 96;
    window.scrollTo(0, Math.max(0, top));
  }
  function trialForm() {
    var form = $('#trial-form');
    if (!form || form.getAttribute('data-ready')) return;
    form.setAttribute('data-ready', '1');
    form.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      if (!form.reportValidity()) return;
      say(form, '');
      busy(form, true, 'Starting your trial');
      var answer = await startTrial(form);
      busy(form, false);
      if (!answer.ok) { say(form, answer.error); return; }
      var done = $('#trial-done');
      $('[data-trial-message]', done).textContent = answer.message;
      $('[data-trial-email]', done).textContent = field(form, 'email');
      $('#trial-ask').hidden = true;
      show(done);
    });
  }
  function buyForm() {
    var form = $('#buy-form');
    if (!form) return;
    var select = form.elements.plan, radios = $$('input[name="period"]', form), summary = $('[data-buy-summary]', form);
    var V = values(SITE), all = plans(SITE).filter(priced), title = $('[data-buy-title]');
    var keep = select.value && form.getAttribute('data-ready') ? select.value : query('plan');
    select.innerHTML = all.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>'; }).join('');
    var best = all.filter(function (p) { return p.id === keep; })[0] || all.filter(function (p) { return p.highlight; })[0] || all[0];
    if (best) select.value = best.id;
    function current() { return all.filter(function (p) { return p.id === select.value; })[0]; }
    function refresh() {
      var p = current();
      radios.forEach(function (r) {
        r.disabled = !p || !isNum(priceOf(p, r.value));
        if (r.value === 'once') r.closest('label').hidden = r.disabled;   /* paying once is shown only for a plan that has it */
      });
      var on = radios.filter(function (r) { return r.checked && !r.disabled; })[0] || radios.filter(function (r) { return !r.disabled; })[0];
      if (on) on.checked = true;
      if (title) title.textContent = on && on.value === 'once' ? 'Pay once' : 'Subscribe';
      showFor(isHosted(p), document);
      if (!p || !on) { summary.textContent = ''; return; }
      var how = { yearly: ['paid yearly', ' a year'], once: ['paid once', ''] }[on.value] || ['paid monthly', ' a month'];
      var s = saving(p), line = p.name + ', ' + how[0] + ': ' + money(priceOf(p, on.value), p.currency) + how[1] +
        (V.price_note ? ', ' + V.price_note : '') + '.';
      if (on.value === 'yearly' && s) line += ' ' + (s.months ? monthsFree(s.months) + ': you save ' : 'You save ') + money(s.amount, p.currency) + ' a year.';
      if (on.value === 'once') line += ' The licence does not expire. Support and updates for one year from the day you pay are included.';
      if (isHosted(p)) line += ' We run her for you on our servers.';
      summary.textContent = line;
    }
    function india() {
      var yes = /^(india|in|bharat)$/i.test(field(form, 'country'));
      $$('[data-india]', form).forEach(function (box) { box.hidden = !yes; });
      form.elements.state.required = yes;
      if (!yes) { form.elements.gstin.value = ''; form.elements.state.value = ''; }
    }
    if (!form.getAttribute('data-ready')) {
      form.setAttribute('data-ready', '1');
      var asked = query('period');
      if (asked === 'yearly' || asked === 'once') radios.forEach(function (r) { r.checked = r.value === asked; });
      select.addEventListener('change', refresh);
      radios.forEach(function (r) { r.addEventListener('change', refresh); });
      form.elements.country.addEventListener('input', india);
      form.elements.gstin.addEventListener('input', function () { this.value = this.value.toUpperCase().replace(/\s/g, ''); });
      form.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        if (!form.reportValidity()) return;
        say(form, '');
        busy(form, true, 'Working out your total');
        var answer = await startCheckout(form);
        busy(form, false);
        if (!answer.ok) { say(form, answer.error); return; }
        var p = current(), cur = p ? p.currency : 'INR', pay = $('#buy-pay'), a = answer.amount || {};
        var rows = [['Plan', summary.textContent.split(':')[0]]];
        if (isNum(a.subtotal_paise)) rows.push(['Price', money(a.subtotal_paise / 100, cur)]);
        if (isNum(a.gst_paise)) rows.push(['GST', money(a.gst_paise / 100, cur)]);
        if (isNum(a.total_paise)) rows.push(['Total to pay now', money(a.total_paise / 100, cur)]);
        $('[data-pay-rows]', pay).innerHTML = rows.map(function (r, i) {
          return '<div' + (i === rows.length - 1 && rows.length > 1 ? ' class="total"' : '') + '><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>';
        }).join('');
        $('[data-pay-link]', pay).setAttribute('href', answer.pay_url);
        $('#buy-ask').hidden = true;
        show(pay);
      });
      var back = $('[data-buy-back]');
      if (back) back.addEventListener('click', function () { $('#buy-pay').hidden = true; show($('#buy-ask')); });
    }
    refresh();
    india();
  }
  function thanksPage() {
    var box = $('[data-payment-status]');
    if (!box || box.getAttribute('data-ready')) return;
    box.setAttribute('data-ready', '1');
    var again = $('[data-check-again]');
    function hosted(yes) {
      $$('[data-thanks-hosted]').forEach(function (el) { el.hidden = !yes; });
      $$('[data-thanks-own]').forEach(function (el) { el.hidden = yes; });
      if (yes && !box.getAttribute('data-asked')) box.textContent = WORDS.hostedPaid;
    }
    hosted(kept(undefined, KEPT_HOSTED) === '1');
    var plain = box.textContent;
    async function ask() {
      if (!apiBase() || !kept()) return;
      box.setAttribute('data-asked', '1');
      box.textContent = 'Checking your payment.';
      var answer = await paymentStatus();
      if (answer.ok && answer.hosted) hosted(true);
      var isOurs = kept(undefined, KEPT_HOSTED) === '1';
      box.textContent = answer.ok ? answer.message : (isOurs ? WORDS.hostedNoStatus : (answer.error || plain));
      if (again) again.hidden = false;
    }
    if (again) again.addEventListener('click', ask);
    ask();
  }

  /* ------------------------------------------------------------------------------------------ start */
  function apply(S) {
    SITE = S;
    applyWords(S);
    drawPlans(S);
    trialForm();
    buyForm();
    thanksPage();
  }
  function start() {
    root.classList.add('js');
    var sw = $('[data-period]');
    if (sw) {
      sw.hidden = false;
      if (query('period') === 'yearly') $$('input[name="period"]', sw).forEach(function (r) { r.checked = r.value === 'yearly'; });
      sw.addEventListener('change', function () { drawPlans(SITE); });
    }
    if (window.SITE) apply(SITE);
    document.addEventListener('keydown', function (ev) {
      var m = $('details.menu[open]');
      if (ev.key === 'Escape' && m) { m.open = false; $('summary', m).focus(); }
    });
    /* On a web host, read the live settings too: a change to site.json shows without running the build. */
    if (/^https?:$/.test(window.location.protocol)) {
      fetch('data/site.json', { cache: 'no-cache', credentials: 'omit' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (fresh) { if (fresh && JSON.stringify(fresh) !== JSON.stringify(window.SITE || null)) apply(fresh); })
        .catch(function () { /* the stamped copy is already on the page */ });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
