(function () {
  'use strict';
  var d = document, T = window.FLO_T || {}, WA = '971507358589', EMAIL = 'info@flocreative.ae';
  var $ = function (s, r) { return (r || d).querySelector(s); }, $$ = function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); };

  /* header: transparent over the hero, solid after it (observer, no scroll handler) */
  var hdr = $('.hdr'), top = d.createElement('div');
  top.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:12px;pointer-events:none';
  d.body.prepend(top);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { hdr.classList.toggle('is-solid', !es[0].isIntersecting); }).observe(top);
  } else hdr.classList.add('is-solid');

  /* mobile menu */
  var mb = $('.menu-btn'), nav = $('#nav');
  mb.addEventListener('click', function () { var o = nav.classList.toggle('is-open'); mb.setAttribute('aria-expanded', o); });
  nav.addEventListener('click', function (e) { if (e.target.closest('a')) { nav.classList.remove('is-open'); mb.setAttribute('aria-expanded', 'false'); } });

  /* hero show floor */
  var hc = $('#floor');
  if (hc && window.FloIso) { try { FloIso.showFloor(hc); } catch (e) { hc.remove(); } }

  /* planner tabs */
  var tabs = $$('.tab');
  tabs.forEach(function (t) {
    t.addEventListener('click', function () { select(t); });
    t.addEventListener('keydown', function (e) {
      var i = tabs.indexOf(t), rtl = d.dir === 'rtl', n = null;
      if (e.key === 'ArrowRight') n = tabs[(i + (rtl ? -1 : 1) + tabs.length) % tabs.length];
      if (e.key === 'ArrowLeft') n = tabs[(i + (rtl ? 1 : -1) + tabs.length) % tabs.length];
      if (n) { n.focus(); select(n); }
    });
  });
  function select(t) {
    tabs.forEach(function (x) { var on = x === t; x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1; $('#' + x.getAttribute('aria-controls')).hidden = !on; });
    planners[t.getAttribute('aria-controls')] && planners[t.getAttribute('aria-controls')].update();
  }
  $$('[data-open-tab]').forEach(function (a) { a.addEventListener('click', function () { var t = $('#' + a.dataset.openTab); if (t) select(t); }); });

  /* range fill */
  function fill(r) { var p = (r.value - r.min) / (r.max - r.min) * 100; r.style.setProperty('--fill', p + '%'); }

  /* stand planner */
  var planners = {};
  var sf = $('#stand-form');
  if (sf && window.FloIso) {
    var st = { w: 6, d: 4, h: 3, type: 'corner' };
    var sp = FloIso.standPlanner($('#stand-canvas'), st);
    planners['panel-stand'] = sp;
    var upd = function () {
      st.w = +$('#s-w').value; st.d = +$('#s-d').value;
      st.h = +(($('input[name=s-h]:checked', sf) || {}).value || 3);
      st.type = ($('input[name=s-type]:checked', sf) || {}).value || 'corner';
      $('#s-w-o').textContent = st.w + ' m'; $('#s-d-o').textContent = st.d + ' m';
      $('#s-area').textContent = (st.w * st.d) + ' m²';
      $('#s-open').textContent = T.open[st.type];
      $$('input[type=range]', sf).forEach(fill);
      sp.update();
    };
    sf.addEventListener('input', upd); upd();
    sf.addEventListener('submit', function (e) {
      e.preventDefault();
      send(sf, [
        T.stand_intro, '',
        T.l_type + ': ' + T.types[st.type] + ' (' + T.open[st.type] + ')',
        T.l_size + ': ' + st.w + ' x ' + st.d + ' m = ' + (st.w * st.d) + ' m², ' + T.l_height + ' ' + st.h + ' m',
        val('s-show') && T.l_show + ': ' + val('s-show'),
        T.l_city + ': ' + txt('s-city'),
        val('s-dates') && T.l_dates + ': ' + val('s-dates'),
        T.l_industry + ': ' + txt('s-ind')
      ], 's');
    });
  }

  /* space planner */
  var pf = $('#space-form');
  if (pf && window.FloIso) {
    var ps = { area: 120, type: 'retail' };
    var pp = FloIso.spacePlanner($('#space-canvas'), ps);
    planners['panel-space'] = pp;
    var steps = [20, 30, 40, 50, 60, 80, 100, 120, 150, 200, 250, 300, 400, 500, 750, 1000, 1500, 2000];
    var upd2 = function () {
      ps.area = steps[+$('#p-a').value];
      ps.type = ($('input[name=p-type]:checked', pf) || {}).value || 'retail';
      $('#p-a-o').textContent = ps.area + ' m²'; $('#p-area').textContent = ps.area + ' m²';
      $('#p-kind').textContent = T.space[ps.type];
      $$('input[type=range]', pf).forEach(fill);
      pp.update();
    };
    pf.addEventListener('input', upd2); upd2();
    pf.addEventListener('submit', function (e) {
      e.preventDefault();
      var scope = $$('input[name=p-scope]:checked', pf).map(function (x) { return x.parentNode.textContent.trim(); }).join(', ');
      send(pf, [
        T.space_intro, '',
        T.l_space + ': ' + T.space[ps.type] + ', ' + ps.area + ' m²',
        T.l_stage + ': ' + txt('p-stage'),
        scope && T.l_scope + ': ' + scope,
        T.l_city + ': ' + txt('p-city'),
        val('p-open') && T.l_opening + ': ' + val('p-open')
      ], 'p');
    });
  }

  function val(id) { var el = d.getElementById(id); return el ? el.value.trim() : ''; }
  function txt(id) { var el = d.getElementById(id); return el ? el.options[el.selectedIndex].text : ''; }
  function send(form, lines, p) {
    var err = $('.err', form), done = $('.done', form);
    var name = val(p + '-name'), how = ($('input[name=' + p + '-how]:checked', form) || {}).value || 'wa', contact = val(p + '-contact');
    if (!name || !contact) { err.textContent = T.need; err.hidden = false; return; }
    err.hidden = true;
    lines = lines.concat(['', T.l_name + ': ' + name, val(p + '-company') && T.l_company + ': ' + val(p + '-company'), T.l_reach + ': ' + T.how[how] + ' ' + contact]).filter(function (x) { return x !== '' && x !== false && x != null || x === ''; });
    var text = lines.filter(function (x, i, a) { return !(x === '' && a[i - 1] === ''); }).join('\n');
    $('.wa-send', done).href = 'https://wa.me/' + WA + '?text=' + encodeURIComponent(text);
    $('.mail-send', done).href = 'mailto:' + EMAIL + '?subject=' + encodeURIComponent(T.subject + ' ' + name) + '&body=' + encodeURIComponent(text);
    $('pre', done).textContent = text;
    done.hidden = false;
    done.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  $$('.done .copy').forEach(function (b) {
    b.addEventListener('click', function () {
      var t = $('pre', b.closest('.done')).textContent;
      try { navigator.clipboard.writeText(t).then(function () { b.textContent = T.copied; setTimeout(function () { b.textContent = T.copy; }, 1800); }).catch(function () {}); } catch (e) {}
    });
  });
  /* contact label follows the chosen channel */
  $$('[data-how]').forEach(function (g) {
    var p = g.dataset.how, lab = $('#' + p + '-contact-l'), inp = $('#' + p + '-contact');
    var set = function () {
      var v = ($('input:checked', g) || {}).value || 'wa';
      lab.textContent = T.how_l[v]; inp.type = v === 'email' ? 'email' : 'tel'; inp.placeholder = v === 'email' ? 'name@company.com' : '+971'; inp.dir = 'ltr';
    };
    g.addEventListener('change', set); set();
  });

  var y = $('#yr'); if (y) y.textContent = new Date().getFullYear();
})();
