/* =====================================================
   BE BOSS 18k — ADMIN PANEL
   Storage: localStorage  |  Clean rewrite
===================================================== */

/* --- KEYS --- */
const KEY_ADMIN    = 'beboss_admin';
const KEY_PRODUCTS = 'beboss_products';
const KEY_ORDERS   = 'beboss_orders';
const KEY_SELLERS  = 'beboss_sellers';
const KEY_SETTINGS = 'beboss_settings';
const KEY_SESS     = 'beboss_admin_session';
const KEY_FEATURED = 'beboss_featured';

/* --- HELPERS --- */
const $ = id => document.getElementById(id);

function load(key, fallback = null) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

function fmt(n) {
  return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function toast(msg) {
  const t = $('adminToast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

/* --- CONFIRM DIALOG --- */
let _confirmResolve = null;
function confirm(title, msg) {
  $('confirmTitle').textContent = title;
  $('confirmMsg').textContent   = msg;
  $('confirmModal').classList.add('open');
  return new Promise(res => { _confirmResolve = res; });
}
$('confirmOkBtn').onclick     = () => { $('confirmModal').classList.remove('open'); _confirmResolve?.(true); };
$('confirmCancelBtn').onclick = () => { $('confirmModal').classList.remove('open'); _confirmResolve?.(false); };

/* --- AUTH --- */
function getAdminPass() { return load(KEY_ADMIN, 'beboss2025'); }
function checkSession() { return localStorage.getItem(KEY_SESS) === 'ok'; }

function doLogin() {
  const inp  = $('adminPasswordInput');
  const pass = inp.value.trim();
  const err  = $('loginError');
  if (pass === getAdminPass()) {
    localStorage.setItem(KEY_SESS, 'ok');
    $('loginScreen').style.display = 'none';
    $('app').style.display         = 'flex';
    refreshAll();
  } else {
    err.classList.add('show');
    inp.value = '';
    inp.focus();
    setTimeout(() => err.classList.remove('show'), 3000);
  }
}

$('loginSubmitBtn').onclick = doLogin;
$('adminPasswordInput').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

$('logoutBtn').onclick = () => { localStorage.removeItem(KEY_SESS); location.reload(); };

/* --- NAVIGATION --- */
const PAGES = {
  dashboard: 'Dashboard',
  products:  'Produtos',
  vitrine:   'Vitrine da Loja',
  orders:    'Pedidos',
  sellers:   'Vendedores',
  customers: 'Clientes',
  reviews:   'Avaliações',
  settings:  'Configurações',
};

function navigateTo(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pg  = $('page-' + pageId);
  const nav = document.querySelector(`.nav-item[data-page="${pageId}"]`);
  if (pg)  pg.classList.add('active');
  if (nav) nav.classList.add('active');
  $('topbarTitle').textContent = PAGES[pageId] || 'Admin';
  refreshPage(pageId);
}

document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
  btn.addEventListener('click', () => navigateTo(btn.dataset.page));
});

function refreshPage(pageId) {
  const map = {
    dashboard: renderDashboard,
    products:  renderProducts,
    vitrine:   renderVitrine,
    orders:    () => renderOrders('all'),
    sellers:   renderSellers,
    customers: renderCustomers,
    reviews:   renderReviews,
    settings:  loadSettings,
  };
  map[pageId]?.();
}

function refreshAll() {
  renderDashboard();
  renderProducts();
  renderSellers();
  renderOrders('all');
  loadSettings();
}

/* --- SEED PRODUCTS (carrega de products-data.js — sem duplicar os dados aqui) --- */
function seedProducts() {
  if (load(KEY_PRODUCTS, []).length > 0) return;   // já tem produtos
  if (window._BEBOSS_DEFAULT_PRODUCTS) {
    _applySeed();
    return;
  }
  const s   = document.createElement('script');
  s.src     = 'products-data.js';
  s.onload  = () => { _applySeed(); refreshAll(); };
  document.head.appendChild(s);
}

function _applySeed() {
  const raw = window._BEBOSS_DEFAULT_PRODUCTS || [];
  if (!raw.length) return;
  save(KEY_PRODUCTS, raw.map(p => ({ ...p, stock: p.stock ?? null })));
}

/* =====================================================
   CUSTOMERS
===================================================== */
function renderCustomers() {
  const users  = load('beboss_users', []);
  const orders = load(KEY_ORDERS, []);
  const tbody  = $('customersTbody');
  const cntEl  = $('customersCount');
  if (cntEl) cntEl.textContent = `${users.length + BASE_CLIENTS} cliente${(users.length + BASE_CLIENTS) !== 1 ? 's' : ''} no total`;
  if (!tbody) return;
  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><i class="fas fa-users"></i><p>Nenhum cliente cadastrado ainda.</p></div></td></tr>';
    return;
  }
  tbody.innerHTML = users.map(u => {
    const userOrders = orders.filter(o => {
      const c = o.customer || {};
      return c.email === u.email || c.cpf === u.cpf || c.userId === u.id;
    });
    const spent = userOrders.reduce((s, o) => s + (o.total || 0), 0);
    const date  = u.createdAt ? new Date(u.createdAt).toLocaleDateString('pt-BR') : '—';
    return `
      <tr style="cursor:pointer" onclick="showCustomerOrders('${u.id || u.cpf?.replace(/\D/g,'')}')">
        <td style="font-weight:500">${u.name}</td>
        <td style="font-size:0.78rem;color:var(--text-muted)">${u.email}</td>
        <td style="font-family:monospace;font-size:0.78rem">${u.cpf}</td>
        <td style="font-size:0.78rem">${u.telefone || '—'}</td>
        <td><span class="badge ${userOrders.length > 0 ? 'badge-green' : 'badge-gray'}">${userOrders.length} pedido${userOrders.length !== 1 ? 's' : ''}</span></td>
        <td style="color:var(--gold);font-weight:600">${spent > 0 ? fmt(spent) : '—'}</td>
        <td style="font-size:0.75rem;color:var(--text-muted)">${date}</td>
      </tr>`;
  }).join('');
}

function showCustomerOrders(uid) {
  const users  = load('beboss_users', []);
  const u      = users.find(x => (x.id || x.cpf?.replace(/\D/g,'')) === uid);
  if (!u) return;
  const orders = load(KEY_ORDERS, []).filter(o => {
    const c = o.customer || {};
    return c.email === u.email || c.cpf === u.cpf || c.userId === u.id;
  });
  const detail = $('customerOrdersDetail');
  if (!detail) return;
  if (!orders.length) { detail.style.display = 'none'; return; }
  detail.style.display = '';
  detail.innerHTML = `
    <div class="section-hd"><h2>Pedidos de ${u.name}</h2></div>
    <div class="table-wrap"><table>
      <thead><tr><th>#</th><th>Total</th><th>Pagamento</th><th>Status</th><th>Data</th></tr></thead>
      <tbody>${orders.sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt)).map(o => {
        const [cls, label] = STATUS_MAP[o.status] || ['badge-gray', o.status];
        return `<tr>
          <td style="font-family:monospace;font-size:0.72rem;color:var(--text-muted)">#${(o.id||'').slice(-6).toUpperCase()}</td>
          <td style="color:var(--gold);font-weight:600">${fmt(o.total||0)}</td>
          <td style="font-size:0.78rem">${o.paymentMethod||'—'}</td>
          <td><span class="badge ${cls}">${label}</span></td>
          <td style="font-size:0.75rem;color:var(--text-muted)">${fmtDate(o.createdAt)}</td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>`;
  detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
window.showCustomerOrders = showCustomerOrders;

/* =====================================================
   REVIEWS
===================================================== */
function renderReviews() {
  const all    = JSON.parse(localStorage.getItem('beboss_comments') || '[]');
  const prods  = load(KEY_PRODUCTS, []);
  const tbody  = $('reviewsTbody');
  const cntEl  = $('reviewsCount');
  if (cntEl) cntEl.textContent = `${all.length} avaliação${all.length !== 1 ? 'ões' : ''}`;
  if (!tbody) return;
  if (!all.length) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><i class="fas fa-star"></i><p>Nenhuma avaliação ainda.</p></div></td></tr>';
    return;
  }
  const sorted = [...all].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  tbody.innerHTML = sorted.map(r => {
    const prod   = prods.find(p => String(p.id) === String(r.productId));
    const name   = prod ? prod.name : `Produto #${r.productId}`;
    const img    = prod ? `<img class="product-thumb" src="${prod.image}" onerror="this.style.opacity=0.3"/>` : '';
    const stars  = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
    const date   = r.createdAt ? new Date(r.createdAt).toLocaleDateString('pt-BR') : '—';
    return `
      <tr>
        <td><div style="display:flex;align-items:center;gap:8px">${img}<span style="font-size:0.78rem">${name}</span></div></td>
        <td><span class="review-stars-sm">${stars}</span></td>
        <td style="max-width:260px;font-size:0.78rem;color:var(--text-muted);font-style:italic">"${r.text}"</td>
        <td style="font-size:0.8rem">${r.customerName}</td>
        <td><code style="color:var(--gold);font-size:0.75rem">${r.purchaseCode}</code></td>
        <td style="font-size:0.75rem;color:var(--text-muted)">${date}</td>
      </tr>`;
  }).join('');
}

/* =====================================================
   VITRINE
===================================================== */
function renderVitrine() {
  const prods    = load(KEY_PRODUCTS, []);
  const selected = (load(KEY_FEATURED, []) || []).map(String);
  const search   = ($('vitrineSearch')?.value || '').toLowerCase();

  const filtered = search
    ? prods.filter(p =>
        p.name.toLowerCase().includes(search) ||
        p.category.toLowerCase().includes(search))
    : prods;

  _updateVitrineCounter(selected.length);

  const grid = $('vitrineGrid');
  if (!grid) return;

  if (!filtered.length) {
    grid.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1;padding:24px;text-align:center">Nenhum produto encontrado.</p>';
    return;
  }

  grid.innerHTML = filtered.map(p => {
    const id    = String(p.id);
    const isSel = selected.includes(id);
    const order = isSel ? selected.indexOf(id) + 1 : 0;
    const isDis = !isSel && selected.length >= 16;
    const esg   = typeof p.stock === 'number' && p.stock <= 0;
    return `
      <div class="vcard${isSel ? ' vcard-selected' : ''}${isDis ? ' vcard-disabled' : ''}"
           data-vid="${id}" data-dis="${isDis}">
        <img src="${p.image}" alt="${p.name}" loading="lazy" onerror="this.src='./logo.png'"/>
        <div class="vcard-num">${isSel ? order : ''}</div>
        <div class="vcard-check"></div>
        <div class="vcard-info">
          <div class="vcard-name">${p.name}</div>
          <div class="vcard-cat">${p.category}</div>
          <div class="vcard-price">${fmt(p.price)}</div>
          ${esg ? '<div class="vcard-esgotado">Esgotado</div>' : ''}
        </div>
      </div>`;
  }).join('');

  /* Delegação de evento — um listener para todos os cards */
  grid.onclick = e => {
    const card = e.target.closest('[data-vid]');
    if (!card || card.dataset.dis === 'true') return;
    toggleVitrine(card.dataset.vid);
  };
}

function _updateVitrineCounter(count) {
  const el = $('vitrineCounter');
  if (!el) return;
  const color = count >= 16 ? 'var(--danger)' : count >= 12 ? 'var(--warning)' : 'var(--gold)';
  el.innerHTML = `<strong style="color:${color}">${count}</strong> / 16 selecionados`;
}

function toggleVitrine(id) {
  let selected = (load(KEY_FEATURED, []) || []).map(String);
  if (selected.includes(id)) {
    selected = selected.filter(s => s !== id);
  } else {
    if (selected.length >= 16) { toast('⚠️ Máximo de 16 produtos na vitrine!'); return; }
    selected.push(id);
  }
  save(KEY_FEATURED, selected);
  renderVitrine();
}

function clearVitrine() {
  save(KEY_FEATURED, []);
  renderVitrine();
  toast('Seleção limpa.');
}

function saveVitrine() {
  const n = (load(KEY_FEATURED, []) || []).length;
  toast(`✅ Vitrine salva com ${n} produto${n !== 1 ? 's' : ''}!`);
}

/* =====================================================
   DASHBOARD
===================================================== */
// Faturamento base fictício (representa histórico anterior ao sistema)
const BASE_REVENUE  = 47320.00;
const BASE_ORDERS   = 183;
const BASE_CLIENTS  = 142;

function renderDashboard() {
  const orders   = load(KEY_ORDERS,   []);
  const prods    = load(KEY_PRODUCTS, []);
  const sellers  = load(KEY_SELLERS,  []);
  const users    = load('beboss_users', []);

  const realRev  = orders.reduce((s, o) => s + (o.total || 0), 0);
  const totalRev = BASE_REVENUE + realRev;
  const totalOrd = BASE_ORDERS + orders.length;
  const totalCli = BASE_CLIENTS + users.length;
  const pending  = orders.filter(o => o.status === 'pendente').length;
  const paid     = orders.filter(o => o.status === 'pago').length;
  const thisMonth = orders.filter(o => {
    const d = new Date(o.createdAt);
    const n = new Date();
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  }).length;

  $('statsGrid').innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Faturamento Total</div>
      <div class="stat-value" style="font-size:1.3rem;color:var(--gold)">${fmt(totalRev)}</div>
      <div class="stat-sub">${orders.length > 0 ? `+${fmt(realRev)} este mês` : 'Histórico acumulado'}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Pedidos</div>
      <div class="stat-value">${totalOrd}</div>
      <div class="stat-sub">${pending} pendentes · ${paid} pagos · ${thisMonth} este mês</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Clientes</div>
      <div class="stat-value">${totalCli}</div>
      <div class="stat-sub">${users.length} novos cadastros</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Produtos</div>
      <div class="stat-value">${prods.length}</div>
      <div class="stat-sub">${sellers.length} vendedor${sellers.length !== 1 ? 'es' : ''} ativo${sellers.length !== 1 ? 's' : ''}</div>
    </div>`;

  const recent = [...orders]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  $('dashOrdersTbody').innerHTML = recent.length
    ? recent.map(renderOrderRow).join('')
    : '<tr><td colspan="6"><div class="empty-state"><i class="fas fa-inbox"></i><p>Nenhum pedido ainda.</p></div></td></tr>';

  _renderRevenueChart(orders);
  _renderStockAlerts(prods);
}

/* ─── GRÁFICO DE FATURAMENTO ─── */
let _chart = null;
function _renderRevenueChart(orders) {
  const ctx = document.getElementById('revenueChart');
  if (!ctx || typeof Chart === 'undefined') return;

  // Últimos 6 meses
  const now    = new Date();
  const months = Array.from({length: 6}, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return d;
  });

  // Base fictícia por mês (crescimento gradual)
  const fictBase = [6840, 7920, 9350, 8670, 10240, 11400];

  // Receita real por mês
  const realByMonth = months.map(d =>
    orders.filter(o => {
      const od = new Date(o.createdAt);
      return od.getMonth() === d.getMonth() && od.getFullYear() === d.getFullYear();
    }).reduce((s, o) => s + (o.total || 0), 0)
  );

  const data   = months.map((_, i) => fictBase[i] + realByMonth[i]);
  const labels = months.map(d => d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }));
  const total  = data.reduce((s, v) => s + v, 0);

  const chartTotalEl = $('chartTotal');
  if (chartTotalEl) chartTotalEl.textContent = `Total 6 meses: ${fmt(total)}`;

  if (_chart) _chart.destroy();

  _chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Faturamento',
        data,
        backgroundColor: months.map((_, i) =>
          i === months.length - 1 ? 'rgba(201,168,76,0.95)' : 'rgba(201,168,76,0.45)'
        ),
        borderColor: 'rgba(201,168,76,1)',
        borderWidth: 1,
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1A1A1A',
          titleColor: '#C9A84C',
          bodyColor: '#E8E0D0',
          callbacks: {
            label: c => `  ${fmt(c.raw)}`,
          }
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          ticks: {
            callback: v => `R$ ${(v/1000).toFixed(0)}k`,
            color: '#888880',
            font: { size: 11 },
          },
          grid: { color: 'rgba(255,255,255,0.04)' },
          border: { display: false },
        },
        x: {
          ticks: { color: '#888880', font: { size: 11 } },
          grid: { display: false },
          border: { display: false },
        }
      }
    }
  });
}

/* ─── ALERTAS DE ESTOQUE BAIXO ─── */
function _renderStockAlerts(prods) {
  const el  = $('stockAlerts');
  if (!el) return;

  const esgotados = prods.filter(p => typeof p.stock === 'number' && p.stock === 0);
  const baixo     = prods.filter(p => typeof p.stock === 'number' && p.stock > 0 && p.stock <= 3);

  if (!esgotados.length && !baixo.length) { el.style.display = 'none'; return; }

  el.style.display = '';
  const makeItem = (p, type) => `
    <div class="alert-stock-item" onclick="navigateTo('products')" style="cursor:pointer">
      <img src="${p.image}" alt="${p.name}" onerror="this.style.opacity=0.3"/>
      <div>
        <div style="font-size:0.8rem;font-weight:600;color:var(--text)">${p.name}</div>
        <span class="badge ${type === 'out' ? 'badge-red' : 'badge-gold'}" style="font-size:0.65rem;margin-top:3px">
          ${type === 'out' ? 'Esgotado' : `${p.stock} un. restantes`}
        </span>
      </div>
    </div>`;

  el.innerHTML = `
    <div class="section-hd" style="margin-bottom:12px">
      <h2 style="display:flex;align-items:center;gap:8px">
        <i class="fas fa-exclamation-triangle" style="color:var(--warning);font-size:1rem"></i>
        Estoque Baixo
        <span class="badge badge-red" style="font-size:0.65rem">${esgotados.length + baixo.length}</span>
      </h2>
      <button class="btn btn-outline btn-sm" onclick="navigateTo('products')">Gerenciar</button>
    </div>
    <div class="alert-stock-grid">
      ${esgotados.map(p => makeItem(p, 'out')).join('')}
      ${baixo.map(p => makeItem(p, 'low')).join('')}
    </div>`
}

/* =====================================================
   PRODUCTS
===================================================== */
function renderProducts() {
  const prods = load(KEY_PRODUCTS, []);
  const tbody = $('productsTbody');
  if (!prods.length) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><i class="fas fa-gem"></i><p>Nenhum produto cadastrado.</p></div></td></tr>';
    return;
  }
  tbody.innerHTML = prods.map(p => {
    const stockNum   = typeof p.stock === 'number' ? p.stock : null;
    const stockBadge = stockNum === null
      ? '<span style="color:var(--text-muted)">Ilimitado</span>'
      : stockNum === 0
        ? '<span class="badge badge-red">Esgotado</span>'
        : stockNum <= 3
          ? `<span class="badge badge-gold">${stockNum} un.</span>`
          : `<span class="badge badge-green">${stockNum} un.</span>`;
    return `
      <tr>
        <td><img class="product-thumb" src="${p.image}" alt="${p.name}" onerror="this.style.opacity=0.3"/></td>
        <td>${p.name}</td>
        <td><span class="badge badge-gold">${p.category}</span></td>
        <td>${fmt(p.price)}</td>
        <td>${stockBadge}</td>
        <td>${p.badge ? `<span class="badge badge-blue">${p.badge}</span>` : '<span style="color:var(--text-muted)">—</span>'}</td>
        <td>
          <div class="actions-cell">
            <button class="btn btn-outline btn-sm" onclick="editProduct('${p.id}')">
              <i class="fas fa-edit"></i> Editar
            </button>
            <button class="btn btn-danger btn-sm" onclick="deleteProduct('${p.id}')">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

$('addProductBtn').onclick = () => openProductModal();

function openProductModal(id = null) {
  const prods = load(KEY_PRODUCTS, []);
  const p     = id ? prods.find(x => x.id === id) : null;

  $('productModalTitle').textContent = p ? 'Editar Produto' : 'Novo Produto';
  $('editProductId').value  = p ? p.id          : '';
  $('pName').value          = p ? p.name        : '';
  $('pCategory').value      = p ? p.category    : 'Correntes';
  $('pPrice').value         = p ? p.price       : '';
  $('pDescription').value   = p ? p.description : '';
  $('pImage').value         = p ? p.image       : '';
  $('pStock').value         = p && typeof p.stock === 'number' ? p.stock : '';
  $('pBadge').value         = p ? (p.badge || '') : '';
  $('productModal').classList.add('open');
  $('pName').focus();
}

function editProduct(id) { openProductModal(id); }
window.editProduct = editProduct;

async function deleteProduct(id) {
  const ok = await confirm('Excluir produto', 'Tem certeza? Esta ação não pode ser desfeita.');
  if (!ok) return;
  let prods = load(KEY_PRODUCTS, []).filter(p => p.id !== id);
  save(KEY_PRODUCTS, prods);
  renderProducts();
  toast('Produto excluído.');
}
window.deleteProduct = deleteProduct;

$('saveProductBtn').onclick = () => {
  const name     = $('pName').value.trim();
  const price    = parseFloat($('pPrice').value);
  const image    = $('pImage').value.trim();
  const desc     = $('pDescription').value.trim();
  const cat      = $('pCategory').value;
  const badge    = $('pBadge').value.trim() || null;
  const eid      = $('editProductId').value;
  const stockRaw = $('pStock').value.trim();
  const stock    = stockRaw !== '' ? parseInt(stockRaw, 10) : null;

  if (!name || isNaN(price) || !image) { toast('Preencha nome, preço e imagem.'); return; }

  let prods = load(KEY_PRODUCTS, []);
  if (eid) {
    prods = prods.map(p => p.id === eid
      ? { ...p, name, price, image, description: desc, category: cat, badge, stock }
      : p);
  } else {
    prods.push({ id: uid(), name, price, image, description: desc, category: cat, badge, stock });
  }
  save(KEY_PRODUCTS, prods);
  $('productModal').classList.remove('open');
  renderProducts();
  toast(eid ? 'Produto atualizado!' : 'Produto adicionado!');
};

$('cancelProductBtn').onclick = () => $('productModal').classList.remove('open');

/* =====================================================
   ORDERS
===================================================== */
let _orderFilter = 'all';

const STATUS_MAP = {
  pendente:  ['badge-gold',  'Pendente'],
  pago:      ['badge-green', 'Pago'],
  enviado:   ['badge-blue',  'Enviado'],
  entregue:  ['badge-green', 'Entregue'],
  cancelado: ['badge-red',   'Cancelado'],
};

function renderOrderRow(o) {
  const [cls, label] = STATUS_MAP[o.status] || ['badge-gray', o.status];
  const pmMap = { pix: '<i class="fas fa-qrcode"></i> PIX', boleto: '<i class="fas fa-barcode"></i> Boleto', credito: '<i class="fas fa-credit-card"></i> Cartão' };
  const method = pmMap[o.paymentMethod] || '<i class="fab fa-whatsapp"></i> WhatsApp';
  return `
    <tr>
      <td style="font-family:monospace;font-size:0.72rem;color:var(--text-muted)">#${(o.id || '').slice(-6).toUpperCase()}</td>
      <td>${o.customer?.nome || o.customer?.name || '—'}</td>
      <td style="color:var(--text-muted)">${(o.items || []).length} item(s)</td>
      <td>${fmt(o.total || 0)}</td>
      <td style="font-size:0.78rem">${method}</td>
      <td><span class="badge ${cls}">${label}</span></td>
      <td style="font-size:0.75rem;color:var(--text-muted)">${fmtDate(o.createdAt)}</td>
      <td>
        <div class="actions-cell">
          <button class="btn btn-outline btn-sm" onclick="viewOrder('${o.id}')">
            <i class="fas fa-eye"></i>
          </button>
          <select class="btn btn-sm"
            style="background:var(--dark3);border:1px solid rgba(201,168,76,0.15);color:var(--text);padding:5px 8px;border-radius:6px;cursor:pointer;"
            onchange="updateOrderStatus('${o.id}', this.value)">
            <option value="pendente"  ${o.status === 'pendente'  ? 'selected' : ''}>Pendente</option>
            <option value="pago"      ${o.status === 'pago'      ? 'selected' : ''}>Pago</option>
            <option value="enviado"   ${o.status === 'enviado'   ? 'selected' : ''}>Enviado</option>
            <option value="entregue"  ${o.status === 'entregue'  ? 'selected' : ''}>Entregue</option>
            <option value="cancelado" ${o.status === 'cancelado' ? 'selected' : ''}>Cancelado</option>
          </select>
        </div>
      </td>
    </tr>`;
}

function renderOrders(filter) {
  _orderFilter = filter;
  let orders = load(KEY_ORDERS, []);
  if (filter !== 'all') orders = orders.filter(o => o.status === filter);
  orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  $('ordersTbody').innerHTML = orders.length
    ? orders.map(renderOrderRow).join('')
    : '<tr><td colspan="8"><div class="empty-state"><i class="fas fa-inbox"></i><p>Nenhum pedido encontrado.</p></div></td></tr>';
}
window.filterOrders = filter => renderOrders(filter);

function updateOrderStatus(id, status) {
  let orders = load(KEY_ORDERS, []).map(o => o.id === id ? { ...o, status } : o);
  save(KEY_ORDERS, orders);
  renderOrders(_orderFilter);
  renderDashboard();
  toast('Status atualizado!');
}
window.updateOrderStatus = updateOrderStatus;

function viewOrder(id) {
  const o = (load(KEY_ORDERS, [])).find(x => x.id === id);
  if (!o) return;

  const items = (o.items || []).map(i => `
    <li class="order-item-row">
      <img class="order-item-img" src="${i.image || ''}" alt="${i.name}" onerror="this.style.opacity=0.3"/>
      <span class="order-item-name">${i.name} × ${i.qty}</span>
      <span class="order-item-price">${fmt((i.price || 0) * (i.qty || 1))}</span>
    </li>`).join('');

  const c = o.customer || {};
  const addr = c.rua
    ? `${c.rua}, ${c.numero} — ${c.bairro}, ${c.cidade} · CEP ${c.cep}`
    : (c.address || '—');

  $('orderDetailContent').innerHTML = `
    <div class="detail-grid">
      <div><div class="detail-label">Cliente</div><div class="detail-value">${c.nome || c.name || '—'}</div></div>
      <div><div class="detail-label">Telefone</div><div class="detail-value">${c.phone || c.telefone || '—'}</div></div>
      <div><div class="detail-label">E-mail</div><div class="detail-value">${c.email || '—'}</div></div>
      <div><div class="detail-label">Pagamento</div><div class="detail-value">${o.paymentMethod || '—'}</div></div>
      <div><div class="detail-label">Status</div><div class="detail-value">${o.status || '—'}</div></div>
      <div><div class="detail-label">Data</div><div class="detail-value">${fmtDate(o.createdAt)}</div></div>
      <div style="grid-column:1/-1"><div class="detail-label">Endereço</div><div class="detail-value">${addr}</div></div>
    </div>
    <p style="font-size:0.75rem;color:var(--text-muted);margin-bottom:8px;letter-spacing:0.08em;text-transform:uppercase">Itens</p>
    <ul class="order-items-list">${items}</ul>
    <div style="border-top:1px solid rgba(201,168,76,0.15);margin-top:12px;padding-top:12px;display:flex;justify-content:space-between">
      <span style="font-size:0.78rem;color:var(--text-muted)">Total</span>
      <span style="color:var(--gold);font-weight:600">${fmt(o.total || 0)}</span>
    </div>`;
  $('orderModal').classList.add('open');
}
window.viewOrder = viewOrder;

$('closeOrderModalBtn').onclick = () => $('orderModal').classList.remove('open');

/* =====================================================
   SELLERS
===================================================== */
function renderSellers() {
  const sellers = load(KEY_SELLERS, []);
  const tbody   = $('sellersTbody');
  if (!sellers.length) {
    tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><i class="fas fa-users"></i><p>Nenhum vendedor cadastrado.</p></div></td></tr>';
    return;
  }
  tbody.innerHTML = sellers.map(s => `
    <tr>
      <td>${s.name}</td>
      <td><code style="color:var(--gold);font-size:0.82rem">@${s.username}</code></td>
      <td style="font-size:0.75rem;color:var(--text-muted)">${fmtDate(s.createdAt)}</td>
      <td><span class="badge ${s.active !== false ? 'badge-green' : 'badge-red'}">${s.active !== false ? 'Ativo' : 'Inativo'}</span></td>
      <td>
        <div class="actions-cell">
          <button class="btn btn-outline btn-sm" onclick="toggleSeller('${s.id}')">
            <i class="fas fa-power-off"></i> ${s.active !== false ? 'Desativar' : 'Ativar'}
          </button>
          <button class="btn btn-danger btn-sm" onclick="deleteSeller('${s.id}')">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>`).join('');
}

$('addSellerBtn').onclick = () => {
  $('sellerModalTitle').textContent = 'Novo Vendedor';
  ['editSellerId', 'sName', 'sUsername', 'sPassword'].forEach(id => { $(id).value = ''; });
  $('sellerModal').classList.add('open');
  $('sName').focus();
};

$('saveSellerBtn').onclick = () => {
  const name     = $('sName').value.trim();
  const username = $('sUsername').value.trim().toLowerCase().replace(/\s+/g, '');
  const password = $('sPassword').value;
  const eid      = $('editSellerId').value;

  if (!name || !username || !password) { toast('Preencha todos os campos.'); return; }
  if (password.length < 4)             { toast('Senha deve ter ao menos 4 caracteres.'); return; }

  let sellers = load(KEY_SELLERS, []);
  if (sellers.find(s => s.username === username && s.id !== eid)) {
    toast('Usuário já cadastrado.'); return;
  }

  if (eid) {
    sellers = sellers.map(s => s.id === eid ? { ...s, name, username, password } : s);
  } else {
    sellers.push({ id: uid(), name, username, password, active: true, createdAt: new Date().toISOString() });
  }
  save(KEY_SELLERS, sellers);
  $('sellerModal').classList.remove('open');
  renderSellers();
  toast(eid ? 'Vendedor atualizado!' : 'Vendedor criado!');
};

$('cancelSellerBtn').onclick = () => $('sellerModal').classList.remove('open');

function toggleSeller(id) {
  let sellers = load(KEY_SELLERS, []).map(s => s.id === id ? { ...s, active: s.active === false } : s);
  save(KEY_SELLERS, sellers);
  renderSellers();
  toast('Status do vendedor atualizado.');
}
window.toggleSeller = toggleSeller;

async function deleteSeller(id) {
  if (!await confirm('Excluir vendedor', 'Esta conta será removida permanentemente.')) return;
  save(KEY_SELLERS, load(KEY_SELLERS, []).filter(s => s.id !== id));
  renderSellers();
  toast('Vendedor removido.');
}
window.deleteSeller = deleteSeller;

/* =====================================================
   SETTINGS
===================================================== */
function loadSettings() {
  const s = load(KEY_SETTINGS, {});
  $('settingsWhatsapp').value  = s.whatsapp         || '5534993049244';
  $('settingsPix').value       = s.pixKey            || '+5534992462935';
  $('settingsPixName').value   = s.pixName           || 'Be Boss 18k';
  $('settingsPixCity').value   = s.pixCity           || 'Uberlândia';
  $('emailjsKey').value        = s.emailjsKey        || '';
  $('emailjsService').value    = s.emailjsService    || '';
  $('emailjsWelcome').value    = s.emailjsWelcome    || '';
  $('emailjsNewsletter').value = s.emailjsNewsletter || '';
}

$('savePasswordBtn').onclick = () => {
  const np = $('newAdminPass').value;
  const cp = $('confirmAdminPass').value;
  if (!np || np.length < 4) { toast('Senha deve ter ao menos 4 caracteres.'); return; }
  if (np !== cp)             { toast('As senhas não coincidem.'); return; }
  save(KEY_ADMIN, np);
  $('newAdminPass').value = $('confirmAdminPass').value = '';
  toast('Senha alterada com sucesso!');
};

$('saveStoreBtn').onclick = () => {
  const prev = load(KEY_SETTINGS, {});
  save(KEY_SETTINGS, {
    ...prev,
    whatsapp: $('settingsWhatsapp').value.trim(),
    pixKey:   $('settingsPix').value.trim(),
    pixName:  $('settingsPixName').value.trim() || 'Be Boss 18k',
    pixCity:  $('settingsPixCity').value.trim() || 'Uberlândia',
  });
  toast('Configurações salvas!');
};

$('saveEmailjsBtn').onclick = () => {
  const prev = load(KEY_SETTINGS, {});
  save(KEY_SETTINGS, {
    ...prev,
    emailjsKey:        $('emailjsKey').value.trim(),
    emailjsService:    $('emailjsService').value.trim(),
    emailjsWelcome:    $('emailjsWelcome').value.trim(),
    emailjsNewsletter: $('emailjsNewsletter').value.trim(),
  });
  toast('Configurações de email salvas!');
};

$('testEmailBtn').onclick = async () => {
  const statusEl = $('emailjsStatus');
  const s = load(KEY_SETTINGS, {});
  if (!s.emailjsKey || !s.emailjsService || !s.emailjsWelcome) {
    if (statusEl) { statusEl.style.display = 'block'; statusEl.style.color = 'var(--danger)'; statusEl.textContent = '⚠️ Preencha Public Key, Service ID e ao menos um Template ID antes de testar.'; }
    return;
  }
  if (statusEl) { statusEl.style.display = 'block'; statusEl.style.color = 'var(--text-muted)'; statusEl.textContent = '⏳ Enviando email de teste...'; }
  try {
    if (typeof emailjs === 'undefined') throw new Error('SDK não carregado');
    emailjs.init({ publicKey: s.emailjsKey });
    await emailjs.send(s.emailjsService, s.emailjsWelcome, {
      to_email: s.pixKey?.includes('@') ? s.pixKey : 'beboss.joias18k@gmail.com',
      nome: 'Admin',
      email: 'teste@beboss.com',
    });
    if (statusEl) { statusEl.style.color = 'var(--success)'; statusEl.textContent = '✅ Email enviado com sucesso! Verifique sua caixa.'; }
  } catch (err) {
    if (statusEl) { statusEl.style.color = 'var(--danger)'; statusEl.textContent = `❌ Erro: ${err.message || err.text || 'Verifique as credenciais.'}` ; }
  }
};

$('exportDataBtn').onclick = () => {
  const data = {
    products: load(KEY_PRODUCTS, []),
    orders:   load(KEY_ORDERS,   []),
    sellers:  load(KEY_SELLERS,  []),
    settings: load(KEY_SETTINGS, {}),
    exported: new Date().toISOString(),
  };
  const a   = document.createElement('a');
  a.href    = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = `beboss-backup-${Date.now()}.json`;
  a.click();
};

$('clearOrdersBtn').onclick = async () => {
  if (!await confirm('Limpar pedidos', 'Todos os pedidos serão excluídos. Exporte antes se precisar.')) return;
  save(KEY_ORDERS, []);
  renderOrders('all');
  renderDashboard();
  toast('Pedidos limpos.');
};

/* --- CLOSE MODALS ON OVERLAY CLICK --- */
document.querySelectorAll('.modal-overlay').forEach(ov => {
  ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('open'); });
});

/* =====================================================
   INIT
===================================================== */
seedProducts();

if (checkSession()) {
  $('loginScreen').style.display = 'none';
  $('app').style.display         = 'flex';
  refreshAll();
} else {
  $('adminPasswordInput').focus();
}
