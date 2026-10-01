/* ============ KONFIGURASI ============
   Tempel URL Web App dari Google Apps Script di bawah ini
   (Deploy > New deployment > Web app > salin URL berakhiran /exec).
   Jika dikosongkan, web tetap jalan dengan data contoh (mode demo). */
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbw55KeKDknnM0baoqLLj4g3yH014Mj5uIBI3XREQE0pB3JqV5-4nOD9REb4axt0BPDhvw/exec";
/* ===================================== */

const DEMO = [
  { id: "P01", name: "Pancake Mix Original", desc: "Adonan pancake organik yang ringan dan lembut. Cukup tambah air, aduk, dan masak.", price: 45000, rating: 4.9, reviews: 295, color: "#9b1c1c", label: "Pancake" },
  { id: "P02", name: "Waffle Mix Crispy", desc: "Renyah di luar, empuk di dalam. Cocok untuk brunch akhir pekan.", price: 48000, rating: 4.8, reviews: 212, color: "#c0502a", label: "Waffle" },
  { id: "P03", name: "Choco Pancake Mix", desc: "Pancake rasa cokelat pekat dengan sentuhan manis yang pas.", price: 52000, rating: 4.7, reviews: 168, color: "#5a2418", label: "Choco" }
];

const $ = (s) => document.querySelector(s);
const rp = (n) => "Rp" + Number(n).toLocaleString("id-ID");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let products = [];
let cart = JSON.parse(JSON.stringify([])); // [{id, qty}]
const qtyState = {};

/* ---------- marquee ---------- */
const mqText = Array(14).fill('<span>BAKE TODAY, OVERTHINK TOMORROW</span><span>●</span>').join("");
$("#mq1").innerHTML = mqText + mqText;
$("#mq2").innerHTML = mqText + mqText;

/* ---------- reveal saat scroll ---------- */
const io = "IntersectionObserver" in window
  ? new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }), { threshold: 0.15, rootMargin: "0px 0px -6% 0px" })
  : null;
function observe() {
  document.querySelectorAll(".rv:not(.in),.rs:not(.in)").forEach((el) => (io ? io.observe(el) : el.classList.add("in")));
}

/* ---------- visual kaleng (SVG) ---------- */
function can(color, label) {
  const l = esc(label);
  return `<svg viewBox="0 0 160 200" aria-hidden="true">
    <ellipse cx="80" cy="190" rx="52" ry="7" fill="#0002"/>
    <rect x="30" y="30" width="100" height="150" rx="10" fill="#f7f0d4" stroke="${color}" stroke-width="3"/>
    <ellipse cx="80" cy="30" rx="50" ry="13" fill="${color}"/><ellipse cx="80" cy="30" rx="38" ry="8" fill="#0003"/>
    <rect x="30" y="60" width="100" height="62" fill="${color}"/>
    <text x="80" y="98" text-anchor="middle" font-family="Anton,Impact,sans-serif" font-size="26" fill="#f7f0d4">${l.toUpperCase()}</text>
    <text x="80" y="143" text-anchor="middle" font-family="Anton,Impact,sans-serif" font-size="13" fill="${color}">BAKE TODAY</text>
    <circle cx="58" cy="160" r="6" fill="none" stroke="${color}" stroke-width="2"/><path d="M82 160h30" stroke="${color}" stroke-width="2"/>
  </svg>`;
}

/* ---------- render produk ---------- */
function renderProducts() {
  const g = $("#grid");
  if (!products.length) { g.innerHTML = '<p class="state">Belum ada produk aktif. Isi sheet "Products" di spreadsheet.</p>'; return; }
  g.innerHTML = products.map((p, i) => {
    qtyState[p.id] = qtyState[p.id] || 1;
    const r = Number(p.rating) || 0;
    return `<article class="card rv" style="--d:${(i % 3) * 0.1}s" data-id="${esc(p.id)}">
      <div class="pv">${i === 0 ? '<span class="badge">Terlaris</span>' : ""}${can(p.color || "#9b1c1c", p.label || p.name.split(" ")[0])}</div>
      <div class="pb">
        <h3 class="disp">${esc(p.name)}</h3>
        <div class="stars">${"★".repeat(Math.round(r))}${"☆".repeat(5 - Math.round(r))} (${esc(p.reviews || 0)} ulasan)</div>
        <p>${esc(p.desc)}</p>
        <div class="price">${rp(p.price)}</div>
        <div class="row">
          <div class="qty"><button data-a="dec" aria-label="Kurangi">−</button><b>${qtyState[p.id]}</b><button data-a="inc" aria-label="Tambah">+</button></div>
          <button class="add" data-a="add">Tambah ke keranjang</button>
        </div>
      </div></article>`;
  }).join("");
  observe();
}

$("#grid").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-a]");
  if (!b) return;
  const card = b.closest(".card"), id = card.dataset.id, a = b.dataset.a;
  if (a === "inc" || a === "dec") {
    qtyState[id] = Math.min(20, Math.max(1, qtyState[id] + (a === "inc" ? 1 : -1)));
    card.querySelector(".qty b").textContent = qtyState[id];
  } else if (a === "add") {
    addToCart(id, qtyState[id]);
    qtyState[id] = 1;
    card.querySelector(".qty b").textContent = 1;
  }
});

/* ---------- keranjang ---------- */
const find = (id) => products.find((p) => p.id === id);
const total = () => cart.reduce((s, c) => s + (find(c.id)?.price || 0) * c.qty, 0);
const count = () => cart.reduce((s, c) => s + c.qty, 0);

function addToCart(id, q) {
  const c = cart.find((x) => x.id === id);
  c ? (c.qty = Math.min(50, c.qty + q)) : cart.push({ id, qty: q });
  updateCart();
  toast(find(id).name + " masuk keranjang");
  const btn = $("#cartBtn");
  btn.classList.remove("pop"); void btn.offsetWidth; btn.classList.add("pop");
}

function updateCart() {
  $("#cc").textContent = count();
  $("#total").textContent = rp(total());
  $("#items").innerHTML = cart.length
    ? cart.map((c) => {
        const p = find(c.id);
        return `<div class="it" data-id="${esc(c.id)}"><div>${esc(p.name)}<small>${rp(p.price)}</small></div>
          <div class="qty"><button data-a="dec" aria-label="Kurangi">−</button><b>${c.qty}</b><button data-a="inc" aria-label="Tambah">+</button></div>
          <b>${rp(p.price * c.qty)}</b></div>`;
      }).join("")
    : '<p class="state">Keranjang masih kosong. Pilih mix favoritmu dulu.</p>';
}

$("#items").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-a]");
  if (!b) return;
  const id = b.closest(".it").dataset.id, c = cart.find((x) => x.id === id);
  c.qty += b.dataset.a === "inc" ? 1 : -1;
  if (c.qty < 1) cart = cart.filter((x) => x.id !== id);
  updateCart();
});

function drawer(open) {
  $("#dr").classList.toggle("on", open);
  $("#ov").classList.toggle("on", open);
  $("#dr").setAttribute("aria-hidden", !open);
  document.body.style.overflow = open ? "hidden" : "";
}
$("#cartBtn").onclick = () => drawer(true);
$("#cls").onclick = $("#ov").onclick = () => drawer(false);
document.addEventListener("keydown", (e) => e.key === "Escape" && drawer(false));

let tt;
function toast(t) {
  const el = $("#toast");
  el.textContent = t; el.classList.add("on");
  clearTimeout(tt); tt = setTimeout(() => el.classList.remove("on"), 2200);
}

/* ---------- checkout -> Google Sheets ---------- */
$("#co").onclick = async () => {
  const msg = $("#msg"), btn = $("#co");
  const name = $("#nm").value.trim(), wa = $("#wa").value.trim();
  msg.style.color = "";
  if (!cart.length) return (msg.textContent = "Keranjang masih kosong.");
  if (name.length < 2) return (msg.textContent = "Isi nama lengkap dulu.");
  if (!/^[0-9+\s-]{8,16}$/.test(wa)) return (msg.textContent = "Nomor WhatsApp belum valid.");

  const payload = { name, phone: wa, note: $("#nt").value.trim(), items: cart.map((c) => ({ id: c.id, qty: c.qty })) };
  btn.disabled = true; btn.textContent = "Mengirim..."; msg.textContent = "";
  try {
    let res;
    if (WEB_APP_URL) {
      // Tanpa header Content-Type agar tidak memicu preflight CORS
      const r = await fetch(WEB_APP_URL, { method: "POST", body: JSON.stringify(payload) });
      res = await r.json();
      if (!res.ok) throw new Error(res.error || "Gagal menyimpan pesanan");
    } else {
      await new Promise((r) => setTimeout(r, 700));
      res = { ok: true, orderId: "DEMO-" + Date.now().toString().slice(-6), total: total() };
    }
    cart = []; updateCart();
    ["#nm", "#wa", "#nt"].forEach((s) => ($(s).value = ""));
    msg.style.color = "#1d6b2f";
    msg.textContent = `Pesanan ${res.orderId} tercatat. Total ${rp(res.total)}.`;
    toast("Pesanan berhasil dikirim");
  } catch (err) {
    msg.textContent = "Pesanan gagal terkirim: " + err.message + ". Coba lagi.";
  } finally {
    btn.disabled = false; btn.textContent = "Pesan sekarang";
  }
};

/* ---------- muat produk dari spreadsheet ---------- */
async function init() {
  updateCart();
  observe();
  try {
    if (!WEB_APP_URL) throw new Error("demo");
    const r = await fetch(WEB_APP_URL);
    const d = await r.json();
    if (!d.ok) throw new Error(d.error);
    products = d.products;
  } catch (e) {
    products = DEMO;
    if (WEB_APP_URL) toast("Gagal memuat spreadsheet, memakai data contoh");
  }
  renderProducts();
}
init();
