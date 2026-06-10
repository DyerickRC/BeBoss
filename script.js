/**
 * BE BOSS 18k — script.js
 * Fully automated e-commerce script.
 * Features: products, cart, search, sort, quick-view,
 * user account, CEP auto-fill, PIX checkout, WhatsApp order,
 * mobile nav, scroll effects, animations, cookie consent.
 */
/* Sempre volta ao topo ao recarregar */
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.addEventListener('load', () => window.scrollTo(0, 0));

(function () {
  'use strict';

  /* =====================================================
     PRODUCT DATA — reads from admin localStorage first
     Fallback: real products from bebossjoias18k.com.br
  ===================================================== */
  const _stored = localStorage.getItem('beboss_products');
  const products = _stored ? JSON.parse(_stored) : (window._BEBOSS_DEFAULT_PRODUCTS || []);

  /* =====================================================
     UTILS
  ===================================================== */
  function qs(sel, ctx = document) { return ctx.querySelector(sel); }
  function qsa(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }

  function formatBRL(n) {
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function installments(price, n = 12) {
    const val = price / n;
    return `${n}x de ${formatBRL(val)} sem juros`;
  }

  function getParams() {
    const p = {};
    new URLSearchParams(location.search).forEach((v, k) => p[k] = v);
    return p;
  }

  function showToast(msg, ms = 2800) {
    const t = qs('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), ms);
  }

  /* =====================================================
     VALIDAÇÕES
  ===================================================== */
  function validarEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  }

  function validarCPF(cpf) {
    cpf = cpf.replace(/\D/g, '');
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    let s = 0, r;
    for (let i = 0; i < 9; i++) s += +cpf[i] * (10 - i);
    r = (s * 10) % 11; if (r >= 10) r = 0;
    if (r !== +cpf[9]) return false;
    s = 0;
    for (let i = 0; i < 10; i++) s += +cpf[i] * (11 - i);
    r = (s * 10) % 11; if (r >= 10) r = 0;
    return r === +cpf[10];
  }

  async function validarCEP(cep) {
    const clean = cep.replace(/\D/g, '');
    if (clean.length !== 8) return false;
    try {
      const res  = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      return !data.erro;
    } catch { return false; }
  }

  /* =====================================================
     HEADER SCROLL EFFECT
  ===================================================== */
  const header = qs('#siteHeader');
  window.addEventListener('scroll', () => {
    header?.classList.toggle('scrolled', window.scrollY > 30);
    const btn = qs('#backToTop');
    btn?.classList.toggle('visible', window.scrollY > 400);
  }, { passive: true });

  qs('#backToTop')?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  /* =====================================================
     ANNOUNCEMENT BAR
  ===================================================== */
  qs('#closeAnnouncement')?.addEventListener('click', () => {
    const bar = qs('#announcementBar');
    if (bar) bar.style.display = 'none';
  });

  /* =====================================================
     MOBILE NAV
  ===================================================== */
  const menuToggle = qs('#menuToggle');
  const mobileDrawer = qs('#mobileNavDrawer');
  const mobileOverlay = qs('#mobileNavOverlay');
  const closeMenu = qs('#closeMenu');

  function openMobileNav() {
    mobileDrawer?.classList.add('open');
    mobileOverlay?.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeMobileNav() {
    mobileDrawer?.classList.remove('open');
    mobileOverlay?.classList.remove('open');
    document.body.style.overflow = '';
  }
  menuToggle?.addEventListener('click', openMobileNav);
  closeMenu?.addEventListener('click', closeMobileNav);
  mobileOverlay?.addEventListener('click', closeMobileNav);

  /* =====================================================
     SEARCH DRAWER
  ===================================================== */
  const searchDrawer = qs('#searchDrawer');
  const searchInput  = qs('#searchInput');
  const searchToggle = qs('#searchToggle');
  const closeSearch  = qs('#closeSearch');

  function openSearch() {
    searchDrawer?.classList.add('open');
    searchDrawer?.setAttribute('aria-hidden', 'false');
    setTimeout(() => searchInput?.focus(), 100);
  }
  function closeSearchDrawer() {
    searchDrawer?.classList.remove('open');
    searchDrawer?.setAttribute('aria-hidden', 'true');
  }
  searchToggle?.addEventListener('click', () => {
    const isOpen = searchDrawer?.classList.contains('open');
    isOpen ? closeSearchDrawer() : openSearch();
  });
  closeSearch?.addEventListener('click', closeSearchDrawer);

  let _searchTimer = null;
  searchInput?.addEventListener('input', () => {
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => {
      const q = searchInput.value.trim();
      renderProducts(q, currentCategory);
      if (q) setTimeout(() => qs('#mainContent')?.scrollIntoView({ behavior:'smooth', block:'start' }), 150);
    }, 260);
  });
  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSearchDrawer();
  });

  /* =====================================================
     ACTIVE NAV LINK
  ===================================================== */
  const params = getParams();
  let currentCategory = params.category || '';
  const isViewAll  = params.view === 'all' || !!currentCategory;
  const isHomepage = !currentCategory && params.view !== 'all';

  qsa('.nav-inner a').forEach(a => {
    a.classList.remove('active');
    if (a.dataset.viewAll && isViewAll && !currentCategory) {
      a.classList.add('active');                        // highlight "Ver Tudo"
    } else if (!a.dataset.viewAll && a.dataset.category === currentCategory && currentCategory) {
      a.classList.add('active');                        // highlight category
    }
  });

  /* =====================================================
     PRODUCTS RENDER
  ===================================================== */
  const grid = qs('#productsGrid');
  let renderDelay = 0;
  let _allFiltered = [];
  let _shownCount  = 0;
  const PAGE_SIZE  = 24;

  function renderProducts(query = '', category = '', sort = 'default') {
    if (!grid) return;

    // Homepage + busca: mostra/esconde mainContent dinamicamente
    if (isHomepage) {
      const mc = qs('#mainContent');
      if (query) {
        if (mc) mc.style.display = '';
        if (_title) _title.textContent = `Resultados para "${query}"`;
        if (_sub)   _sub.textContent   = 'Pesquisa em toda a coleção';
      } else {
        const hasFeat = (() => { try { const v = localStorage.getItem('beboss_featured'); return v && JSON.parse(v).length > 0; } catch { return false; } })();
        if (mc) mc.style.display = hasFeat ? '' : 'none';
        if (hasFeat && _title) _title.textContent = 'Destaques da Loja';
        if (hasFeat && _sub)   _sub.textContent   = 'Peças selecionadas especialmente para você';
      }
    }

    // Read featured list fresh each time (admin may have changed it)
    let featuredIds = null;
    try {
      const _fv = localStorage.getItem('beboss_featured');
      if (_fv) featuredIds = JSON.parse(_fv).map(String);
    } catch {}

    let filtered = products.filter(p => {
      const matchCat = !category || p.category.toLowerCase() === category.toLowerCase();
      const q = query.toLowerCase();
      const matchQ = !q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
      return matchCat && matchQ;
    });

    // ── Homepage mode: mostra produtos da vitrine (se configurada pelo admin)
    const verTudoWrap = qs('#verTudoWrap');
    if (isHomepage && !query) {
      if (featuredIds && featuredIds.length > 0) {
        // Vitrine configurada → mostra os selecionados na ordem do admin
        filtered = filtered.filter(p => featuredIds.includes(String(p.id)));
        filtered.sort((a, b) => featuredIds.indexOf(String(a.id)) - featuredIds.indexOf(String(b.id)));
      } else {
        // Sem vitrine → homepage limpa (sem produtos), só categorias
        filtered = [];
      }
      if (verTudoWrap) verTudoWrap.style.display = '';
    } else {
      if (verTudoWrap) verTudoWrap.style.display = 'none';
    }

    if (sort === 'price-asc') filtered.sort((a, b) => a.price - b.price);
    else if (sort === 'price-desc') filtered.sort((a, b) => b.price - a.price);
    else if (sort === 'name-asc') filtered.sort((a, b) => a.name.localeCompare(b.name));

    _allFiltered = filtered;
    _shownCount  = 0;

    if (!filtered.length) {
      grid.innerHTML = `<div class="no-results">Nenhum produto encontrado 🔍</div>`;
      _updateLoadMore();
      return;
    }

    const firstBatch = filtered.slice(0, PAGE_SIZE);
    _shownCount = firstBatch.length;
    grid.innerHTML = firstBatch.map((p, i) => _buildCard(p, i)).join('');

    observeNewReveal();
    _bindProductButtons();
    _updateLoadMore();
  }

  /* =====================================================
     PAGINAÇÃO — "Mostrar Mais" (performance fix)
  ===================================================== */
  function _buildCard(p, animIdx) {
    const esgotado = typeof p.stock === 'number' && p.stock <= 0;
    return `
    <article class="product-card${esgotado ? ' product-esgotado' : ''}" data-id="${p.id}">
      <div class="product-image-wrap">
        <img class="product-image" src="${p.image}" alt="${p.name}" loading="lazy" />
        ${esgotado
          ? `<span class="product-badge badge-esgotado">Esgotado</span>`
          : p.badge ? `<span class="product-badge">${p.badge}</span>` : ''}
        <div class="product-overlay">
          <button class="product-overlay-btn quick-view-btn" data-id="${p.id}">Ver Detalhes</button>
          ${!esgotado ? `<button class="product-overlay-btn add-from-overlay" data-id="${p.id}">+ Carrinho</button>` : ''}
          <button class="card-share-btn" data-id="${p.id}" title="Compartilhar no WhatsApp"><i class="fab fa-whatsapp"></i></button>
        </div>
      </div>
      <div class="product-info">
        <p class="product-category">${p.category}</p>
        <h3 class="product-name">${p.name}</h3>
        <p class="product-desc">${p.description}</p>
        <div class="product-footer">
          <div>
            <div class="product-price">${formatBRL(p.price)}</div>
            <div class="product-installment">${esgotado ? 'Produto esgotado' : installments(p.price)}</div>
          </div>
          ${esgotado
            ? `<button class="product-add-btn product-add-btn--disabled" disabled aria-label="Esgotado"><i class="fas fa-ban"></i></button>`
            : `<button class="product-add-btn" data-id="${p.id}" aria-label="Adicionar ao carrinho"><i class="fas fa-plus"></i></button>`}
        </div>
      </div>
    </article>
    `;
  }

  // Event delegation: UM listener na grid em vez de N por card
  grid?.addEventListener('click', (e) => {
    const add   = e.target.closest('.product-add-btn:not(:disabled), .add-from-overlay');
    const qv    = e.target.closest('.quick-view-btn');
    const share = e.target.closest('.card-share-btn');
    if (add)   { e.stopPropagation(); addToCart(add.dataset.id); }
    if (qv)    { e.stopPropagation(); openQuickView(qv.dataset.id); }
    if (share) {
      e.stopPropagation();
      const p = products.find(x => String(x.id) === share.dataset.id);
      if (p) {
        const msg = `✦ Olha essa joia na *Be Boss 18k*!\n\n*${p.name}*\n${formatBRL(p.price)} • ${installments(p.price)}\n\nOuro 18k certificado 💛`;
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
      }
    }
  });

  function _bindProductButtons() { /* substituído por event delegation acima */ }

  function _updateLoadMore() {
    const wrap = qs('#loadMoreWrap');
    if (!wrap) return;
    const remaining = _allFiltered.length - _shownCount;
    wrap.style.display = remaining > 0 ? '' : 'none';
    const countEl = qs('#loadMoreCount');
    if (countEl) countEl.textContent = remaining;
  }

  function loadMore() {
    const batch = _allFiltered.slice(_shownCount, _shownCount + PAGE_SIZE);
    if (!batch.length) return;
    const frag = document.createDocumentFragment();
    batch.forEach((p, i) => {
      const tmp = document.createElement('div');
      tmp.innerHTML = _buildCard(p, i % PAGE_SIZE).trim();
      frag.appendChild(tmp.firstChild);
    });
    grid.appendChild(frag);
    _shownCount += batch.length;
    observeNewReveal();
    _bindProductButtons();
    _updateLoadMore();
  }
  window.loadMore = loadMore;

  /* =====================================================
     SORT
  ===================================================== */
  qs('#sortSelect')?.addEventListener('change', (e) => {
    renderProducts(searchInput?.value?.trim() || '', currentCategory, e.target.value);
  });

  /* =====================================================
     CART
  ===================================================== */
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem('beboss_cart')) || []; } catch {}

  function saveCart() {
    localStorage.setItem('beboss_cart', JSON.stringify(cart));
  }

  function addToCart(id) {
    const sid = String(id);
    const product = products.find(p => String(p.id) === sid);
    if (!product) return;
    if (typeof product.stock === 'number' && product.stock <= 0) {
      showToast('Produto esgotado.');
      return;
    }
    const existing = cart.find(i => String(i.id) === sid);
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({ ...product, qty: 1 });
    }
    saveCart();
    updateCartUI();
    showToast(`✦ ${product.name} adicionado ao carrinho`);
    openCart();
  }

  function removeFromCart(id) {
    const sid = String(id);
    cart = cart.filter(i => String(i.id) !== sid);
    saveCart();
    updateCartUI();
  }

  function changeQty(id, delta) {
    const sid = String(id);
    const item = cart.find(i => String(i.id) === sid);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) removeFromCart(id);
    else { saveCart(); updateCartUI(); }
  }

  function updateCartUI() {
    const total = cart.reduce((s, i) => s + i.qty, 0);
    const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);

    const countEl = qs('#cartCount');
    const itemCountEl = qs('#cartItemCount');
    if (countEl) {
      countEl.textContent = total;
      countEl.style.display = total ? 'flex' : 'none';
    }
    if (itemCountEl) itemCountEl.textContent = `(${total})`;

    const container = qs('#cartItemsContainer');
    const footer = qs('#cartFooter');
    const subtotalEl = qs('#cartSubtotal');
    if (subtotalEl) subtotalEl.textContent = formatBRL(subtotal);

    if (!container) return;

    if (!cart.length) {
      container.innerHTML = `
        <div class="empty-cart">
          <i class="fas fa-shopping-bag"></i>
          <p>Seu carrinho está vazio</p>
          <a href="?" class="btn-primary btn-sm">Ver Coleção</a>
        </div>`;
      if (footer) footer.style.display = 'none';
      return;
    }

    if (footer) footer.style.display = 'block';

    container.innerHTML = cart.map(item => `
      <div class="cart-item" data-id="${item.id}">
        <img class="cart-item-img" src="${item.image}" alt="${item.name}" />
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">${formatBRL(item.price)}</div>
          <div class="cart-item-qty">
            <button class="qty-btn" data-id="${item.id}" data-delta="-1">−</button>
            <span class="qty-num">${item.qty}</span>
            <button class="qty-btn" data-id="${item.id}" data-delta="1">+</button>
          </div>
        </div>
        <button class="cart-item-remove" data-id="${item.id}" aria-label="Remover">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `).join('');

    qsa('.qty-btn').forEach(b => {
      b.addEventListener('click', () => changeQty(b.dataset.id, parseInt(b.dataset.delta)));
    });
    qsa('.cart-item-remove').forEach(b => {
      b.addEventListener('click', () => removeFromCart(b.dataset.id));
    });
  }

  /* Cart open/close */
  const cartPanel = qs('#cartPanel');
  const cartOverlay = qs('#cartOverlay');

  function openCart() {
    cartPanel?.classList.add('active');
    cartOverlay?.classList.add('active');
    cartPanel?.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function closeCartPanel() {
    cartPanel?.classList.remove('active');
    cartOverlay?.classList.remove('active');
    cartPanel?.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  qs('#cartBtn')?.addEventListener('click', openCart);
  qs('#closeCart')?.addEventListener('click', closeCartPanel);
  cartOverlay?.addEventListener('click', closeCartPanel);

  /* =====================================================
     QUICK VIEW MODAL
  ===================================================== */
  const quickViewModal = qs('#quickViewModal');
  const quickViewOverlay = qs('#quickViewOverlay');

  function openQuickView(id) {
    const sid = String(id);
    const p = products.find(x => String(x.id) === sid);
    if (!p) return;
    qs('#qvImage').src = p.image;
    qs('#qvImage').alt = p.name;
    qs('#qvCategory').textContent = p.category;
    qs('#qvName').textContent = p.name;
    qs('#qvDesc').textContent = p.description;
    qs('#qvPrice').textContent = formatBRL(p.price);
    qs('#qvInstallment').textContent = installments(p.price);

    const esgotado = typeof p.stock === 'number' && p.stock <= 0;
    const addBtn = qs('#qvAddToCart');
    if (esgotado) {
      addBtn.textContent = 'Esgotado';
      addBtn.disabled = true;
      addBtn.style.cssText = 'opacity:0.4;cursor:not-allowed;';
      addBtn.onclick = null;
    } else {
      addBtn.textContent = '';
      addBtn.innerHTML = '<i class="fas fa-shopping-bag"></i> Adicionar ao Carrinho';
      addBtn.disabled = false;
      addBtn.style.cssText = '';
      addBtn.onclick = () => { addToCart(p.id); closeQuickView(); };
    }

    const waLink = qs('#qvWhatsapp');
    waLink.href = `https://wa.me/5534993049244?text=${encodeURIComponent(`Olá! Tenho interesse no produto: ${p.name} — ${formatBRL(p.price)}. Poderia me dar mais informações?`)}`;

    // Botão Compartilhar
    const shareBtn = qs('#qvShare');
    if (shareBtn) {
      shareBtn.onclick = () => {
        const msg = `✦ Olha essa joia na *Be Boss 18k*!\n\n*${p.name}*\n${formatBRL(p.price)} • ${installments(p.price)}\n\nOuro 18k certificado 💛`;
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
      };
    }

    quickViewModal?.classList.add('active');
    quickViewOverlay?.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Render comment/review section
    setTimeout(() => _renderCommentSection(p.id), 50);
  }
  function closeQuickView() {
    quickViewModal?.classList.remove('active');
    quickViewOverlay?.classList.remove('active');
    document.body.style.overflow = '';
  }
  qs('#closeQuickView')?.addEventListener('click', closeQuickView);
  quickViewOverlay?.addEventListener('click', closeQuickView);

  /* =====================================================
     INFO MODAIS (footer links)
  ===================================================== */
  const INFO_CONTENT = {
    sobre: {
      title: 'Sobre Nós',
      icon: 'fa-gem',
      html: `<p>A <strong>Be Boss 18k</strong> nasceu em Uberlândia, Minas Gerais, com o propósito de transformar joias em símbolos de conquista, autoestima e personalidade.</p>
<p>Fundada com paixão pelo universo da joalheria, a marca surgiu do desejo de oferecer peças sofisticadas, modernas e acessíveis para quem valoriza estilo e exclusividade. Cada peça é escolhida com cuidado, prezando pela qualidade, acabamento impecável e elegância em cada detalhe.</p>
<p>Mais do que joias, entregamos significado, presença e estilo.</p>
<p style="margin-top:16px;font-style:italic;color:var(--gold-dark)">"Ser Be Boss é carregar consigo a essência de quem nasceu para brilhar."</p>
<div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap">
  <span style="background:var(--gold-bg);border:1px solid rgba(201,168,76,0.3);padding:6px 14px;border-radius:20px;font-size:0.75rem;color:var(--gold-dark)">✦ Fundada em Uberlândia · MG</span>
  <span style="background:var(--gold-bg);border:1px solid rgba(201,168,76,0.3);padding:6px 14px;border-radius:20px;font-size:0.75rem;color:var(--gold-dark)">✦ Ouro 18k Certificado</span>
  <span style="background:var(--gold-bg);border:1px solid rgba(201,168,76,0.3);padding:6px 14px;border-radius:20px;font-size:0.75rem;color:var(--gold-dark)">✦ 500+ Clientes Satisfeitos</span>
</div>`
    },
    comprar: {
      title: 'Como Comprar',
      icon: 'fa-shopping-bag',
      html: `<div class="info-steps">
  <div class="info-step"><span class="step-num">1</span><div><strong>Escolha sua peça</strong><p>Navegue pelas categorias ou use a busca para encontrar a joia perfeita.</p></div></div>
  <div class="info-step"><span class="step-num">2</span><div><strong>Adicione ao carrinho</strong><p>Clique em "Adicionar ao Carrinho" ou consulte via WhatsApp se tiver dúvidas.</p></div></div>
  <div class="info-step"><span class="step-num">3</span><div><strong>Crie sua conta</strong><p>Faça login ou crie uma conta para prosseguir — é rápido e gratuito.</p></div></div>
  <div class="info-step"><span class="step-num">4</span><div><strong>Informe o endereço</strong><p>Preencha seu endereço de entrega. O CEP é preenchido automaticamente.</p></div></div>
  <div class="info-step"><span class="step-num">5</span><div><strong>Escolha o pagamento</strong><p>PIX (aprovação imediata), Cartão de Crédito (até 12x) ou Boleto Bancário (1-2 dias úteis).</p></div></div>
  <div class="info-step"><span class="step-num">6</span><div><strong>Receba em casa</strong><p>Após a confirmação do pagamento, seu pedido é enviado em embalagem premium com rastreamento.</p></div></div>
</div>`
    },
    trocas: {
      title: 'Política de Trocas',
      icon: 'fa-exchange-alt',
      html: `<h4>Prazo de Troca</h4>
<p>Aceitamos trocas e devoluções em até <strong>30 dias corridos</strong> após o recebimento do produto.</p>
<h4>Condições</h4>
<ul class="info-list">
  <li>O produto deve estar sem sinais de uso, na embalagem original</li>
  <li>Acompanhar a nota fiscal e o certificado de autenticidade</li>
  <li>Joias personalizadas não são elegíveis para troca</li>
  <li>Defeitos de fabricação são cobertos sem custo adicional</li>
</ul>
<h4>Como solicitar</h4>
<p>Entre em contato pelo WhatsApp <a href="https://wa.me/5534993049244" target="_blank" style="color:var(--gold)">+55 34 99304-9244</a> ou pelo email <a href="mailto:beboss.joias18k@gmail.com" style="color:var(--gold)">beboss.joias18k@gmail.com</a> com o número do pedido e o motivo da troca.</p>
<p style="margin-top:12px;font-size:0.8rem;color:var(--soft)">O frete de retorno é de responsabilidade do cliente, exceto em casos de defeito de fabricação.</p>`
    },
    privacidade: {
      title: 'Política de Privacidade',
      icon: 'fa-shield-alt',
      html: `<h4>Dados coletados</h4>
<p>Coletamos apenas as informações necessárias para processar seu pedido: nome, email, CPF, telefone e endereço de entrega.</p>
<h4>Armazenamento</h4>
<p>Seus dados são armazenados localmente no seu dispositivo (localStorage) e nunca compartilhados com terceiros sem seu consentimento.</p>
<h4>Uso das informações</h4>
<ul class="info-list">
  <li>Processamento e rastreamento de pedidos</li>
  <li>Comunicação sobre sua compra via WhatsApp</li>
  <li>Melhoria da experiência de compra</li>
</ul>
<h4>Seus direitos</h4>
<p>Você pode solicitar a exclusão dos seus dados a qualquer momento pelo email <a href="mailto:beboss.joias18k@gmail.com" style="color:var(--gold)">beboss.joias18k@gmail.com</a>.</p>`
    },
    faq: {
      title: 'Perguntas Frequentes',
      icon: 'fa-question-circle',
      html: `<div class="faq-list">
  <details class="faq-item"><summary>As joias são realmente banhadas a ouro 18k?</summary><p>Sim. Todas as nossas peças passam por processo de banho a ouro 18k e acompanham certificado de autenticidade.</p></details>
  <details class="faq-item"><summary>Quanto tempo dura o banho a ouro?</summary><p>Com os cuidados adequados (evitar contato com água, perfumes e produtos químicos), o banho pode durar de 1 a 3 anos. Oferecemos serviço de rebanho mediante consulta.</p></details>
  <details class="faq-item"><summary>Qual o prazo de entrega?</summary><p>Para Uberlândia e região: 1-3 dias úteis. Para demais cidades do Brasil: 5-10 dias úteis via Correios com rastreamento.</p></details>
  <details class="faq-item"><summary>Como funciona o pagamento por PIX?</summary><p>Ao finalizar a compra, você receberá um QR Code e o código PIX copia-e-cola. O pagamento é confirmado em instantes e o pedido processado imediatamente.</p></details>
  <details class="faq-item"><summary>Posso parcelar no cartão?</summary><p>Sim, aceitamos parcelamento em até 12x. Parcelas de 1 a 3x sem juros; de 4 a 12x com juros progressivos.</p></details>
  <details class="faq-item"><summary>Como faço para trocar um produto?</summary><p>Entre em contato conosco em até 30 dias após o recebimento pelo WhatsApp ou email. Veja nossa Política de Trocas completa para mais detalhes.</p></details>
</div>`
    },
  };

  function openInfoModal(key) {
    const data = INFO_CONTENT[key];
    if (!data) return;
    const overlay = qs('#infoModalOverlay');
    const modal   = qs('#infoModal');
    const content = qs('#infoModalContent');
    if (!modal) return;
    content.innerHTML = `
      <div class="info-modal-header">
        <i class="fas ${data.icon}"></i>
        <h2>${data.title}</h2>
      </div>
      <div class="info-modal-body">${data.html}</div>`;
    overlay?.classList.add('active');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  function closeInfoModal() {
    qs('#infoModalOverlay')?.classList.remove('active');
    qs('#infoModal')?.classList.remove('active');
    document.body.style.overflow = '';
  }
  window.openInfoModal  = openInfoModal;
  window.closeInfoModal = closeInfoModal;

  /* =====================================================
     USER / LOGIN / SESSION
  ===================================================== */
  const loginBtn = qs('#loginBtn');
  const loginModal = qs('#loginModal');
  const loginOverlay = qs('#loginOverlay');
  const userDropdown = qs('#userDropdown');
  const logoutBtn = qs('#logoutBtn');
  const dropdownWelcome = qs('#dropdownWelcome');
  const signupForm = qs('#signupForm');

  function switchAuthTab(tab) {
    const loginF  = qs('#loginForm');
    const signupF = qs('#signupForm');
    const tabE    = qs('#tabEntrar');
    const tabC    = qs('#tabCadastro');
    if (tab === 'login') {
      loginF.style.display  = '';
      signupF.style.display = 'none';
      tabE.classList.add('active');
      tabC.classList.remove('active');
      setTimeout(() => qs('#loginEmail')?.focus(), 100);
    } else {
      loginF.style.display  = 'none';
      signupF.style.display = '';
      tabE.classList.remove('active');
      tabC.classList.add('active');
      setTimeout(() => qs('#signupEmail')?.focus(), 100);
    }
  }
  window.switchAuthTab = switchAuthTab;

  function openLoginModal() {
    if (sessionStorage.getItem('beboss_session')) return;
    switchAuthTab('login');
    loginModal?.classList.add('active');
    loginOverlay?.classList.add('active');
  }
  function closeLoginModal() {
    loginModal?.classList.remove('active');
    loginOverlay?.classList.remove('active');
    signupForm?.reset();
    qs('#loginForm')?.reset();
    if (qs('#loginError')) qs('#loginError').style.display = 'none';
  }

  function toggleDropdown(show = null) {
    if (!userDropdown) return;
    const isActive = userDropdown.classList.contains('active');
    const shouldShow = show !== null ? show : !isActive;
    userDropdown.classList.toggle('active', shouldShow);
    userDropdown.setAttribute('aria-hidden', String(!shouldShow));
  }

  function updateUserDisplay() {
    const data = sessionStorage.getItem('beboss_session');
    toggleDropdown(false);

    // Remove pill anterior se existir
    qs('#userPill')?.remove();
    loginBtn.style.display = '';
    loginBtn.onclick = null;

    if (!data) {
      loginBtn.innerHTML = '<i class="fas fa-user"></i>';
      loginBtn.title = 'Entrar / Criar conta';
      loginBtn.addEventListener('click', openLoginModal);
      return;
    }

    const user  = JSON.parse(data);
    const first = user.name.split(' ')[0];
    const init  = first[0].toUpperCase();

    if (dropdownWelcome) dropdownWelcome.textContent = `Olá, ${first} ✦`;

    // Cria pill profissional
    const pill = document.createElement('button');
    pill.id        = 'userPill';
    pill.className = 'user-pill';
    pill.setAttribute('aria-label', `Conta de ${first}`);
    pill.innerHTML = `
      <span class="pill-avatar">${init}</span>
      <span class="pill-name">${first}</span>
      <i class="fas fa-chevron-down pill-arrow"></i>`;
    pill.addEventListener('click', () => toggleDropdown());

    const container = loginBtn.closest('.user-profile-container');
    loginBtn.style.display = 'none';      // esconde o ícone original
    container?.appendChild(pill);
  }

  logoutBtn?.addEventListener('click', () => {
    sessionStorage.removeItem('beboss_session');
    updateUserDisplay();
    showToast('Você saiu da sua conta.');
  });

  /* ─── MEUS PEDIDOS ─── */
  qs('#viewOrders')?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleDropdown(false);
    _openOrdersModal();
  });

  function _openOrdersModal() {
    const sess = JSON.parse(sessionStorage.getItem('beboss_session') || '{}');
    if (!sess.email) { openLoginModal(); return; }

    const allOrders  = JSON.parse(localStorage.getItem('beboss_orders') || '[]');
    const userOrders = allOrders
      .filter(o => o.customer?.email === sess.email || o.customer?.cpf === sess.cpf)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const content = qs('#ordersModalContent');
    if (!content) return;

    const STATUS = { pendente:'🟡 Pendente', pago:'✅ Pago', enviado:'🚚 Enviado', entregue:'📦 Entregue', cancelado:'❌ Cancelado' };
    const PAY    = { pix:'PIX', credito:'Cartão de Crédito', boleto:'Boleto Bancário' };

    content.innerHTML = userOrders.length ? userOrders.map(o => {
      const itens = (o.items || []).map(i => `<li>${i.name} × ${i.qty} — ${formatBRL(i.price * i.qty)}</li>`).join('');
      const date  = o.createdAt ? new Date(o.createdAt).toLocaleDateString('pt-BR') : '';
      return `
        <div class="order-hist-card">
          <div class="ohc-top">
            <span class="ohc-id">#${(o.id||'').slice(-6).toUpperCase()}</span>
            <span class="ohc-status">${STATUS[o.status] || o.status}</span>
          </div>
          <ul class="ohc-items">${itens}</ul>
          <div class="ohc-bottom">
            <span class="ohc-meta">${date} · ${PAY[o.paymentMethod] || 'WhatsApp'}</span>
            <span class="ohc-total">${formatBRL(o.total || 0)}</span>
          </div>
          ${o.purchaseCode ? `<div class="ohc-code">Código de compra: <strong>${o.purchaseCode}</strong></div>` : ''}
        </div>`;
    }).join('') : `
      <div style="text-align:center;padding:40px 0">
        <i class="fas fa-box" style="font-size:2.8rem;color:var(--border);display:block;margin-bottom:16px"></i>
        <p style="color:var(--soft);margin-bottom:20px">Você ainda não fez nenhum pedido.</p>
        <a href="?view=all" class="btn-primary btn-sm">Ver Coleção</a>
      </div>`;

    qs('#ordersOverlay')?.classList.add('active');
    qs('#ordersModal')?.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function _closeOrdersModal() {
    qs('#ordersOverlay')?.classList.remove('active');
    qs('#ordersModal')?.classList.remove('active');
    document.body.style.overflow = '';
  }
  qs('#closeOrdersModal')?.addEventListener('click', _closeOrdersModal);
  qs('#ordersOverlay')?.addEventListener('click', _closeOrdersModal);

  /* ─── MINHA CONTA ─── */
  qs('#viewAccount')?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleDropdown(false);
    _openAccountModal();
  });

  function _openAccountModal() {
    const sess = JSON.parse(sessionStorage.getItem('beboss_session') || '{}');
    if (!sess.email) { openLoginModal(); return; }

    const allOrders  = JSON.parse(localStorage.getItem('beboss_orders') || '[]');
    const userOrders = allOrders.filter(o => o.customer?.email === sess.email || o.customer?.cpf === sess.cpf);
    const totalGasto = userOrders.reduce((s, o) => s + (o.total || 0), 0);

    const content = qs('#accountModalContent');
    if (!content) return;

    content.innerHTML = `
      <div class="account-info-grid">
        <div class="aig-item"><span class="aig-label">Nome</span><span class="aig-val">${sess.name || '—'}</span></div>
        <div class="aig-item"><span class="aig-label">Email</span><span class="aig-val">${sess.email || '—'}</span></div>
        <div class="aig-item"><span class="aig-label">CPF</span><span class="aig-val">${sess.cpf || '—'}</span></div>
        <div class="aig-item"><span class="aig-label">Telefone</span><span class="aig-val">${sess.telefone || '—'}</span></div>
        <div class="aig-item"><span class="aig-label">CEP</span><span class="aig-val">${sess.cep || '—'}</span></div>
        <div class="aig-item"><span class="aig-label">Endereço</span><span class="aig-val">${sess.endereco || '—'}</span></div>
      </div>
      <div class="account-stats">
        <div class="ast-card">
          <div class="ast-num">${userOrders.length}</div>
          <div class="ast-lbl">Pedido${userOrders.length !== 1 ? 's' : ''}</div>
        </div>
        <div class="ast-card">
          <div class="ast-num" style="font-size:1.1rem">${formatBRL(totalGasto)}</div>
          <div class="ast-lbl">Gasto total</div>
        </div>
        <div class="ast-card">
          <div class="ast-num">${userOrders.filter(o => o.status === 'entregue').length}</div>
          <div class="ast-lbl">Entregues</div>
        </div>
      </div>
      <div style="text-align:center;margin-top:20px">
        <button class="btn-ghost btn-sm" onclick="
          sessionStorage.removeItem('beboss_session');
          _closeAccountModal();
          updateUserDisplay();
          showToast('Você saiu da conta.');
        "><i class="fas fa-sign-out-alt"></i> Sair da Conta</button>
      </div>`;

    qs('#accountOverlay')?.classList.add('active');
    qs('#accountModal')?.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function _closeAccountModal() {
    qs('#accountOverlay')?.classList.remove('active');
    qs('#accountModal')?.classList.remove('active');
    document.body.style.overflow = '';
  }
  qs('#closeAccountModal')?.addEventListener('click', _closeAccountModal);
  qs('#accountOverlay')?.addEventListener('click', _closeAccountModal);
  window._closeAccountModal = _closeAccountModal;

  qs('#closeLogin')?.addEventListener('click', closeLoginModal);
  loginOverlay?.addEventListener('click', closeLoginModal);

  // Login form (Entrar com email + CPF)
  qs('#loginForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = qs('#loginEmail')?.value?.trim().toLowerCase();
    const cpf   = qs('#loginCpf')?.value?.trim();
    const errEl = qs('#loginError');
    const users = JSON.parse(localStorage.getItem('beboss_users') || '[]');
    const found = users.find(u => u.email?.toLowerCase() === email && u.cpf?.replace(/\D/g,'') === cpf?.replace(/\D/g,''));
    if (!found) {
      if (errEl) errEl.style.display = 'block';
      return;
    }
    if (errEl) errEl.style.display = 'none';
    sessionStorage.setItem('beboss_session', JSON.stringify(found));
    closeLoginModal();
    updateUserDisplay();
    showToast(`✦ Bem-vindo(a) de volta, ${found.name.split(' ')[0]}!`);
  });

  // CPF mask no login
  qs('#loginCpf')?.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g,'');
    v = v.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2');
    e.target.value = v;
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.user-profile-container') && userDropdown?.classList.contains('active')) {
      toggleDropdown(false);
    }
  });

  /* CPF mask */
  qs('#cpf')?.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '');
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    e.target.value = v;
  });
  /* Phone mask */
  qs('#telefone')?.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '');
    v = v.replace(/^(\d{2})(\d)/, '($1) $2');
    v = v.replace(/(\d{5})(\d)/, '$1-$2');
    e.target.value = v;
  });
  /* CEP signup mask */
  qs('#cepSignup')?.addEventListener('input', function () {
    let v = this.value.replace(/\D/g, '');
    if (v.length > 5) v = v.replace(/(\d{5})(\d)/, '$1-$2');
    this.value = v;
  });

  signupForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = qs('#signupEmail')?.value?.trim();
    const name  = qs('#fullName')?.value?.trim();
    const cpf   = qs('#cpf')?.value?.trim();
    const cep   = qs('#cepSignup')?.value?.trim();

    if (!name)                 { showToast('Informe seu nome completo.');     return; }
    if (!validarEmail(email))  { showToast('Email inválido. Verifique.');     return; }
    if (!validarCPF(cpf))      { showToast('CPF inválido. Verifique os dígitos.'); return; }
    if (cep && cep.replace(/\D/g,'').length === 8) {
      const cepOk = await validarCEP(cep);
      if (!cepOk) { showToast('CEP não encontrado. Verifique.'); return; }
    }
    // Checar duplicidade de email
    const existingUsers = JSON.parse(localStorage.getItem('beboss_users') || '[]');
    if (existingUsers.some(u => u.email?.toLowerCase() === email.toLowerCase())) {
      showToast('Este email já está cadastrado. Faça login.'); return;
    }

    const user = {
      id:       cpf.replace(/\D/g,''),
      email, name, cpf,
      telefone: qs('#telefone')?.value || '',
      cep:      qs('#cepSignup')?.value || '',
      endereco: qs('#enderecoSignup')?.value || '',
      createdAt: new Date().toISOString()
    };
    // Salva no array global de clientes (admin pode ver)
    const users = JSON.parse(localStorage.getItem('beboss_users') || '[]');
    const idx = users.findIndex(u => u.email === email || u.cpf === cpf);
    if (idx >= 0) users[idx] = user; else users.push(user);
    localStorage.setItem('beboss_users', JSON.stringify(users));
    localStorage.setItem('beboss_user', JSON.stringify(user));
    sessionStorage.setItem('beboss_session', JSON.stringify(user));
    closeLoginModal();
    updateUserDisplay();
    showToast(`✦ Bem-vindo(a), ${name.split(' ')[0]}!`);
    // Envia email de boas-vindas (silencioso se EmailJS não configurado)
    sendWelcomeEmail(user);
  });

  /* =====================================================
     FRETE SIMULADO
  ===================================================== */
  let _shippingCost = 0;

  const SHIP = {
    MG:{ price:9.90,  days:'1-2 dias úteis' },
    SP:{ price:14.90, days:'2-3 dias úteis' }, RJ:{ price:14.90, days:'2-3 dias úteis' }, ES:{ price:14.90, days:'2-3 dias úteis' },
    PR:{ price:17.90, days:'3-4 dias úteis' }, SC:{ price:17.90, days:'3-4 dias úteis' }, RS:{ price:17.90, days:'3-4 dias úteis' },
    GO:{ price:19.90, days:'4-5 dias úteis' }, DF:{ price:19.90, days:'4-5 dias úteis' }, MT:{ price:19.90, days:'4-5 dias úteis' }, MS:{ price:19.90, days:'4-5 dias úteis' },
  };
  const SHIP_DEFAULT = { price:24.90, days:'5-7 dias úteis' };

  function _calcShipping(uf) {
    const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const free     = subtotal >= 500;
    const rate     = free ? { price:0, days:'1-3 dias úteis' } : (SHIP[uf] || SHIP_DEFAULT);
    _shippingCost  = rate.price;

    const el = qs('#shippingEstimate');
    if (!el) return;
    el.style.display = 'flex';
    el.innerHTML = free
      ? `<i class="fas fa-truck"></i><span><strong style="color:var(--gold)">Frete Grátis!</strong> Pedido acima de R$500</span><span class="ship-days">${rate.days}</span>`
      : `<i class="fas fa-truck"></i><span>Frete estimado: <strong>${formatBRL(rate.price)}</strong></span><span class="ship-days">${rate.days}</span>`;
  }

  /* =====================================================
     CEP AUTO-FILL (ViaCEP)
  ===================================================== */
  async function fetchCEP(cep, fields) {
    const clean = cep.replace(/\D/g, '');
    if (clean.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (data.erro) return;
      if (fields.rua    && data.logradouro) qs(fields.rua).value    = data.logradouro;
      if (fields.bairro && data.bairro)     qs(fields.bairro).value = data.bairro;
      if (fields.cidade && data.localidade) qs(fields.cidade).value = data.localidade;
      // Calcula frete quando é o form de endereço do checkout
      if (fields.rua === '#end_rua' && data.uf) _calcShipping(data.uf);
    } catch {}
  }

  qs('#end_cep')?.addEventListener('blur', function () {
    fetchCEP(this.value, { rua: '#end_rua', bairro: '#end_bairro', cidade: '#end_cidade' });
  });
  qs('#end_cep')?.addEventListener('input', function () {
    let v = this.value.replace(/\D/g, '');
    if (v.length > 5) v = v.replace(/(\d{5})(\d)/, '$1-$2');
    this.value = v;
  });

  /* =====================================================
     CHECKOUT FLOW
  ===================================================== */
  const checkoutButton = qs('#checkoutButton');
  const enderecoPopup = qs('#enderecoPopup');
  const enderecoOverlay = qs('#enderecoPopupOverlay');

  function openEnderecoPopup() {
    _shippingCost = 0;
    const shipEl = qs('#shippingEstimate');
    if (shipEl) shipEl.style.display = 'none';
    // Pré-preenche com dados do usuário logado na sessão
    try {
      const sess = JSON.parse(sessionStorage.getItem('beboss_session') || '{}');
      if (sess.name && qs('#end_nome'))   qs('#end_nome').value   = sess.name;
      if (sess.cep  && qs('#end_cep'))    qs('#end_cep').value    = sess.cep;
      if (sess.cep) fetchCEP(sess.cep, { rua:'#end_rua', bairro:'#end_bairro', cidade:'#end_cidade' });
    } catch {}
    enderecoPopup?.classList.add('active');
    enderecoOverlay?.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  function closeEnderecoPopupFn() {
    enderecoPopup?.classList.remove('active');
    enderecoOverlay?.classList.remove('active');
    document.body.style.overflow = '';
  }

  checkoutButton?.addEventListener('click', () => {
    if (!cart.length) { showToast('Carrinho vazio!'); return; }
    if (!sessionStorage.getItem('beboss_session')) {
      closeCartPanel();
      showToast('Faça login para finalizar a compra.');
      setTimeout(openLoginModal, 350);
      return;
    }
    closeCartPanel();
    setTimeout(openEnderecoPopup, 300);
  });
  qs('#closeEnderecoPopup')?.addEventListener('click', closeEnderecoPopupFn);
  enderecoOverlay?.addEventListener('click', closeEnderecoPopupFn);

  qs('#enderecoForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome   = qs('#end_nome')?.value?.trim();
    const cep    = qs('#end_cep')?.value?.trim();
    const rua    = qs('#end_rua')?.value?.trim();
    const numero = qs('#end_numero')?.value?.trim();
    const bairro = qs('#end_bairro')?.value?.trim();
    const cidade = qs('#end_cidade')?.value?.trim();

    if (!nome)   { showToast('Informe seu nome.'); return; }
    if (!numero) { showToast('Informe o número.'); return; }
    if (!rua || !bairro || !cidade) { showToast('Preencha o endereço completo.'); return; }

    // Valida CEP via ViaCEP
    if (cep.replace(/\D/g,'').length === 8) {
      const ok = await validarCEP(cep);
      if (!ok) { showToast('CEP não encontrado. Verifique.'); return; }
    } else { showToast('CEP inválido.'); return; }

    const addr = {
      nome, cep, rua, numero, bairro, cidade,
      referencia: qs('#end_referencia')?.value || ''
    };
    const payment = document.querySelector('input[name="payment"]:checked')?.value || 'pix';
    closeEnderecoPopupFn();

    if (payment === 'pix') {
      setTimeout(() => openPixPopup(addr), 300);
    } else if (payment === 'boleto') {
      setTimeout(() => openBoletoPopup(addr), 300);
    } else if (payment === 'credito') {
      setTimeout(() => openCartaoPopup(addr), 300);
    }
  });

  /* =====================================================
     PIX POPUP
  ===================================================== */
  const pixPopup = qs('#pixPopup');
  const pixOverlay = qs('#pixPopupOverlay');
  const pixQrCodeEl = qs('#pixQrCode');
  const pixCodigoEl = qs('#pixCodigo');

  function getPixKey() {
    try { return JSON.parse(localStorage.getItem('beboss_settings') || '{}').pixKey || '+5534992462935'; }
    catch { return '+5534992462935'; }
  }
  function getPixName() {
    try { return JSON.parse(localStorage.getItem('beboss_settings') || '{}').pixName || 'BE BOSS 18K'; }
    catch { return 'BE BOSS 18K'; }
  }
  function getPixCity() {
    try { return JSON.parse(localStorage.getItem('beboss_settings') || '{}').pixCity || 'UBERLANDIA'; }
    catch { return 'UBERLANDIA'; }
  }

  function buildPixPayload(amount, name, city) {
    const amt = amount.toFixed(2);
    const txId = 'BEBOSS' + Date.now().toString().slice(-8);
    function f(id, val) {
      const len = String(val.length).padStart(2, '0');
      return `${id}${len}${val}`;
    }
    const merchant = f('00', 'BR.GOV.BCB.PIX') + f('01', getPixKey());
    const payload = [
      f('00', '01'),
      f('26', merchant),
      f('52', '0000'),
      f('53', '986'),
      f('54', amt),
      f('58', 'BR'),
      f('59', name.substring(0, 25).toUpperCase()),
      f('60', city.substring(0, 15).toUpperCase()),
      f('62', f('05', txId)),
      '6304'
    ].join('');

    // Simple CRC16 CCITT
    let crc = 0xFFFF;
    for (const c of payload) {
      crc ^= c.charCodeAt(0) << 8;
      for (let i = 0; i < 8; i++) {
        crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : (crc << 1);
        crc &= 0xFFFF;
      }
    }
    return payload + crc.toString(16).toUpperCase().padStart(4, '0');
  }

  function openPixPopup(addr) {
    _lastCart = [...cart];  // snapshot antes de limpar
    const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0) + _shippingCost;
    const pixCode = buildPixPayload(subtotal, addr.nome || getPixName(), addr.cidade || getPixCity());

    if (pixCodigoEl) pixCodigoEl.value = pixCode;
    if (pixQrCodeEl) {
      // Usa API externa — mais confiável que QRCode.js local
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&ecc=M&data=${encodeURIComponent(pixCode)}`;
      pixQrCodeEl.innerHTML = `<img src="${qrUrl}" alt="QR Code PIX" width="200" height="200" style="display:block;border-radius:8px;"/>`;
    }

    pixPopup?.classList.add('active');
    pixOverlay?.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Registra o pedido
    const _pcode = saveOrder(addr, 'pix', subtotal);
    const pcEl = qs('#pixPurchaseCode');
    if (pcEl && _pcode) pcEl.innerHTML = `<span>Código de compra:</span> <strong>${_pcode}</strong>`;

    // Guarda para mostrar na confirmação
    window._pendingConfirm = { code: _pcode, addr, label: 'PIX', total: subtotal };

    // Bind WhatsApp send
    const waBtn = qs('#finalizarWhatsapp');
    if (waBtn) {
      waBtn.onclick = () => { openWhatsAppOrder(addr, 'pix'); closePixPopup(); };
    }

    // Total display
    const totEl = qs('#pixTotal');
    if (totEl) totEl.textContent = formatBRL(subtotal);
  }

  function closePixPopup() {
    pixPopup?.classList.remove('active');
    pixOverlay?.classList.remove('active');
    document.body.style.overflow = '';
    cart = [];
    saveCart();
    updateCartUI();
  }
  qs('#fecharPix')?.addEventListener('click', () => { closePixPopup(); showToast('✦ Pedido registrado!'); });
  pixOverlay?.addEventListener('click', closePixPopup);

  qs('#copiarPix')?.addEventListener('click', () => {
    const code = pixCodigoEl?.value;
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => showToast('✦ Código PIX copiado!')).catch(() => showToast('Erro ao copiar. Copie manualmente.'));
  });

  /* =====================================================
     BOLETO POPUP
  ===================================================== */
  const boletoPopup   = qs('#boletoPopup');
  const boletoOverlay = qs('#boletoPopupOverlay');

  function generateLinhaDigitavel(amount) {
    // Gera um código de boleto realista no padrão FEBRABAN (aparência)
    const rnd = (n) => Math.floor(Math.random() * Math.pow(10, n)).toString().padStart(n, '0');
    const bank = '001'; // Banco do Brasil
    const currency = '9';
    const field1 = `${bank}${currency}${rnd(5)}.${rnd(5)}${rnd(1)}`;
    const field2 = `${rnd(5)}${rnd(5)}.${rnd(6)}${rnd(1)}`;
    const field3 = `${rnd(5)}${rnd(5)}.${rnd(6)}${rnd(1)}`;
    const checkDigit = rnd(1);
    const base = new Date('1997-10-07');
    const today = new Date();
    const dueFactor = Math.floor((today - base) / 86400000) + 3;
    const amtStr = amount.toFixed(2).replace('.', '').padStart(10, '0');
    const field5 = `${dueFactor.toString().padStart(4,'0')}${amtStr}`;
    return `${field1} ${field2} ${field3} ${checkDigit} ${field5}`;
  }

  function openBoletoPopup(addr) {
    _lastCart = [...cart];
    const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0) + _shippingCost;
    const linhaDigitavel = generateLinhaDigitavel(subtotal);
    const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 3);
    const dueFmt = dueDate.toLocaleDateString('pt-BR');

    const totalEl = qs('#boletoTotal');
    if (totalEl) totalEl.textContent = formatBRL(subtotal);

    const codeEl = qs('#boletoCodigo');
    if (codeEl) codeEl.value = linhaDigitavel;

    const barNum = qs('#boletoBarNum');
    if (barNum) barNum.textContent = linhaDigitavel.replace(/\s/g, '  ');

    const headerP = boletoPopup?.querySelector('.boleto-header p');
    if (headerP) headerP.innerHTML = `Vencimento: <strong>${dueFmt}</strong>`;

    boletoPopup?.classList.add('active');
    boletoOverlay?.classList.add('active');
    document.body.style.overflow = 'hidden';

    const waBtn = qs('#finalizarBoletoWa');
    if (waBtn) waBtn.onclick = () => { openWhatsAppOrder(addr, 'boleto'); closeBoletoPopup(); };

    const _bcode = saveOrder(addr, 'boleto', subtotal);
    const bpcEl = qs('#boletoPurchaseCode');
    if (bpcEl && _bcode) bpcEl.innerHTML = `<span>Código de compra:</span> <strong>${_bcode}</strong>`;
  }

  function closeBoletoPopup() {
    boletoPopup?.classList.remove('active');
    boletoOverlay?.classList.remove('active');
    document.body.style.overflow = '';
    cart = [];
    saveCart();
    updateCartUI();
  }

  qs('#fecharBoleto')?.addEventListener('click', () => { closeBoletoPopup(); });
  boletoOverlay?.addEventListener('click', closeBoletoPopup);

  qs('#copiarBoleto')?.addEventListener('click', () => {
    const code = qs('#boletoCodigo')?.value;
    if (!code) return;
    navigator.clipboard.writeText(code)
      .then(() => showToast('✦ Código do boleto copiado!'))
      .catch(() => showToast('Copie o código manualmente.'));
  });

  /* =====================================================
     CARTÃO DE CRÉDITO POPUP
  ===================================================== */
  const cartaoPopup   = qs('#cartaoPopup');
  const cartaoOverlay = qs('#cartaoPopupOverlay');
  const cardVisual    = qs('#cardVisual');

  function getCardBrand(num) {
    const n = num.replace(/\s/g, '');
    if (/^4/.test(n))           return '<img src="https://upload.wikimedia.org/wikipedia/commons/0/04/Visa.svg" alt="Visa">';
    if (/^5[1-5]/.test(n))     return '<img src="https://brand.mastercard.com/content/dam/mccom/brandcenter/thumbnails/mastercard_circles_92px_2x.png" alt="MC" style="height:22px">';
    if (/^3[47]/.test(n))      return '<span style="font-size:0.7rem;letter-spacing:0.05em;color:var(--gold)">AMEX</span>';
    if (/^6(?:011|5)/.test(n)) return '<span style="font-size:0.65rem;letter-spacing:0.05em;color:var(--gold)">ELO</span>';
    return '<i class="fas fa-credit-card"></i>';
  }

  function openCartaoPopup(addr) {
    _lastCart = [...cart];
    const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0) + _shippingCost;

    // Reset form
    const form = qs('#cartaoForm');
    if (form) form.innerHTML = form.innerHTML; // reset
    if (qs('#cartaoTotal')) qs('#cartaoTotal').textContent = formatBRL(subtotal);
    if (qs('#cvNumber'))  qs('#cvNumber').textContent  = '•••• •••• •••• ••••';
    if (qs('#cvName'))    qs('#cvName').textContent    = 'SEU NOME';
    if (qs('#cvExpiry'))  qs('#cvExpiry').textContent  = 'MM/AA';
    if (qs('#cvCvv'))     qs('#cvCvv').textContent     = '•••';
    if (qs('#cvBrand'))   qs('#cvBrand').innerHTML     = '<i class="fas fa-credit-card"></i>';
    if (cardVisual)       cardVisual.classList.remove('flipped');

    // Populate installments
    const sel = qs('#cc_parcelas');
    if (sel) {
      sel.innerHTML = Array.from({length: 12}, (_, i) => {
        const n = i + 1;
        const juros = n <= 3 ? 0 : (n <= 6 ? 0.0199 : (n <= 9 ? 0.0249 : 0.0299));
        const total = subtotal * Math.pow(1 + juros, n);
        const parcela = total / n;
        const label = n === 1
          ? `1x de ${formatBRL(subtotal)} (sem juros)`
          : n <= 3
            ? `${n}x de ${formatBRL(parcela)} (sem juros)`
            : `${n}x de ${formatBRL(parcela)} (c/ juros)`;
        return `<option value="${n}">${label}</option>`;
      }).join('');
    }

    cartaoPopup?.classList.add('active');
    cartaoOverlay?.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Bind card field interactions
    setTimeout(() => bindCardFields(addr, subtotal), 50);
  }

  function bindCardFields(addr, subtotal) {
    const numInput    = qs('#cc_number');
    const nameInput   = qs('#cc_name');
    const expiryInput = qs('#cc_expiry');
    const cvvInput    = qs('#cc_cvv');

    if (numInput) {
      numInput.value = '';
      numInput.oninput = () => {
        let v = numInput.value.replace(/\D/g, '').slice(0, 16);
        numInput.value = v.replace(/(\d{4})/g, '$1 ').trim();
        const display = v.padEnd(16, '•').replace(/(.{4})/g, '$1 ').trim();
        if (qs('#cvNumber')) qs('#cvNumber').textContent = display;
        if (qs('#cvBrand')) qs('#cvBrand').innerHTML = getCardBrand(v);
      };
    }
    if (nameInput) {
      nameInput.value = '';
      nameInput.oninput = () => {
        const v = nameInput.value.toUpperCase().slice(0, 26);
        nameInput.value = v;
        if (qs('#cvName')) qs('#cvName').textContent = v || 'SEU NOME';
      };
    }
    if (expiryInput) {
      expiryInput.value = '';
      expiryInput.oninput = () => {
        let v = expiryInput.value.replace(/\D/g, '').slice(0, 4);
        if (v.length >= 3) v = v.slice(0,2) + '/' + v.slice(2);
        expiryInput.value = v;
        if (qs('#cvExpiry')) qs('#cvExpiry').textContent = v || 'MM/AA';
      };
    }
    if (cvvInput) {
      cvvInput.value = '';
      cvvInput.onfocus = () => cardVisual?.classList.add('flipped');
      cvvInput.onblur  = () => cardVisual?.classList.remove('flipped');
      cvvInput.oninput = () => {
        const v = cvvInput.value.replace(/\D/g, '');
        cvvInput.value = v;
        if (qs('#cvCvv')) qs('#cvCvv').textContent = v.padEnd(v.length || 3, '•').slice(0,4) || '•••';
      };
    }

    const form = qs('#cartaoForm');
    if (form) {
      form.onsubmit = (e) => {
        e.preventDefault();
        const num  = (numInput?.value || '').replace(/\s/g,'');
        const name = nameInput?.value?.trim();
        const exp  = expiryInput?.value?.trim();
        const cvv  = cvvInput?.value?.trim();
        if (!num || num.length < 13) { showToast('Número do cartão inválido.'); return; }
        if (!name || name.length < 3) { showToast('Informe o nome do titular.'); return; }
        if (!exp || !/^\d{2}\/\d{2}$/.test(exp)) { showToast('Validade inválida (MM/AA).'); return; }
        if (!cvv || cvv.length < 3) { showToast('CVV inválido.'); return; }

        const parcelas = parseInt(qs('#cc_parcelas')?.value || '1');
        const label = qs('#cc_parcelas')?.selectedOptions[0]?.text || '';

        // Show success screen
        form.innerHTML = `
          <div class="cc-success">
            <div class="cc-success-icon"><i class="fas fa-check-circle"></i></div>
            <h3>Pagamento Aprovado!</h3>
            <p>Pedido confirmado em <strong>${parcelas}x</strong>.<br>
            Você receberá a confirmação pelo WhatsApp.</p>
            <div class="purchase-code-box cc-purchase-code"></div>
            <button class="btn-primary btn-full" style="margin-top:10px" onclick="openWhatsAppOrder(window._ccAddr,'credito');closeCartaoPopup();">
              <i class="fab fa-whatsapp"></i> Ver Pedido no WhatsApp
            </button>
          </div>`;

        window._ccAddr = addr;
        const _ccode = saveOrder(addr, 'credito', subtotal);
        if (_ccode) {
          const cpEl = form.querySelector('.cc-purchase-code');
          if (cpEl) cpEl.innerHTML = `<span>Código de compra:</span> <strong>${_ccode}</strong>`;
        }
        cart = []; saveCart(); updateCartUI();
      };
    }
  }

  function closeCartaoPopup() {
    cartaoPopup?.classList.remove('active');
    cartaoOverlay?.classList.remove('active');
    document.body.style.overflow = '';
  }
  window.closeCartaoPopup    = closeCartaoPopup;
  window.openWhatsAppOrder   = openWhatsAppOrder;
  window.updateUserDisplay   = updateUserDisplay;
  window.showToast           = showToast;

  qs('#fecharCartao')?.addEventListener('click', closeCartaoPopup);
  cartaoOverlay?.addEventListener('click', closeCartaoPopup);

  /* =====================================================
     CONFIRMAÇÃO DE PEDIDO
  ===================================================== */
  let _lastCart = [];   // snapshot do carrinho antes de limpar

  function showOrderConfirmation(purchaseCode, addr, paymentLabel, total) {
    const content = qs('#orderConfirmContent');
    if (!content) return;

    const items = _lastCart.map(i => `
      <li class="oc-item">
        <img src="${i.image}" alt="${i.name}" onerror="this.style.opacity=0.3"/>
        <span class="oc-name">${i.name} <span class="oc-qty">× ${i.qty}</span></span>
        <span class="oc-price">${formatBRL(i.price * i.qty)}</span>
      </li>`).join('');

    const ship = _shippingCost > 0 ? `
      <div class="oc-row"><span>Frete</span><span>${formatBRL(_shippingCost)}</span></div>` : `
      <div class="oc-row"><span>Frete</span><span style="color:var(--gold)">Grátis</span></div>`;

    content.innerHTML = `
      <div class="oc-success-icon"><i class="fas fa-check-circle"></i></div>
      <h2 class="oc-title">Pedido Confirmado!</h2>
      <p class="oc-sub">Obrigado, <strong>${addr.nome?.split(' ')[0] || 'Cliente'}</strong>! Seu pedido foi registrado.</p>
      <div class="oc-code-box">
        <span>Código do pedido</span>
        <strong>${purchaseCode}</strong>
      </div>
      <ul class="oc-items">${items}</ul>
      <div class="oc-totals">
        ${ship}
        <div class="oc-row oc-total-row"><span>Total</span><span>${formatBRL(total)}</span></div>
        <div class="oc-row"><span>Pagamento</span><span>${paymentLabel}</span></div>
      </div>
      <div class="oc-actions">
        <button class="btn-primary btn-full" onclick="
          document.getElementById('orderConfirmOverlay').classList.remove('active');
          document.getElementById('orderConfirmModal').classList.remove('active');
          document.body.style.overflow='';
          _openOrdersModal();
        "><i class="fas fa-box"></i> Ver Meus Pedidos</button>
        <button class="btn-ghost btn-full" onclick="
          document.getElementById('orderConfirmOverlay').classList.remove('active');
          document.getElementById('orderConfirmModal').classList.remove('active');
          document.body.style.overflow='';
        ">Continuar Comprando</button>
      </div>`;

    qs('#orderConfirmOverlay')?.classList.add('active');
    qs('#orderConfirmModal')?.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  /* =====================================================
     SAVE ORDER + PURCHASE CODE
  ===================================================== */
  function generatePurchaseCode() {
    const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return 'BOSS-' + Array.from({length:6}, () => c[Math.floor(Math.random()*c.length)]).join('');
  }

  function saveOrder(addr, paymentMethod, total) {
    try {
      const orders = JSON.parse(localStorage.getItem('beboss_orders') || '[]');
      const purchaseCode = generatePurchaseCode();

      // Vincula o pedido ao usuário logado (email + cpf) para rastreamento no admin
      let customer = { ...addr };
      try {
        const sess = JSON.parse(sessionStorage.getItem('beboss_session') || '{}');
        if (sess.email) customer.email  = sess.email;
        if (sess.cpf)   customer.cpf    = sess.cpf;
        if (sess.id)    customer.userId = sess.id;
        if (!customer.nome && sess.name) customer.nome = sess.name;
      } catch {}

      orders.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2,6),
        purchaseCode,
        customer,
        items: cart.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty, image: i.image })),
        total,
        paymentMethod,
        status: 'pendente',
        createdAt: new Date().toISOString()
      });
      localStorage.setItem('beboss_orders', JSON.stringify(orders));
      return purchaseCode;
    } catch { return null; }
  }

  /* =====================================================
     COMMENT / REVIEW SYSTEM
  ===================================================== */
  function _validatePurchaseCode(code, productId) {
    try {
      const orders = JSON.parse(localStorage.getItem('beboss_orders') || '[]');
      const order = orders.find(o => o.purchaseCode === code.toUpperCase().trim());
      if (!order) return { valid: false, msg: 'Código não encontrado.' };
      if (!order.items.some(i => String(i.id) === String(productId)))
        return { valid: false, msg: 'Este código não é válido para este produto.' };
      return { valid: true, order };
    } catch { return { valid: false, msg: 'Erro ao validar.' }; }
  }

  function _alreadyCommented(code, productId) {
    try {
      return JSON.parse(localStorage.getItem('beboss_comments') || '[]')
        .some(c => c.purchaseCode === code && String(c.productId) === String(productId));
    } catch { return false; }
  }

  function _saveComment(productId, code, orderId, customerName, rating, text) {
    try {
      const all = JSON.parse(localStorage.getItem('beboss_comments') || '[]');
      all.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2,4),
        productId: String(productId),
        purchaseCode: code,
        orderId,
        customerName: customerName || 'Cliente',
        rating: Number(rating),
        text: text.trim(),
        createdAt: new Date().toISOString()
      });
      localStorage.setItem('beboss_comments', JSON.stringify(all));
      return true;
    } catch { return false; }
  }

  function _commentCardHTML(c) {
    const filled = '★'.repeat(c.rating);
    const empty  = '☆'.repeat(5 - c.rating);
    return `
      <div class="review-card">
        <div class="review-stars">${filled}<span class="review-empty">${empty}</span></div>
        <p class="review-text">"${c.text}"</p>
        <div class="review-meta">${c.customerName} · ${new Date(c.createdAt).toLocaleDateString('pt-BR')}</div>
      </div>`;
  }

  function _renderCommentSection(productId) {
    const section = qs('#qvCommentSection');
    if (!section) return;

    const sessionCode = sessionStorage.getItem('beboss_pcode') || '';

    // Already commented this product in this session?
    if (sessionCode && _alreadyCommented(sessionCode, productId)) {
      const myC = JSON.parse(localStorage.getItem('beboss_comments') || '[]')
        .find(c => c.purchaseCode === sessionCode && String(c.productId) === String(productId));
      if (myC) { section.innerHTML = `<div class="review-my"><h5><i class="fas fa-star"></i> Sua Avaliação</h5>${_commentCardHTML(myC)}</div>`; return; }
    }

    section.innerHTML = `
      <div class="review-form-wrap">
        <h5 class="review-form-title"><i class="fas fa-medal"></i> Avalie sua compra</h5>
        <p class="review-form-sub">Informe o código que recebeu ao finalizar o pedido.</p>
        <div class="review-code-row">
          <input id="qvCodeInput" type="text" placeholder="BOSS-XXXXXX" maxlength="11" autocomplete="off"/>
          <button class="btn-primary btn-sm" id="qvValidateBtn">Validar</button>
        </div>
        <div id="qvCodeMsg" class="review-msg"></div>
        <div id="qvReviewForm" style="display:none">
          <div class="star-picker" id="starPicker" data-val="5">
            ${[1,2,3,4,5].map(n=>`<button type="button" class="sp-star${n<=5?' active':''}" data-v="${n}">★</button>`).join('')}
          </div>
          <textarea id="qvReviewText" placeholder="Conte sua experiência com o produto..." rows="3"></textarea>
          <button class="btn-primary btn-full" id="qvSubmitReview" style="margin-top:10px">
            <i class="fas fa-paper-plane"></i> Enviar Avaliação
          </button>
        </div>
      </div>`;

    // Format input
    const inp = qs('#qvCodeInput');
    inp.addEventListener('input', () => { inp.value = inp.value.toUpperCase().replace(/[^A-Z0-9-]/g,''); });

    // Validate button
    let validatedOrder = null;
    qs('#qvValidateBtn').addEventListener('click', () => {
      const code  = inp.value.trim().toUpperCase();
      const msgEl = qs('#qvCodeMsg');
      if (!code) { msgEl.textContent = 'Digite seu código.'; msgEl.className = 'review-msg error'; return; }
      if (_alreadyCommented(code, productId)) {
        msgEl.textContent = 'Você já avaliou este produto com este código.';
        msgEl.className = 'review-msg error'; return;
      }
      const r = _validatePurchaseCode(code, productId);
      if (!r.valid) { msgEl.textContent = r.msg; msgEl.className = 'review-msg error'; return; }
      validatedOrder = r.order;
      sessionStorage.setItem('beboss_pcode', code);
      msgEl.textContent = '✓ Código válido! Deixe sua avaliação abaixo.';
      msgEl.className = 'review-msg ok';
      qs('#qvReviewForm').style.display = 'block';
      inp.disabled = true;
      qs('#qvValidateBtn').disabled = true;
    });

    // Star picker
    const picker = qs('#starPicker');
    picker.addEventListener('click', e => {
      const s = e.target.closest('.sp-star');
      if (!s) return;
      const v = parseInt(s.dataset.v);
      picker.dataset.val = v;
      qsa('.sp-star', picker).forEach((el, i) => el.classList.toggle('active', i < v));
    });

    // Submit
    qs('#qvSubmitReview').addEventListener('click', () => {
      const code = inp.value.trim().toUpperCase();
      const text = qs('#qvReviewText').value.trim();
      const rating = parseInt(picker.dataset.val) || 5;
      const msgEl = qs('#qvCodeMsg');
      if (!text) { msgEl.textContent = 'Escreva um comentário antes de enviar.'; msgEl.className = 'review-msg error'; return; }
      if (!validatedOrder) return;
      const name = validatedOrder.customer?.nome || validatedOrder.customer?.name || 'Cliente';
      if (_saveComment(productId, code, validatedOrder.id, name, rating, text)) {
        const myC   = JSON.parse(localStorage.getItem('beboss_comments') || '[]').slice(-1)[0];
        const sess  = JSON.parse(sessionStorage.getItem('beboss_session') || '{}');
        const email = sess.email ? `<p class="review-email-note"><i class="fas fa-envelope"></i> Confirmação enviada para <strong>${sess.email}</strong></p>` : '';
        section.innerHTML = `<div class="review-my"><h5><i class="fas fa-star"></i> Avaliação enviada!</h5>${_commentCardHTML(myC)}${email}</div>`;
      }
    });
  }

  /* =====================================================
     WHATSAPP ORDER
  ===================================================== */
  function openWhatsAppOrder(addr, payment) {
    const source  = cart.length ? cart : _lastCart;
    const subtotal = source.reduce((s, i) => s + i.price * i.qty, 0) + _shippingCost;
    const items = source.map(i => `  • ${i.name} (x${i.qty}) — ${formatBRL(i.price * i.qty)}`).join('\n');
    const paymentLabel = { pix: 'PIX', credito: 'Cartão de Crédito', boleto: 'Boleto Bancário' }[payment] || payment;

    const msg = `*Novo Pedido — Be Boss 18k* ✦\n\n` +
      `*Produtos:*\n${items}\n\n` +
      `*Total:* ${formatBRL(subtotal)}\n` +
      `*Pagamento:* ${paymentLabel}\n\n` +
      `*Endereço de Entrega:*\n` +
      `  ${addr.nome}\n` +
      `  ${addr.rua}, ${addr.numero}\n` +
      `  ${addr.bairro} — ${addr.cidade}\n` +
      `  CEP: ${addr.cep}\n` +
      (addr.referencia ? `  Ref: ${addr.referencia}\n` : '');

    window.open(`https://wa.me/5534993049244?text=${encodeURIComponent(msg)}`, '_blank');
    cart = [];
    saveCart();
    updateCartUI();
    closeEnderecoPopupFn();
    closePixPopup();
    showToast('✦ Redirecionando para o WhatsApp…');
  }

  /* =====================================================
     COOKIE CONSENT
  ===================================================== */
  const banner = qs('#cookie-banner');
  if (!localStorage.getItem('beboss_cookies') && banner) {
    setTimeout(() => banner.classList.add('show'), 1200);
  }
  qs('#accept-cookies')?.addEventListener('click', () => {
    localStorage.setItem('beboss_cookies', 'yes');
    banner?.classList.remove('show');
  });
  qs('#decline-cookies')?.addEventListener('click', () => {
    banner?.classList.remove('show');
  });

  /* =====================================================
     EMAILJS — envio de emails automáticos
  ===================================================== */
  function _ejsCfg() {
    try {
      const s = JSON.parse(localStorage.getItem('beboss_settings') || '{}');
      return {
        key:        s.emailjsKey        || '',
        service:    s.emailjsService    || '',
        welcome:    s.emailjsWelcome    || '',
        newsletter: s.emailjsNewsletter || '',
      };
    } catch { return {}; }
  }

  async function _sendEmail(templateId, params) {
    const cfg = _ejsCfg();
    if (!cfg.key || !cfg.service || !templateId) return false;
    try {
      if (typeof emailjs === 'undefined') return false;
      emailjs.init({ publicKey: cfg.key });
      await emailjs.send(cfg.service, templateId, params);
      return true;
    } catch (err) {
      console.warn('EmailJS error:', err);
      return false;
    }
  }

  async function sendWelcomeEmail(user) {
    return _sendEmail(_ejsCfg().welcome, {
      to_email: user.email,
      nome:     user.name.split(' ')[0],
      email:    user.email,
    });
  }

  async function sendNewsletterEmail(email) {
    return _sendEmail(_ejsCfg().newsletter, { to_email: email });
  }

  /* =====================================================
     NEWSLETTER
  ===================================================== */
  qs('#newsletterBtn')?.addEventListener('click', async () => {
    const emailEl = qs('#newsletterEmail');
    const email   = emailEl?.value?.trim();
    if (!validarEmail(email)) { showToast('Insira um email válido.'); return; }

    showToast('⏳ Inscrevendo...');
    const ok = await sendNewsletterEmail(email);
    if (emailEl) emailEl.value = '';

    showToast(ok
      ? '✦ Inscrição confirmada! Verifique seu email.'
      : '✦ Inscrição registrada! Obrigado.');
  });

  /* =====================================================
     INTERSECTION OBSERVER — ANIMATE CARDS
  ===================================================== */
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.animationPlayState = 'running';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  function observeCards() {
    qsa('.product-card').forEach(card => {
      card.style.animationPlayState = 'paused';
      observer.observe(card);
    });
  }

  /* =====================================================
     SCROLL REVEAL
  ===================================================== */
  let _revealObs = null;
  function initScrollReveal() {
    _revealObs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          _revealObs.unobserve(e.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -32px 0px' });

    document.querySelectorAll('.reveal').forEach(el => _revealObs.observe(el));
  }

  function observeNewReveal() {
    if (!_revealObs) return;
    document.querySelectorAll('.product-card.reveal:not(.visible)').forEach(el => _revealObs.observe(el));
  }

  /* =====================================================
     INIT
  ===================================================== */
  // Update hero/title based on current view
  const _title = qs('#colecaoTitle');
  const _sub   = qs('#colecaoSub');
  if (currentCategory) {
    // Category filter page
    if (_title) _title.textContent = `${currentCategory} — Be Boss 18k`;
    if (_sub)   _sub.textContent   = `Coleção exclusiva de ${currentCategory.toLowerCase()} em ouro 18k`;
    ['#heroSection', '.stats-strip', '.category-section'].forEach(sel => {
      const el = qs(sel); if (el) el.style.display = 'none';
    });
  } else if (!isHomepage) {
    // ?view=all — full catalog
    if (_title) _title.textContent = 'Coleção Completa';
    if (_sub)   _sub.textContent   = 'Todas as peças exclusivas em ouro 18k';
    ['#heroSection', '.stats-strip', '.category-section'].forEach(sel => {
      const el = qs(sel); if (el) el.style.display = 'none';
    });
  } else {
    // Homepage — mostra produtos da vitrine se configurada, senão esconde
    const mainContent = qs('#mainContent');
    if (mainContent) {
      const hasFeatured = (() => {
        try { const v = localStorage.getItem('beboss_featured'); return v && JSON.parse(v).length > 0; } catch { return false; }
      })();
      mainContent.style.display = hasFeatured ? '' : 'none';
      if (hasFeatured && _title) _title.textContent = 'Destaques da Loja';
      if (hasFeatured && _sub)   _sub.textContent   = 'Peças selecionadas especialmente para você';
    }
  }

  /* ─── DEPOIMENTOS DINÂMICOS ─── */
  function _updateTestimonials() {
    const grid = qs('.testimonials-grid');
    if (!grid) return;

    const comments = JSON.parse(localStorage.getItem('beboss_comments') || '[]');
    // Só substitui se houver pelo menos 2 avaliações com nota ≥ 4 e texto ≥ 40 chars
    const good = comments
      .filter(c => c.rating >= 4 && (c.text || '').length >= 40)
      .sort((a, b) => b.rating - a.rating || new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 3);

    if (good.length < 2) return;   // Mantém os estáticos se não tiver avaliações suficientes

    const STARS = n => '★'.repeat(n) + '<span style="color:var(--border)">★</span>'.repeat(5 - n);
    const cards = good.map((c, i) => {
      const isFeatured = i === 1 && good.length >= 3;
      const delay      = i === 0 ? '' : ` reveal-d${i}`;
      const first      = (c.customerName || 'Cliente').split(' ')[0];
      const init       = first[0].toUpperCase() + (c.customerName.split(' ')[1]?.[0] || '').toUpperCase();
      const prod       = products.find(p => String(p.id) === String(c.productId));
      const city       = prod ? prod.category : 'Cliente Be Boss';
      return `
        <div class="testimonial-card${isFeatured ? ' featured' : ''} reveal${delay}">
          <div class="stars">${STARS(c.rating)}</div>
          <p>"${c.text}"</p>
          <div class="testimonial-author">
            <div class="author-avatar">${init || '?'}</div>
            <div><strong>${c.customerName}</strong><br><span>${city}</span></div>
          </div>
        </div>`;
    }).join('');

    grid.innerHTML = cards;
  }

  renderProducts('', currentCategory);
  updateCartUI();
  updateUserDisplay();
  _updateTestimonials();
  initScrollReveal();   // Mantém animação de testimonials / história / features (SEM product cards)

  // Keyboard: close modals on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeCartPanel();
    closeQuickView();
    closeEnderecoPopupFn();
    closeLoginModal();
    closePixPopup();
    _closeOrdersModal();
    _closeAccountModal();
    closeInfoModal();
    toggleDropdown(false);
    closeMobileNav();
  });

})();