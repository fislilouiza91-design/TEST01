/* ═══════════════════════════════════════════════════════
   Smart Shopper — Popup Controller (Real Data)
   ═══════════════════════════════════════════════════════ */

let currentProduct = null;
let sellers = [];       // will come from API later
let activeFilter = "best";

const els = {
  productBox:   document.getElementById("productBox"),
  productImg:   document.getElementById("productImg"),
  productTitle: document.getElementById("productTitle"),
  productSub:   document.getElementById("productSub"),
  notOnPage:    document.getElementById("notOnPage"),
  findBtn:      document.getElementById("findBtn"),
  filters:      document.getElementById("filters"),
  list:         document.getElementById("list"),
  empty:        document.getElementById("empty"),
  sellerCount:  document.getElementById("sellerCount"),
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  await loadCurrentProduct();
  els.findBtn.addEventListener("click", handleFind);
  els.filters.addEventListener("click", handleFilterClick);
}

/* ── Load product from content script ── */
async function loadCurrentProduct() {
  try {
    const res = await chrome.runtime.sendMessage({ type: "GET_CURRENT_PRODUCT" });

    if (!res?.ok || !res.product?.title) {
      showNotOnPage();
      return;
    }

    currentProduct = res.product;
    renderProduct(currentProduct);
    els.findBtn.classList.remove("hidden");
  } catch (e) {
    showNotOnPage();
  }
}

function renderProduct(p) {
  els.productBox.classList.remove("hidden");
  els.notOnPage.classList.add("hidden");

  els.productTitle.textContent = p.title || "Untitled product";

  if (p.image) {
    els.productImg.src = p.image;
    els.productImg.onerror = () => { els.productImg.style.display = "none"; };
  } else {
    els.productImg.style.display = "none";
  }

  const parts = [];
  if (p.price != null) parts.push(`<span class="price-current">$${p.price.toFixed(2)}</span>`);
  if (p.rating != null) parts.push(`★ ${p.rating}`);
  if (p.sold != null) parts.push(`${fmt(p.sold)} sold`);

  els.productSub.innerHTML = parts.join(`<span class="dot">●</span>`)
    || `<span style="color:var(--fg-3)">No details extracted</span>`;
}

function showNotOnPage() {
  els.productBox.classList.add("hidden");
  els.notOnPage.classList.remove("hidden");
  els.findBtn.classList.add("hidden");
  els.filters.classList.add("hidden");
  els.sellerCount.textContent = "— sellers";
}

/* ── Find button ── */
async function handleFind() {
  els.findBtn.disabled = true;
  els.findBtn.textContent = "Scanning…";
  els.list.innerHTML = Array.from({ length: 5 }).map(skeleton).join("");
  els.empty.classList.add("hidden");

  // TODO: call real API. For now → mock.
  await sleep(1200);
  sellers = MOCK_SELLERS;
  renderList();

  els.findBtn.disabled = false;
  els.findBtn.textContent = "🔍 Search again";
  els.filters.classList.remove("hidden");
}

/* ── Render list ── */
function renderList() {
  const items = sortSellers(sellers, activeFilter);
  els.list.innerHTML = "";
  els.empty.classList.toggle("hidden", items.length > 0);
  els.sellerCount.textContent = `${items.length} sellers`;

  const minPrice = Math.min(...items.map(s => s.price));
  const maxRating = Math.max(...items.map(s => s.rating));
  const maxSold = Math.max(...items.map(s => s.sold));

  items.forEach((s, i) => {
    els.list.appendChild(buildRow(s, i, {
      isCheap: s.price === minPrice,
      isTop:   s.rating === maxRating,
      isSold:  s.sold === maxSold,
      rank:    i + 1,
    }));
  });
}

function buildRow(s, i, opts) {
  const el = document.createElement("div");
  el.className = "row";
  el.style.animationDelay = `${i * 25}ms`;

  const rank = opts.rank;
  if (rank === 1) el.classList.add("best");
  else if (opts.isCheap) el.classList.add("cheap");

  const pricePercent = currentProduct?.price
    ? Math.round((1 - s.price / currentProduct.price) * 100)
    : 0;
  const ratingDelta = currentProduct?.rating ? s.rating - currentProduct.rating : 0;
  const soldDelta   = currentProduct?.sold ? s.sold - currentProduct.sold : 0;

  const rankClass = rank <= 3 ? `r${rank}` : "";

  let tag = "";
  if (activeFilter === "cheap" && rank === 1) tag = `<span class="save-tag cheap">Cheapest</span>`;
  else if (activeFilter === "rated" && rank === 1) tag = `<span class="save-tag top">Top Rated</span>`;
  else if (activeFilter === "sold" && rank === 1) tag = `<span class="save-tag top">Most Sold</span>`;
  else if (activeFilter === "best" && rank === 1) tag = `<span class="save-tag best">Best Value</span>`;
  else if (opts.isCheap) tag = `<span class="save-tag cheap">Best Price</span>`;

  el.innerHTML = `
    ${tag}
    <div class="rank ${rankClass}">${rank}</div>
    <div class="thumb"><img src="${s.img}" loading="lazy" onerror="this.style.display='none'"></div>
    <div class="info">
      <div class="store">${esc(s.store)}</div>
      <div class="meta">
        <span class="rating">★ ${s.rating}</span>
        <span class="${ratingDelta >= 0 ? "up" : "down"}">${ratingDelta > 0 ? "▲" : ratingDelta < 0 ? "▼" : ""}</span>
        <span class="dot">●</span>
        <span>${fmt(s.sold)}</span>
        <span class="${soldDelta >= 0 ? "up" : "down"}">${soldDelta > 0 ? "▲" : soldDelta < 0 ? "▼" : ""}</span>
      </div>
    </div>
    <div class="price-col">
      <div class="price-now">$${s.price.toFixed(2)}</div>
      <div class="price-was">$${currentProduct?.price?.toFixed(2) || ""} · −${pricePercent}%</div>
    </div>
  `;

  el.addEventListener("click", () => {
    if (s.link) window.open(s.link, "_blank", "noopener");
    else alert(`Seller: ${s.store}\nPrice: $${s.price}\nRating: ★ ${s.rating}\nSold: ${s.sold}`);
  });

  return el;
}

/* ── Filters ── */
function handleFilterClick(e) {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  activeFilter = chip.dataset.f;
  els.filters.querySelectorAll(".chip").forEach((c) =>
    c.classList.toggle("active", c === chip)
  );
  renderList();
}

/* ── Sort ── */
function sortSellers(arr, f) {
  const copy = [...arr];
  if (f === "cheap") return copy.sort((a, b) => a.price - b.price);
  if (f === "rated") return copy.sort((a, b) => b.rating - a.rating);
  if (f === "sold")  return copy.sort((a, b) => b.sold - a.sold);
  return copy.sort((a, b) => valueScore(b) - valueScore(a));
}

function valueScore(s) {
  const cp = currentProduct?.price || 25;
  const priceScore  = (cp - s.price) / cp;
  const ratingScore = s.rating / 5;
  const soldScore   = Math.min(s.sold / 5000, 1);
  return priceScore * 0.5 + ratingScore * 0.3 + soldScore * 0.2;
}

/* ── MOCK (temporary until real API) ── */
const MOCK_SELLERS = [
  { store:"SoundMax Official", img:"https://picsum.photos/seed/s1/80/80", price:18.50, rating:4.8, sold:3500, link:"" },
  { store:"AudioLab Store",    img:"https://picsum.photos/seed/s2/80/80", price:16.90, rating:4.6, sold:1800, link:"" },
  { store:"FitSound Global",   img:"https://picsum.photos/seed/s3/80/80", price:22.00, rating:4.9, sold:950,  link:"" },
  { store:"BassWave Audio",    img:"https://picsum.photos/seed/s4/80/80", price:20.50, rating:4.7, sold:2400, link:"" },
  { store:"TechNova Store",    img:"https://picsum.photos/seed/s5/80/80", price:17.80, rating:4.4, sold:1200, link:"" },
];

/* ── Helpers ── */
function skeleton() {
  return `
    <div class="sk-row">
      <div class="sk sk-rank"></div>
      <div class="sk sk-thumb"></div>
      <div class="sk-lines">
        <div class="sk sk-line" style="width:75%"></div>
        <div class="sk sk-line" style="width:45%"></div>
      </div>
      <div class="sk sk-line" style="width:45px;height:14px"></div>
    </div>`;
}

const esc = (s) => { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; };
const fmt = (n) => n >= 1000 ? (n / 1000).toFixed(1).replace(".0", "") + "k" : n;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));