/* =====================================================
   BE BOSS 18k — SELLER PANEL
===================================================== */
const KEY_SELLERS  = 'beboss_sellers';
const KEY_ORDERS   = 'beboss_orders';
const KEY_PRODUCTS = 'beboss_products';
const KEY_VSESS    = 'beboss_seller_session';

const $ = id => document.getElementById(id);

let _currentSeller = null;
let _allFilter     = 'all';

function load(key, fallback = null) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

function fmt(n) { return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function clientName(c) { return c?.nome || c?.name || '—'; }
function clientPhone(c) { return c?.telefone || c?.phone || null; }
function clientAddr(c) {
  if (c?.rua) return `${c.rua}, ${c.numero} — ${c.bairro}, ${c.cidade} · CEP ${c.cep}`;
  return c?.address || '—';
}

function toast(msg) {
  const t = $('vendToast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

/* --- AUTH --- */
function doLogin() {
  const username = $('usernameInput').value.trim().toLowerCase();
  const password = $('passwordInput').value;
  const sellers  = load(KEY_SELLERS, []);
  const seller   = sellers.find(s => s.username === username && s.password === password && s.active !== false);

  if (seller) {
    save(KEY_VSESS, { id: seller.id, username: seller.username, name: seller.name });
    _currentSeller = seller;
    showApp();
  } else {
    const err = $('loginError');
    err.classList.add('show');
    $('passwordInput').value = '';
    $('passwordInput').focus();
    setTimeout(() => err.classList.remove('show'), 3000);
  }
}

$('loginBtn').onclick = doLogin;
$('passwordInput').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
$('usernameInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('passwordInput').focus(); });
$('logoutBtn').onclick = () => { localStorage.removeItem(KEY_VSESS); location.reload(); };

function showApp() {
  $('loginScreen').style.display = 'none';
  $('app').style.display         = 'flex';
  $('sellerNameDisplay').textContent = _currentSeller?.name || 'Vendedor';
  refreshAll();
}

function checkSession() {
  const sess   = load(KEY_VSESS, null);
  if (!sess) return false;
  const seller = load(KEY_SELLERS, []).find(s => s.id === sess.id && s.active !== false);
  if (!seller) { localStorage.removeItem(KEY_VSESS); return false; }
  _currentSeller = seller;
  return true;
}

/* --- NAVIGATION --- */
const PAGE_LABELS = {
  overview:    'Resumo',
  pending:     'Pedidos Pendentes',
  'all-orders':'Todos os Pedidos',
  stock:       'Controle de Estoque',
  reviews:     'Avaliações',
};

function navigateTo(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pg  = $('page-' + pageId);
  const nav = document.querySelector(`.nav-item[data-page="${pageId}"]`);
  if (pg)  pg.classList.add('active');
  if (nav) nav.classList.add('active');
  $('topbarTitle').textContent = PAGE_LABELS[pageId] || '';
  refreshPage(pageId);
}

document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
  btn.addEventListener('click', () => navigateTo(btn.dataset.page));
});

function refreshPage(pageId) {
  const map = {
    overview:    renderOverview,
    pending:     renderPending,
    'all-orders':() => renderAllOrders(_allFilter),
    stock:       renderStock,
    reviews:     renderReviews,
  };
  map[pageId]?.();
}
function refreshAll() { renderOverview(); renderPending(); renderAllOrders('all'); }

/* --- STATUS HELPERS --- */
const STATUS_MAP = {
  pendente:  ['badge-gold',  'Pendente'],
  pago:      ['badge-green', 'Pago'],
  enviado:   ['badge-blue',  'Enviado'],
  entregue:  ['badge-green', 'Entregue'],
  cancelado: ['badge-red',   'Cancelado'],
};
function statusBadge(s) {
  const [cls, label] = STATUS_MAP[s] || ['badge-gray', s];
  return `<span class="badge ${cls}">${label}</span>`;
}
function payIcon(m) {
  const map = { pix: '<i class="fas fa-qrcode"></i> PIX', boleto: '<i class="fas fa-barcode"></i> Boleto', credito: '<i class="fas fa-credit-card"></i> Cartão' };
  return map[m] || '<i class="fab fa-whatsapp"></i> WhatsApp';
}

/* --- UPDATE ORDER STATUS --- */
function updateStatus(id, status) {
  save(KEY_ORDERS, load(KEY_ORDERS, []).map(o => o.id === id ? { ...o, status } : o));
  toast('Status atualizado!');
  refreshAll();
}
window.updateStatus = updateStatus;

/* --- ORDER DETAIL MODAL --- */
function viewOrder(id) {
  const o = load(KEY_ORDERS, []).find(x => x.id === id);
  if (!o) return;
  const c     = o.customer || {};
  const phone = clientPhone(c);
  const waLink = phone
    ? `<a href="https://wa.me/${phone.replace(/\D/g,'')}" target="_blank" style="color:var(--gold)"><i class="fab fa-whatsapp"></i> ${phone}</a>`
    : '—';

  const items = (o.items || []).map(i => `
    <li class="order-item-row">
      <img class="order-item-img" src="${i.image || ''}" alt="${i.name}" onerror="this.style.opacity=0.3"/>
      <span class="order-item-name">${i.name} × ${i.qty}</span>
      <span class="order-item-price">${fmt((i.price || 0) * (i.qty || 1))}</span>
    </li>`).join('');

  $('orderDetailContent').innerHTML = `
    <div class="detail-grid">
      <div><div class="detail-label">Cliente</div><div class="detail-value">${clientName(c)}</div></div>
      <div><div class="detail-label">Telefone</div><div class="detail-value">${waLink}</div></div>
      <div><div class="detail-label">E-mail</div><div class="detail-value">${c.email || '—'}</div></div>
      <div><div class="detail-label">Pagamento</div><div class="detail-value">${payIcon(o.paymentMethod)}</div></div>
      <div><div class="detail-label">Status</div><div class="detail-value">${statusBadge(o.status)}</div></div>
      <div><div class="detail-label">Data</div><div class="detail-value">${fmtDate(o.createdAt)}</div></div>
      <div style="grid-column:1/-1"><div class="detail-label">Endereço</div><div class="detail-value">${clientAddr(c)}</div></div>
    </div>
    <p style="font-size:0.75rem;color:var(--text-muted);margin-bottom:8px;letter-spacing:0.08em;text-transform:uppercase">Itens</p>
    <ul class="order-items-list">${items}</ul>
    <div style="border-top:1px solid rgba(201,168,76,0.15);margin-top:12px;padding-top:12px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:0.78rem;color:var(--text-muted)">Total</span>
      <span style="color:var(--gold);font-weight:600;font-size:1.1rem">${fmt(o.total || 0)}</span>
    </div>
    <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
      ${o.status === 'pendente' ? `<button class="btn btn-success btn-sm" onclick="updateStatus('${o.id}','pago');$('orderModal').classList.remove('open')"><i class="fas fa-check"></i> Marcar como Pago</button>` : ''}
      ${o.status === 'pago'     ? `<button class="btn btn-blue btn-sm"    onclick="updateStatus('${o.id}','enviado');$('orderModal').classList.remove('open')"><i class="fas fa-truck"></i> Marcar como Enviado</button>` : ''}
      ${o.status === 'enviado'  ? `<button class="btn btn-success btn-sm" onclick="updateStatus('${o.id}','entregue');$('orderModal').classList.remove('open')"><i class="fas fa-box-open"></i> Marcar como Entregue</button>` : ''}
    </div>`;
  $('orderModal').classList.add('open');
}
window.viewOrder = viewOrder;
$('closeOrderBtn').onclick = () => $('orderModal').classList.remove('open');
$('orderModal').addEventListener('click', e => { if (e.target === $('orderModal')) $('orderModal').classList.remove('open'); });

/* --- OVERVIEW --- */
function renderOverview() {
  const orders  = load(KEY_ORDERS, []);
  const pending = orders.filter(o => o.status === 'pendente').length;
  const paid    = orders.filter(o => o.status === 'pago').length;
  const shipped = orders.filter(o => o.status === 'enviado').length;
  const total   = orders.reduce((s, o) => s + (o.total || 0), 0);

  $('pendingDot').style.display = pending > 0 ? 'inline-block' : 'none';

  $('overviewStats').innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Pendentes</div>
      <div class="stat-value" style="color:${pending > 0 ? 'var(--gold)' : 'var(--text-muted)'}">${pending}</div>
      <div class="stat-sub">Aguardando ação</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Pagos</div>
      <div class="stat-value">${paid}</div>
      <div class="stat-sub">Confirmar envio</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Enviados</div>
      <div class="stat-value">${shipped}</div>
      <div class="stat-sub">Em trânsito</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Total Pedidos</div>
      <div class="stat-value">${orders.length}</div>
      <div class="stat-sub">${fmt(total)}</div>
    </div>`;

  const recent = [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8);
  $('overviewTbody').innerHTML = recent.length
    ? recent.map(o => `
      <tr>
        <td style="font-family:monospace;font-size:0.72rem;color:var(--text-muted)">#${(o.id || '').slice(-6).toUpperCase()}</td>
        <td>${clientName(o.customer)}</td>
        <td>${fmt(o.total || 0)}</td>
        <td style="font-size:0.78rem">${payIcon(o.paymentMethod)}</td>
        <td>${statusBadge(o.status)}</td>
        <td style="font-size:0.75rem;color:var(--text-muted)">${fmtDate(o.createdAt)}</td>
        <td><button class="btn btn-outline btn-sm" onclick="viewOrder('${o.id}')"><i class="fas fa-eye"></i></button></td>
      </tr>`).join('')
    : '<tr><td colspan="7"><div class="empty-state"><i class="fas fa-inbox"></i><p>Nenhum pedido ainda.</p></div></td></tr>';
}

/* --- PENDING --- */
function renderPending() {
  const orders = load(KEY_ORDERS, [])
    .filter(o => o.status === 'pendente')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  $('pendingTbody').innerHTML = orders.length
    ? orders.map(o => {
        const c     = o.customer || {};
        const phone = clientPhone(c);
        return `
          <tr>
            <td style="font-family:monospace;font-size:0.72rem;color:var(--text-muted)">#${(o.id || '').slice(-6).toUpperCase()}</td>
            <td>${clientName(c)}</td>
            <td>${phone ? `<a href="https://wa.me/${phone.replace(/\D/g,'')}" target="_blank" style="color:#80CFA4;font-size:0.8rem"><i class="fab fa-whatsapp"></i> ${phone}</a>` : '—'}</td>
            <td>${fmt(o.total || 0)}</td>
            <td style="font-size:0.78rem">${payIcon(o.paymentMethod)}</td>
            <td style="font-size:0.75rem;color:var(--text-muted)">${fmtDate(o.createdAt)}</td>
            <td>
              <div class="actions-cell">
                <button class="btn btn-outline btn-sm" onclick="viewOrder('${o.id}')"><i class="fas fa-eye"></i></button>
                <button class="btn btn-success btn-sm" onclick="updateStatus('${o.id}','pago')"><i class="fas fa-check"></i> Pago</button>
              </div>
            </td>
          </tr>`;
      }).join('')
    : '<tr><td colspan="7"><div class="empty-state"><i class="fas fa-check-circle"></i><p>Nenhum pedido pendente.</p></div></td></tr>';
}

/* --- ALL ORDERS --- */
function renderAllOrders(filter) {
  _allFilter = filter;
  let orders = load(KEY_ORDERS, []);
  if (filter !== 'all') orders = orders.filter(o => o.status === filter);
  orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  $('allOrdersTbody').innerHTML = orders.length
    ? orders.map(o => `
      <tr>
        <td style="font-family:monospace;font-size:0.72rem;color:var(--text-muted)">#${(o.id || '').slice(-6).toUpperCase()}</td>
        <td>${clientName(o.customer)}</td>
        <td style="color:var(--text-muted)">${(o.items || []).length} item(s)</td>
        <td>${fmt(o.total || 0)}</td>
        <td style="font-size:0.78rem">${payIcon(o.paymentMethod)}</td>
        <td>${statusBadge(o.status)}</td>
        <td style="font-size:0.75rem;color:var(--text-muted)">${fmtDate(o.createdAt)}</td>
        <td>
          <div class="actions-cell">
            <button class="btn btn-outline btn-sm" onclick="viewOrder('${o.id}')"><i class="fas fa-eye"></i></button>
            <select class="btn btn-sm" style="background:var(--dark3);border:1px solid rgba(201,168,76,0.15);color:var(--text);padding:5px 8px;border-radius:6px;cursor:pointer"
              onchange="updateStatus('${o.id}', this.value)">
              <option value="pendente"  ${o.status === 'pendente'  ? 'selected' : ''}>Pendente</option>
              <option value="pago"      ${o.status === 'pago'      ? 'selected' : ''}>Pago</option>
              <option value="enviado"   ${o.status === 'enviado'   ? 'selected' : ''}>Enviado</option>
              <option value="entregue"  ${o.status === 'entregue'  ? 'selected' : ''}>Entregue</option>
              <option value="cancelado" ${o.status === 'cancelado' ? 'selected' : ''}>Cancelado</option>
            </select>
          </div>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="8"><div class="empty-state"><i class="fas fa-inbox"></i><p>Nenhum pedido encontrado.</p></div></td></tr>';
}
window.filterAll = filter => renderAllOrders(filter);

/* --- STOCK --- */
function renderStock() {
  const prods = load(KEY_PRODUCTS, []);
  const tbody = $('stockTbody');
  if (!prods.length) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><i class="fas fa-boxes"></i><p>Nenhum produto cadastrado ainda.</p></div></td></tr>';
    return;
  }
  tbody.innerHTML = prods.map(p => {
    const stockNum   = typeof p.stock === 'number' ? p.stock : null;
    const stockBadge = stockNum === null
      ? '<span class="badge badge-gray">Ilimitado</span>'
      : stockNum === 0
        ? '<span class="badge badge-red">Esgotado</span>'
        : stockNum <= 3
          ? `<span class="badge badge-gold">${stockNum} un.</span>`
          : `<span class="badge badge-green">${stockNum} un.</span>`;
    return `
      <tr>
        <td><img class="product-thumb" src="${p.image}" alt="${p.name}" onerror="this.style.opacity=0.3"/></td>
        <td style="font-weight:500">${p.name}</td>
        <td><span class="badge badge-gold" style="font-size:0.65rem">${p.category}</span></td>
        <td style="color:var(--gold)">${fmt(p.price)}</td>
        <td>${stockBadge}</td>
        <td>
          <div class="stock-input-wrap">
            <input class="stock-input" type="number" min="0" step="1"
              placeholder="—" value="${stockNum !== null ? stockNum : ''}"
              id="stock_${p.id}"/>
            <button class="btn btn-outline btn-sm" onclick="saveStock('${p.id}')">
              <i class="fas fa-save"></i> Salvar
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

function saveStock(id) {
  const inp = $('stock_' + id);
  if (!inp) return;
  const newStock = inp.value.trim() !== '' ? parseInt(inp.value, 10) : null;
  save(KEY_PRODUCTS, load(KEY_PRODUCTS, []).map(p => String(p.id) === String(id) ? { ...p, stock: newStock } : p));
  renderStock();
  toast(newStock === 0 ? '⚠️ Produto marcado como Esgotado!' : 'Estoque atualizado!');
}
window.saveStock = saveStock;

/* --- REVIEWS --- */
function renderReviews() {
  const all    = JSON.parse(localStorage.getItem('beboss_comments') || '[]');
  const prods  = load(KEY_PRODUCTS, []);
  const tbody  = $('reviewsTbody');
  const cntEl  = $('reviewsCount');
  if (cntEl) cntEl.textContent = `${all.length} avaliação${all.length !== 1 ? 'ões' : ''}`;
  if (!tbody) return;
  if (!all.length) {
    tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><i class="fas fa-star"></i><p>Nenhuma avaliação ainda.</p></div></td></tr>';
    return;
  }
  const sorted = [...all].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  tbody.innerHTML = sorted.map(r => {
    const prod  = prods.find(p => String(p.id) === String(r.productId));
    const name  = prod ? prod.name : `Produto #${r.productId}`;
    const img   = prod ? `<img class="product-thumb" src="${prod.image}" onerror="this.style.opacity=0.3"/>` : '';
    const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
    const date  = r.createdAt ? new Date(r.createdAt).toLocaleDateString('pt-BR') : '—';
    return `
      <tr>
        <td><div style="display:flex;align-items:center;gap:8px">${img}<span style="font-size:0.78rem">${name}</span></div></td>
        <td><span class="review-stars-sm">${stars}</span></td>
        <td style="max-width:260px;font-size:0.78rem;color:var(--text-muted);font-style:italic">"${r.text}"</td>
        <td style="font-size:0.8rem">${r.customerName}</td>
        <td style="font-size:0.75rem;color:var(--text-muted)">${date}</td>
      </tr>`;
  }).join('');
}

/* --- INIT --- */
if (checkSession()) {
  showApp();
} else {
  $('usernameInput').focus();
}
