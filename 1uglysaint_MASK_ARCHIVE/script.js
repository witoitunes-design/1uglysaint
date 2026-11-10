/* 1uglysaint — store interactions. Products come from products.js.
   Cart = drawer with a 3-step checkout (koszyk → dane → wysyłka). No backend: the order goes out as an Instagram DM. */
(() => {
  const formatPLN = value => new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value);

  const DATA = Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
  const SHOP = window.SHOP || {};
  const STATUS = { instock: 'NA STANIE', limited: 'LIMITOWANA', soldout: 'WYPRZEDANE' };
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fullName = p => `MASKA ${p.id} ${p.name}`;
  const byId = id => DATA.find(p => p.id === id);
  const corners = '<span class="corner tl">+</span><span class="corner tr">+</span><span class="corner bl">+</span><span class="corner br">+</span>';

  /* ---------- render products from products.js ---------- */
  const homeGrid = document.getElementById('product-grid');
  if (homeGrid && DATA.length) {
    const latest = DATA.filter(p => p.latest);
    homeGrid.innerHTML = (latest.length ? latest : DATA.slice(0, 3)).map(p => {
      const sold = p.status === 'soldout';
      return `<article class="product-card${sold ? ' is-soldout' : ''}" data-name="${esc(fullName(p))}" data-price="${p.price}" data-id="${esc(p.id)}">
        <div class="image-frame open-product" data-open="${esc(p.id)}" role="button" tabindex="0" aria-label="Zobacz ${esc(fullName(p))}"><img src="${esc(p.images?.[0])}" alt="${esc(fullName(p))}" loading="lazy" decoding="async">${corners}<span class="view-tag">ZOBACZ ↗</span></div>
        <div class="product-title">MASKA ${esc(p.id)} <span>${STATUS[p.status] || ''}</span></div>
        <p class="item-caption">${esc(p.name)} // ARCHIWUM ${esc(p.id)}</p><div class="price">${formatPLN(p.price)}</div>
        <button class="product-button" type="button" data-add="${esc(p.id)}"${sold ? ' disabled' : ''}><span aria-hidden="true">♜</span> ${sold ? 'WYPRZEDANE' : 'DO KOSZYKA'} <span aria-hidden="true">+</span></button>
      </article>`;
    }).join('');
  }

  const catalogGrid = document.getElementById('archive-grid');
  if (catalogGrid && DATA.length) {
    catalogGrid.innerHTML = DATA.map(p => {
      const sold = p.status === 'soldout';
      const badge = p.status === 'limited' ? '<span class="catalog-badge">LIMITOWANA</span>' : sold ? '<span class="catalog-badge soldout">WYPRZEDANE</span>' : '';
      return `<article class="catalog-card${p.status === 'limited' ? ' limited-card' : ''}${sold ? ' is-soldout' : ''}" data-name="${esc(fullName(p))}" data-id="${esc(p.id)}" data-price="${p.price}" data-category="${esc((p.category || []).join(' '))}" data-availability="${esc(p.status)}" data-tags="${esc((p.tags || []).join(' '))}">
        ${badge}<div class="catalog-image open-product" data-open="${esc(p.id)}" role="button" tabindex="0" aria-label="Zobacz ${esc(fullName(p))}"><img src="${esc(p.images?.[0])}" alt="${esc(fullName(p))}" loading="lazy" decoding="async"><span class="view-tag">ZOBACZ ↗</span></div>
        <div class="catalog-name">MASKA ${esc(p.id)} / ${esc(p.name)}</div>
        <div class="catalog-price">${formatPLN(p.price)}</div>
        <button type="button" class="catalog-button" data-add="${esc(p.id)}"${sold ? ' disabled' : ''}>${sold ? 'WYPRZEDANE' : 'DO KOSZYKA'}</button>
      </article>`;
    }).join('');
    // live counts in the sidebar
    document.querySelectorAll('.archive-side-item[data-category]').forEach(btn => {
      const c = btn.dataset.category;
      const n = c === 'all' ? DATA.length : DATA.filter(p => (p.category || []).includes(c)).length;
      const strong = btn.querySelector('strong'); if (strong) strong.textContent = n;
    });
    document.querySelectorAll('[data-filter-availability]').forEach(input => {
      const span = input.closest('label')?.querySelector('span');
      if (span) span.textContent = DATA.filter(p => p.status === input.value).length;
    });
    const countEl = document.getElementById('archive-count'); if (countEl) countEl.textContent = DATA.length;
  }

  /* ---------- shared dialogs: product window + order ---------- */
  document.body.insertAdjacentHTML('beforeend', `
  <dialog class="modal-window product-dialog" id="product-dialog" aria-labelledby="pd-title">
    <div class="window-bar"><div class="window-name" id="pd-bar">ARCHIVE /</div><div class="window-actions"><button type="button" data-dismiss aria-label="Close">×</button></div></div>
    <div class="pd-body">
      <div class="pd-media">
        <div class="pd-stage" id="pd-stage"><img id="pd-img" alt=""><div class="pd-torch" aria-hidden="true"></div>${corners}
          <button type="button" class="pd-light" id="pd-light" aria-pressed="false">◐ ZGAŚ ŚWIATŁO</button></div>
        <div class="pd-thumbs" id="pd-thumbs"></div>
      </div>
      <div class="pd-info">
        <div class="pd-kicker" id="pd-kicker"></div>
        <h2 id="pd-title"></h2>
        <div class="pd-price" id="pd-price"></div>
        <p class="pd-desc" id="pd-desc"></p>
        <dl class="pd-details" id="pd-details"></dl>
        <div class="pd-actions">
          <button type="button" class="outline-button" id="pd-add">DO KOSZYKA <span>+</span></button>
          <button type="button" class="outline-button pd-buy" id="pd-buy">ZAMAWIAM <span>→</span></button>
        </div>
        <div class="pd-nav"><button type="button" id="pd-prev">‹ POPRZ.</button><button type="button" id="pd-share">⧉ KOPIUJ LINK</button><button type="button" id="pd-next">NAST. ›</button></div>
      </div>
    </div>
  </dialog>
  `);

  /* ---------- cart drawer (one for every page; the old per-page #cart-dialog goes away) ---------- */
  document.querySelectorAll('#cart-dialog').forEach(d => d.remove());
  const IG = String(SHOP.instagram || '').replace(/^@/, '').trim();
  document.body.insertAdjacentHTML('beforeend', `
  <dialog class="ck" id="cart-dialog" aria-labelledby="ck-title">
    <div class="ck-in" id="ck-in" data-step="1">
      <header class="ck-top">
        <p class="ck-k"><i aria-hidden="true"></i><span>KOSZYK</span><b id="ck-n">0</b></p>
        <ol class="ck-steps" aria-hidden="true"><li data-s="1"><b>01</b> KOSZYK</li><li data-s="2"><b>02</b> DANE</li><li data-s="3"><b>03</b> WYSYŁKA</li></ol>
        <button type="button" class="ck-x" data-dismiss aria-label="Zamknij koszyk">×</button>
      </header>
      <div class="ck-body" id="ck-body">
        <section class="ck-pane" data-pane="1" aria-labelledby="ck-title">
          <h2 class="ck-h" id="ck-title" tabindex="-1">Twój <em>koszyk.</em></h2>
          <div class="ck-undo" id="ck-undo" hidden><span id="ck-undo-t"></span><button type="button" id="ck-undo-b">COFNIJ</button></div>
          <div class="ck-lines" id="cart-lines"></div>
          <div class="ck-more" id="ck-more" hidden><p class="ck-lbl">DORZUĆ DO ZAMÓWIENIA</p><div class="ck-more-l" id="ck-more-l"></div></div>
        </section>
        <section class="ck-pane" data-pane="2" aria-labelledby="ck-h2" hidden>
          <h2 class="ck-h" id="ck-h2" tabindex="-1">Dokąd <em>wysłać?</em></h2>
          <p class="ck-p">Dane do paczki trafią tylko do wiadomości, którą za chwilę sam wyślesz. Strona niczego nie zapisuje.</p>
          <form class="ck-form" id="ck-form" novalidate>
            <label class="ck-f"><span>Imię i nazwisko</span><input name="name" autocomplete="name" maxlength="80" required><em class="ck-err"></em></label>
            <label class="ck-f"><span>Telefon</span><input name="tel" type="tel" inputmode="tel" autocomplete="tel" maxlength="22" placeholder="np. 600 100 200" required><em class="ck-err"></em></label>
            <label class="ck-f"><span>Adres wysyłki</span><textarea name="addr" rows="3" autocomplete="street-address" maxlength="240" placeholder="ulica i numer, kod pocztowy, miasto" required></textarea><em class="ck-err"></em></label>
            <label class="ck-f"><span>Uwagi <small>(opcjonalnie)</small></span><textarea name="note" rows="2" maxlength="300" placeholder="np. to prezent"></textarea></label>
          </form>
        </section>
        <section class="ck-pane" data-pane="3" aria-labelledby="ck-h3" hidden>
          <h2 class="ck-h" id="ck-h3" tabindex="-1">Wyślij <em>na Instagramie.</em></h2>
          <div class="ck-done" id="ck-done" hidden role="status"><b>Skopiowane ✓</b><span>Wklej w rozmowie z @${esc(IG || '1uglysaint')} (przytrzymaj pole wiadomości → Wklej) i wyślij.</span></div>
          <ol class="ck-how">
            <li><b>01</b><span>Kopiujesz zamówienie jednym kliknięciem.</span></li>
            <li><b>02</b><span>Otwiera się rozmowa z <i>@${esc(IG || '1uglysaint')}</i>.</span></li>
            <li><b>03</b><span>Wklejasz i wysyłasz. Odpisujemy z płatnością i kosztem wysyłki.</span></li>
          </ol>
          <div class="ck-slip" id="ck-slip"><p class="ck-slip-k"><span>PROTOKÓŁ ZAMÓWIENIA</span><b id="ck-no"></b></p><pre id="ck-slip-t"></pre><span class="ck-stamp" aria-hidden="true">DO WYSŁANIA</span></div>
        </section>
        <section class="ck-pane" data-pane="4" aria-labelledby="ck-h4" hidden>
          <h2 class="ck-h" id="ck-h4" tabindex="-1">Jest <em>w drodze.</em></h2>
          <p class="ck-p" id="ck-thx"></p>
        </section>
      </div>
      <footer class="ck-foot" id="ck-foot">
        <dl class="ck-sum" id="ck-sum">
          <div><dt>MASKI</dt><dd id="ck-sub">0 zł</dd></div>
          <div class="ck-disc" id="cart-discount" hidden></div>
          <div><dt>WYSYŁKA</dt><dd class="ck-soft">podamy w odpowiedzi</dd></div>
          <div class="ck-total"><dt>RAZEM</dt><dd id="checkout-total">0 zł</dd></div>
        </dl>
        <div class="ck-acts" id="ck-acts"></div>
        <p class="ck-trust" id="ck-trust">Bez konta i bez płacenia na stronie. Płacisz dopiero, kiedy potwierdzimy zamówienie.</p>
      </footer>
    </div>
  </dialog>`);

  const products = Object.fromEntries(DATA.map(p => [p.id, { name: fullName(p), price: Number(p.price) }]));

  const CART_KEY = '1uglysaint-cart-v20';   // v20: nowe numery masek, stare koszyki nie mieszają
  const cart = {};
  function loadCart() {
    try {
      const saved = JSON.parse(localStorage.getItem(CART_KEY) || '{}');
      Object.keys(cart).forEach(k => delete cart[k]);
      for (const [id, item] of Object.entries(saved)) {
        if (!item || !Number.isInteger(item.qty) || item.qty <= 0) continue;
        if (!products[id] && item.name) products[id] = { name: String(item.name), price: Number(item.price) || 0 };
        if (products[id]) cart[id] = item.qty;
      }
    } catch (e) { /* storage unavailable: cart lives in memory only */ }
  }
  function saveCart() {
    try {
      const out = {};
      for (const [id, qty] of Object.entries(cart)) out[id] = { qty, name: products[id]?.name, price: products[id]?.price };
      localStorage.setItem(CART_KEY, JSON.stringify(out));
    } catch (e) {}
  }
  loadCart();
  window.addEventListener('storage', e => { if (e.key === CART_KEY) { loadCart(); renderCart(); } });
  const toast = document.getElementById('toast');
  let toastTimer;

  function notify(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 2400);
  }

  function activeCode() { try { return localStorage.getItem('us-code') || ''; } catch (e) { return window.__usCode || ''; } }
  function setCode(code) { try { localStorage.setItem('us-code', code); } catch (e) {} window.__usCode = code; renderCart(); }
  function discount(sum) { return activeCode() ? Math.round(sum * (SHOP.gameDiscount || 10)) / 100 : 0; }
  function totals() {
    return Object.entries(cart).reduce(
      (acc, [id, quantity]) => ({
        count: acc.count + quantity,
        sum: acc.sum + ((products[id]?.price || 0) * quantity)
      }),
      { count: 0, sum: 0 }
    );
  }

  const zl = v => formatPLN(v).replace(',00', '');
  const thumbOf = id => (byId(id)?.images?.[0] || '').replace(/\.(webp|png|jpe?g)$/i, '-sm.webp');
  const MAXQ = 9;
  let step = 1, undo = null, undoT = 0;

  function renderCart() {
    const { count, sum } = totals();
    const disc = discount(sum);
    const $$ = id => document.getElementById(id);
    if ($$('cart-items')) $$('cart-items').textContent = `${count} szt.`;
    if ($$('cart-amount')) $$('cart-amount').textContent = formatPLN(sum - disc);
    const badge = $$('task-cart-count');
    if (badge) { badge.textContent = count; badge.closest('.task-cart')?.classList.toggle('has-items', count > 0); }
    saveCart();

    const lines = $$('cart-lines');
    if (lines) {
      $$('ck-n').textContent = count;
      $$('ck-sub').textContent = zl(sum);
      $$('checkout-total').textContent = zl(sum - disc);
      const dEl = $$('cart-discount');
      dEl.hidden = !(disc > 0);
      if (disc > 0) dEl.innerHTML = `<dt>KOD ${esc(activeCode())}</dt><dd>−${SHOP.gameDiscount || 10}% · −${esc(zl(disc))}</dd>`;
      if (!count) {
        lines.innerHTML = `<div class="ck-empty"><p class="ck-empty-h">Pusto.</p><p class="ck-p">Wybierz maskę w przymierzalni. Obejrzysz ją w 3D i na zdjęciu.</p>
          <div class="ck-faces">${DATA.map(p => `<a href="sklep.html#${esc(p.id)}" aria-label="${esc(p.name)}"><img src="${esc(thumbOf(p.id))}" alt=""><span>${esc(p.name)}</span></a>`).join('')}</div></div>`;
      } else {
        lines.innerHTML = Object.entries(cart).map(([id, qty]) => {
          const p = byId(id), nm = p ? p.name : (products[id]?.name || id), price = products[id]?.price || 0;
          return `<article class="ck-line" data-id="${esc(id)}">
            <a class="ck-th" href="sklep.html#${esc(id)}" aria-label="Zobacz ${esc(nm)}"><img src="${esc(thumbOf(id))}" alt=""></a>
            <div class="ck-ln"><b>${esc(nm)}</b><span>№ ${esc(id)}${p?.status === 'limited' ? ' · <em>LIMITOWANA</em>' : ''}</span>
              <div class="ck-qty" role="group" aria-label="Ilość: ${esc(nm)}"><button type="button" data-q="-1" aria-label="Mniej">−</button><output>${qty}</output><button type="button" data-q="1" aria-label="Więcej"${qty >= MAXQ ? ' disabled' : ''}>+</button></div></div>
            <div class="ck-lp"><b>${esc(zl(price * qty))}</b>${qty > 1 ? `<small>${qty} × ${esc(zl(price))}</small>` : ''}<button type="button" class="ck-rm" data-rm>USUŃ</button></div>
          </article>`;
        }).join('');
      }
      const more = DATA.filter(p => !cart[p.id] && p.status !== 'soldout');
      $$('ck-more').hidden = !count || !more.length;
      $$('ck-more-l').innerHTML = more.map(p => `<button type="button" class="ck-add" data-ck-add="${esc(p.id)}"><img src="${esc(thumbOf(p.id))}" alt=""><span><b>${esc(p.name)}</b><small>${esc(zl(p.price))}</small></span><i aria-hidden="true">+</i></button>`).join('');
      if (!count && step > 1 && step < 4) setStep(1);
      drawActs();
    }
    document.dispatchEvent(new CustomEvent('us:cart', { detail: { count, sum } }));
  }

  function addToCart(id, silent) {
    if (!products[id] || byId(id)?.status === 'soldout') return;
    cart[id] = (cart[id] || 0) + 1;
    renderCart();
    if (!silent) notify(`${products[id].name} / W KOSZYKU`);
    const tc = document.querySelector('.task-cart');
    if (tc) { tc.classList.remove('bump'); void tc.offsetWidth; tc.classList.add('bump'); }
    document.dispatchEvent(new CustomEvent('us:add', { detail: { id } }));
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-add]');
    if (b && !b.disabled) addToCart(b.dataset.add);
  });


  const dialogs = {
    cart: document.getElementById('cart-dialog'),
    account: document.getElementById('account-dialog'),
    product: document.getElementById('product-dialog')
  };

  document.querySelectorAll('[data-modal]').forEach(button =>
    button.addEventListener('click', () => button.dataset.modal === 'cart' ? openCart() : dialogs[button.dataset.modal]?.showModal())
  );

  document.querySelectorAll('[data-dismiss]').forEach(button =>
    button.addEventListener('click', () => button.closest('dialog')?.close())
  );

  Object.values(dialogs).forEach(dialog => {
    dialog?.addEventListener('click', event => {
      if (event.target === dialog) dialog.close();
    });
  });

  const input = document.getElementById('product-search');
  const productCards = [...document.querySelectorAll('.product-card')];
  function filterHomepageCards() {
    if (!input) return;
    const q = input.value.trim().toLowerCase();
    let visible = 0;
    productCards.forEach(card => {
      const match = card.dataset.name.toLowerCase().includes(q);
      card.hidden = !match;
      if (match) visible++;
    });
    const noResults = document.getElementById('no-results');
    if (noResults) noResults.hidden = visible > 0;
  }
  input?.addEventListener('input', filterHomepageCards);
  document.getElementById('reset-search')?.addEventListener('click', () => {
    if (!input) return;
    input.value = '';
    filterHomepageCards();
    input.focus();
  });

  document.querySelectorAll('[data-minimize]').forEach(button =>
    button.addEventListener('click', () => {
      const win = button.closest('.sys-window');
      if (!win) return;
      win.classList.toggle('collapsed');
      button.textContent = win.classList.contains('collapsed') ? '+' : '−';
    })
  );

  document.querySelectorAll('[data-maximize]').forEach(button =>
    button.addEventListener('click', () => {
      const win = button.closest('.sys-window');
      if (!win) return;
      win.classList.remove('collapsed');
      win.classList.toggle('maxed');
      
    })
  );

  document.querySelectorAll('[data-close]').forEach(button =>
    button.addEventListener('click', () => {
      const win = button.closest('.sys-window');
      if (!win) return;
      win.classList.add('closed');
      
    })
  );

  document.querySelectorAll('[data-back]').forEach(b =>
    b.addEventListener('click', () => history.length > 1 ? history.back() : notify('BRAK POPRZEDNIEJ STRONY'))
  );
  document.querySelectorAll('[data-forward]').forEach(b =>
    b.addEventListener('click', () => history.forward())
  );
  document.querySelectorAll('[data-refresh]').forEach(b =>
    b.addEventListener('click', () => location.reload())
  );

  const weekdays = ['NIEDZIELA','PONIEDZIAŁEK','WTOREK','ŚRODA','CZWARTEK','PIĄTEK','SOBOTA'];
  const months = ['STYCZEŃ','LUTY','MARZEC','KWIECIEŃ','MAJ','CZERWIEC','LIPIEC','SIERPIEŃ','WRZESIEŃ','PAŹDZIERNIK','LISTOPAD','GRUDZIEŃ'];
  function clock() {
    const d = new Date();
    document.getElementById('month') && (document.getElementById('month').textContent = months[d.getMonth()]);
    document.getElementById('day') && (document.getElementById('day').textContent = d.getDate());
    document.getElementById('weekday') && (document.getElementById('weekday').textContent = weekdays[d.getDay()]);
    document.getElementById('clock-time') && (document.getElementById('clock-time').textContent = d.toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit'}));
    document.getElementById('clock-date') && (document.getElementById('clock-date').textContent = d.toLocaleDateString('en-US'));
  }
  clock();
  setInterval(clock, 30000);

  /* all-products page filtering */
  const archiveGrid = document.getElementById('archive-grid');
  if (archiveGrid) {
    const archiveCards = [...archiveGrid.querySelectorAll('.catalog-card')];
    const archiveCount = document.getElementById('archive-count');
    const archiveEmpty = document.getElementById('archive-empty');
    const search = document.getElementById('archive-search');
    const categoryButtons = [...document.querySelectorAll('.archive-side-item[data-category]')];
    const availabilityChecks = [...document.querySelectorAll('[data-filter-availability]')];
    const tagButtons = [...document.querySelectorAll('.chip[data-filter-tag]')];
    const clearAll = document.getElementById('clear-all-filters');

    let activeCategory = 'all';
    const activeTags = new Set();

    function applyArchiveFilters() {
      const q = (search?.value || '').trim().toLowerCase();
      const activeAvailability = availabilityChecks.filter(i => i.checked).map(i => i.value);
      let visible = 0;

      archiveCards.forEach(card => {
        const name = card.dataset.name.toLowerCase();
        const categories = (card.dataset.category || '').split(/\s+/).filter(Boolean);
        const tags = (card.dataset.tags || '').split(/\s+/).filter(Boolean);
        const availability = card.dataset.availability || '';

        const searchMatch = !q || name.includes(q);
        const categoryMatch = activeCategory === 'all' || categories.includes(activeCategory);
        const availabilityMatch = !activeAvailability.length || activeAvailability.includes(availability);
        const tagMatch = !activeTags.size || [...activeTags].every(tag => tags.includes(tag));

        const show = searchMatch && categoryMatch && availabilityMatch && tagMatch;
        card.hidden = !show;
        if (show) visible += 1;
      });

      if (archiveCount) archiveCount.textContent = String(visible);
      if (archiveEmpty) archiveEmpty.hidden = visible > 0;
    }

    search?.addEventListener('input', applyArchiveFilters);
    availabilityChecks.forEach(ch => ch.addEventListener('change', applyArchiveFilters));

    categoryButtons.forEach(button =>
      button.addEventListener('click', () => {
        activeCategory = button.dataset.category;
        categoryButtons.forEach(btn => btn.classList.toggle('active', btn === button));
        applyArchiveFilters();
      })
    );

    tagButtons.forEach(button =>
      button.addEventListener('click', () => {
        const tag = button.dataset.filterTag;
        if (activeTags.has(tag)) {
          activeTags.delete(tag);
          button.classList.remove('active');
        } else {
          activeTags.add(tag);
          button.classList.add('active');
        }
        applyArchiveFilters();
      })
    );

    clearAll?.addEventListener('click', () => {
      activeCategory = 'all';
      categoryButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.category === 'all'));
      availabilityChecks.forEach(ch => ch.checked = false);
      activeTags.clear();
      tagButtons.forEach(btn => btn.classList.remove('active'));
      if (search) search.value = '';
      applyArchiveFilters();
    });

    applyArchiveFilters();
  }

  /* ---------- product window ---------- */
  const pd = dialogs.product;
  let pdIndex = -1;
  const $ = id => document.getElementById(id);
  function openProduct(id, { push = true } = {}) {
    const i = DATA.findIndex(p => p.id === id);
    if (i < 0 || !pd) return;
    pdIndex = i;
    const p = DATA[i];
    const sold = p.status === 'soldout';
    $('pd-bar').textContent = `ARCHIWUM / ${p.id} — ${p.name}`;
    $('pd-kicker').textContent = `MASKA ${p.id} · ${STATUS[p.status] || ''}`;
    $('pd-title').textContent = p.name;
    $('pd-price').textContent = formatPLN(p.price);
    $('pd-desc').textContent = p.description || '';
    const rows = Object.entries(p.details || {}).filter(([, v]) => v && v !== 'TO FILL');
    $('pd-details').innerHTML = rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
    $('pd-details').hidden = !rows.length;
    const imgs = (p.images || []).filter(Boolean);
    const setImg = src => { const im = $('pd-img'); im.src = src; im.alt = fullName(p); };
    setImg(imgs[0] || '');
    $('pd-thumbs').innerHTML = imgs.length > 1 ? imgs.map((src, n) => `<button type="button" class="${n ? '' : 'active'}" data-src="${esc(src)}" aria-label="Photo ${n + 1}"><img src="${esc(src)}" alt=""></button>`).join('') : '';
    $('pd-thumbs').onclick = e => {
      const t = e.target.closest('[data-src]'); if (!t) return;
      setImg(t.dataset.src);
      $('pd-thumbs').querySelectorAll('button').forEach(b => b.classList.toggle('active', b === t));
    };
    $('pd-add').disabled = $('pd-buy').disabled = sold;
    $('pd-add').firstChild.textContent = sold ? 'WYPRZEDANE ' : 'DO KOSZYKA ';
    if (!pd.open) pd.showModal();
    pd.querySelector('.pd-body').scrollTop = 0;
    if (push) try { history.replaceState(null, '', `#mask-${p.id}`); } catch (e) {}
    document.dispatchEvent(new CustomEvent('us:open', { detail: { id: p.id } }));
  }
  window.openProduct = openProduct;
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-open]');
    if (t) openProduct(t.dataset.open);
  });
  document.addEventListener('keydown', e => {
    const t = e.target.closest?.('[data-open]');
    if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openProduct(t.dataset.open); }
    if (pd?.open && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !e.target.closest('input')) {
      openProduct(DATA[(pdIndex + (e.key === 'ArrowRight' ? 1 : -1) + DATA.length) % DATA.length].id);
    }
  });
  $('pd-prev')?.addEventListener('click', () => openProduct(DATA[(pdIndex - 1 + DATA.length) % DATA.length].id));
  $('pd-next')?.addEventListener('click', () => openProduct(DATA[(pdIndex + 1) % DATA.length].id));
  $('pd-add')?.addEventListener('click', () => addToCart(DATA[pdIndex].id));
  $('pd-buy')?.addEventListener('click', () => {
    const id = DATA[pdIndex].id;
    if (!cart[id]) addToCart(id, true);
    pd.close();
    openOrder();
  });
  $('pd-share')?.addEventListener('click', async () => {
    const url = location.href.split('#')[0] + `#mask-${DATA[pdIndex].id}`;
    try { await navigator.clipboard.writeText(url); notify('LINK SKOPIOWANY'); } catch (e) { notify(url); }
  });
  pd?.addEventListener('close', () => {
    if (/^#mask-/.test(location.hash)) try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  });
  // torch mode: the mask sits in the dark, pointer is the light
  const stage = $('pd-stage');
  $('pd-light')?.addEventListener('click', e => {
    const on = stage.classList.toggle('torch');
    e.currentTarget.setAttribute('aria-pressed', on);
    e.currentTarget.textContent = on ? '◑ ZAPAL ŚWIATŁO' : '◐ ZGAŚ ŚWIATŁO';
    if (on) { stage.style.setProperty('--tx', '50%'); stage.style.setProperty('--ty', '45%'); }
  });
  stage?.addEventListener('pointermove', e => {
    const r = stage.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    stage.style.setProperty('--tx', `${x * 100}%`);
    stage.style.setProperty('--ty', `${y * 100}%`);
    stage.style.setProperty('--rx', `${(0.5 - y) * 8}deg`);
    stage.style.setProperty('--ry', `${(x - 0.5) * 10}deg`);
  });
  // swipe between masks on touch (when the torch is off)
  let swX = null;
  stage?.addEventListener('touchstart', e => { swX = e.touches[0].clientX; }, { passive: true });
  stage?.addEventListener('touchend', e => {
    if (swX === null || stage.classList.contains('torch')) return;
    const dx = e.changedTouches[0].clientX - swX; swX = null;
    if (Math.abs(dx) > 50) openProduct(DATA[(pdIndex + (dx < 0 ? 1 : -1) + DATA.length) % DATA.length].id);
  }, { passive: true });
  stage?.addEventListener('pointerleave', () => { stage.style.setProperty('--rx', '0deg'); stage.style.setProperty('--ry', '0deg'); });

  /* ---------- checkout: 01 koszyk → 02 dane → 03 wysyłka na Instagramie → 04 dzięki ---------- */
  const ck = dialogs.cart, ckIn = document.getElementById('ck-in'), form = document.getElementById('ck-form');
  const F = { name: '', tel: '', addr: '', note: '' };
  let orderNo = '', copied = false;
  const back = () => location.pathname.endsWith('sklep.html');
  function newNo() { const d = new Date(); return `US-${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}-${String(Math.random() * 9000 + 1000 | 0)}`; }

  function orderText(full) {
    const { sum } = totals(), disc = discount(sum);
    const lines = Object.entries(cart).map(([id, q]) => { const p = byId(id); return `• ${id} ${p ? p.name : products[id]?.name || id} × ${q} — ${zl((products[id]?.price || 0) * q)}`; });
    const out = [`1uglysaint · ZAMÓWIENIE${orderNo ? ' № ' + orderNo : ''}`, '', ...lines, ''];
    if (disc > 0) out.push(`KOD ${activeCode()} (−${SHOP.gameDiscount || 10}%): −${zl(disc)}`);
    out.push(`RAZEM: ${zl(sum - disc)} + wysyłka (podacie w odpowiedzi)`, '');
    const f = full === false ? { name: '', tel: '', addr: '', note: '' } : F;
    out.push(`Imię i nazwisko: ${f.name}`, `Telefon: ${f.tel}`, `Adres wysyłki: ${f.addr.replace(/\s*\n\s*/g, ', ')}`);
    if (f.note) out.push(`Uwagi: ${f.note.replace(/\s*\n\s*/g, ' ')}`);
    return out.join('\n');
  }

  function drawActs() {
    const a = document.getElementById('ck-acts'); if (!a) return;
    const n = totals().count;
    const shop = back() ? '<button type="button" class="ck-ghost" data-dismiss-ck>WRÓĆ DO MASEK</button>' : '<a class="ck-ghost" href="sklep.html">WRÓĆ DO MASEK</a>';
    let h = '';
    if (step === 1) h = n ? `<button type="button" class="ck-cta" data-go="2">ZAMAWIAM <span>→</span></button><div class="ck-row">${shop}<button type="button" class="ck-text" data-clear>WYCZYŚĆ KOSZYK</button></div>`
                          : (back() ? '<button type="button" class="ck-cta" data-dismiss-ck>DO PRZYMIERZALNI <span>→</span></button>' : '<a class="ck-cta" href="sklep.html">DO PRZYMIERZALNI <span>→</span></a>');
    else if (step === 2) h = `<button type="button" class="ck-cta" data-go="3">DALEJ <span>→</span></button><div class="ck-row"><button type="button" class="ck-ghost" data-go="1">← KOSZYK</button></div>`;
    else if (step === 3) h = (IG ? `<button type="button" class="ck-cta ig" data-ig><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".9"/></svg>${copied ? 'OTWÓRZ INSTAGRAM JESZCZE RAZ' : 'KOPIUJ I OTWÓRZ INSTAGRAM'} <span>→</span></button>` : '')
      + `<div class="ck-row"><button type="button" class="ck-ghost" data-go="2">← DANE</button><button type="button" class="ck-text" data-copy>${IG ? 'TYLKO KOPIUJ' : 'KOPIUJ ZAMÓWIENIE'}</button></div>`
      + (copied ? '<button type="button" class="ck-sent" data-sent>WYSŁAŁEM ✓ WYCZYŚĆ KOSZYK</button>' : '');
    else h = `${back() ? '<button type="button" class="ck-cta" data-dismiss-ck>WRÓĆ DO MASEK <span>→</span></button>' : '<a class="ck-cta" href="sklep.html">WRÓĆ DO MASEK <span>→</span></a>'}${IG ? `<div class="ck-row"><a class="ck-ghost" href="https://instagram.com/${encodeURIComponent(IG)}" target="_blank" rel="noopener">@${esc(IG)} →</a></div>` : ''}`;
    a.innerHTML = h;
    document.getElementById('ck-sum').hidden = step >= 3 || !n;   // w kroku 3 suma jest na protokole
    document.getElementById('ck-trust').hidden = step === 4;
  }

  function setStep(n, focus) {
    step = n;
    ckIn.dataset.step = n;
    ckIn.querySelectorAll('.ck-pane').forEach(p => { p.hidden = +p.dataset.pane !== n; });
    ckIn.querySelectorAll('.ck-steps li').forEach(li => { li.classList.toggle('on', +li.dataset.s === n); li.classList.toggle('done', +li.dataset.s < n); });
    if (n === 3) {
      if (!orderNo) orderNo = newNo();
      document.getElementById('ck-no').textContent = '№ ' + orderNo;
      document.getElementById('ck-slip-t').textContent = orderText().split('\n').slice(2).join('\n');
      document.getElementById('ck-done').hidden = !copied;
      ckIn.querySelector('.ck-how').hidden = copied;
    }
    drawActs();
    document.getElementById('ck-body').scrollTop = 0;
    if (focus) ckIn.querySelector(`.ck-pane[data-pane="${n}"] .ck-h`)?.focus({ preventScroll: true });
  }

  function openCart(at) {
    if (step === 4) { orderNo = ''; copied = false; }
    setStep(at || 1);
    if (!ck.open) ck.showModal();
    window.USSound?.crackle?.(.4);
  }
  function openOrder() { openCart(totals().count ? 2 : 1); }

  /* step 2: form */
  const ERR = { name: 'Wpisz imię i nazwisko.', tel: 'Wpisz numer telefonu, przyda się kurierowi.', addr: 'Wpisz adres: ulica i numer, kod pocztowy, miasto.' };
  function check(show) {
    for (const k of Object.keys(F)) F[k] = (form.elements[k]?.value || '').trim();
    let ok = true, first = null;
    for (const k of ['name', 'tel', 'addr']) {
      const el = form.elements[k], v = el.value.trim();
      const good = k === 'tel' ? (v.replace(/\D/g, '').length >= 9) : k === 'addr' ? v.length >= 8 : v.length >= 3;
      const err = el.parentElement.querySelector('.ck-err');
      if (show) { err.textContent = good ? '' : ERR[k]; el.classList.toggle('bad', !good); el.setAttribute('aria-invalid', !good); }
      if (!good) { ok = false; first = first || el; }
    }
    if (!ok && show && first) first.focus();
    return ok;
  }
  form.addEventListener('input', e => {
    const el = e.target; if (!el.name) return;
    F[el.name] = el.value.trim();
    if (el.classList.contains('bad')) check(true);
    if (step === 3) setStep(3);
    orderNo && (copied = false);
  });
  form.addEventListener('submit', e => { e.preventDefault(); if (check(true)) setStep(3, true); });

  /* clipboard that also works without https (from disk) */
  async function copy(t) {
    try { await navigator.clipboard.writeText(t); return true; } catch (e) {}
    try { const ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0'; ck.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok; } catch (e) { return false; }
  }

  ck.addEventListener('click', async e => {
    const t = e.target;
    const q = t.closest('[data-q]');
    if (q) {
      const id = q.closest('[data-id]').dataset.id;
      cart[id] = Math.max(0, Math.min(MAXQ, (cart[id] || 0) + +q.dataset.q));
      if (!cart[id]) { undo = { id, qty: 1 }; delete cart[id]; showUndo(id); }
      renderCart(); return;
    }
    const rm = t.closest('[data-rm]');
    if (rm) {
      const row = rm.closest('[data-id]'), id = row.dataset.id;
      undo = { id, qty: cart[id] }; row.classList.add('gone');
      setTimeout(() => { delete cart[id]; renderCart(); showUndo(id); }, 220); return;
    }
    if (t.closest('#ck-undo-b') && undo) { cart[undo.id] = undo.qty; undo = null; document.getElementById('ck-undo').hidden = true; renderCart(); return; }
    const add = t.closest('[data-ck-add]');
    if (add) { addToCart(add.dataset.ckAdd, true); return; }
    if (t.closest('[data-clear]')) { Object.keys(cart).forEach(k => delete cart[k]); renderCart(); return; }
    if (t.closest('[data-dismiss-ck]')) { ck.close(); return; }
    const go = t.closest('[data-go]');
    if (go) {
      const n = +go.dataset.go;
      if (n === 3 && !check(true)) return;
      setStep(n, true); return;
    }
    if (t.closest('[data-copy]')) {
      const ok = await copy(orderText());
      copied = copied || ok; setStep(3);
      const b = ck.querySelector('[data-copy]'); if (b) b.textContent = ok ? 'SKOPIOWANE ✓' : 'ZAZNACZ I SKOPIUJ RĘCZNIE';
      if (!ok) { const r = document.createRange(); r.selectNodeContents(document.getElementById('ck-slip-t')); getSelection().removeAllRanges(); getSelection().addRange(r); }
      return;
    }
    if (t.closest('[data-ig]')) {
      const ok = await copy(orderText());
      copied = true; setStep(3);
      if (!ok) { const r = document.createRange(); r.selectNodeContents(document.getElementById('ck-slip-t')); getSelection().removeAllRanges(); getSelection().addRange(r); }
      window.open(`https://ig.me/m/${encodeURIComponent(IG)}`, '_blank', 'noopener');
      return;
    }
    if (t.closest('[data-sent]')) {
      const no = orderNo;
      Object.keys(cart).forEach(k => delete cart[k]);
      document.getElementById('ck-thx').innerHTML = `Zamówienie <b>№ ${esc(no)}</b> czeka u nas na Instagramie. Odpiszemy z płatnością i kosztem wysyłki${IG ? ` z konta <b>@${esc(IG)}</b>` : ''}.`;
      step = 4; renderCart(); setStep(4, true);
      orderNo = ''; copied = false; form.reset(); Object.keys(F).forEach(k => F[k] = '');
    }
  });
  function showUndo(id) {
    const u = document.getElementById('ck-undo'); if (!u) return;
    document.getElementById('ck-undo-t').textContent = `USUNIĘTO: ${byId(id)?.name || id}`;
    u.hidden = false; clearTimeout(undoT);
    undoT = setTimeout(() => { u.hidden = true; undo = null; }, 8000);
  }
  ck.addEventListener('close', () => { if (step !== 4) setStep(1); document.dispatchEvent(new Event('us:cart-close')); });
  document.addEventListener('click', e => { if (e.target.closest('[data-order]')) openOrder(); });
  setStep(1);

  renderCart();
  const deep = location.hash.match(/^#mask-(\d+)$/);
  if (deep) openProduct(deep[1], { push: false });
  window.US = { DATA, cart, products, addToCart, openProduct, openOrder, openCart, orderText: () => orderText(false), notify, totals, formatPLN, setCode, activeCode, renderCart };
})();
