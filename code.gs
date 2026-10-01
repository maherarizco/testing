/**
 * BAKE TODAY - Backend Google Sheets
 * Taruh di spreadsheet: Extensions > Apps Script > tempel kode ini.
 * Deploy > New deployment > Web app
 *   Execute as: Me | Who has access: Anyone
 * Salin URL /exec ke WEB_APP_URL di app.js.
 * Setelah mengubah kode, buat "New version" pada deployment.
 */

const SHEET_PRODUCTS = 'Products';
const SHEET_ORDERS = 'Orders';
const P_HEAD = ['id', 'name', 'desc', 'price', 'rating', 'reviews', 'color', 'label', 'active'];
const O_HEAD = ['Waktu', 'Order ID', 'Nama', 'WhatsApp', 'Catatan', 'Item', 'Total', 'Status'];

const SEED = [
  ['P01', 'Pancake Mix Original', 'Adonan pancake organik yang ringan dan lembut. Cukup tambah air, aduk, dan masak.', 45000, 4.9, 295, '#9b1c1c', 'Pancake', true],
  ['P02', 'Waffle Mix Crispy', 'Renyah di luar, empuk di dalam. Cocok untuk brunch akhir pekan.', 48000, 4.8, 212, '#c0502a', 'Waffle', true],
  ['P03', 'Choco Pancake Mix', 'Pancake rasa cokelat pekat dengan sentuhan manis yang pas.', 52000, 4.7, 168, '#5a2418', 'Choco', true]
];

function getSheet_(name, head, seed) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(head);
    sh.getRange(1, 1, 1, head.length).setFontWeight('bold').setBackground('#9b1c1c').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    if (seed) sh.getRange(2, 1, seed.length, head.length).setValues(seed);
  }
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function readProducts_() {
  const sh = getSheet_(SHEET_PRODUCTS, P_HEAD, SEED);
  const rows = sh.getDataRange().getValues();
  const head = rows.shift().map(String);
  return rows
    .filter(r => r[0] !== '')
    .map(r => {
      const o = {};
      head.forEach((h, i) => (o[h] = r[i]));
      o.id = String(o.id);
      o.price = Number(o.price) || 0;
      o.active = o.active === true || String(o.active).toUpperCase() === 'TRUE';
      return o;
    })
    .filter(p => p.active);
}

// GET: kirim daftar produk ke website
function doGet() {
  try {
    return json_({ ok: true, products: readProducts_() });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// POST: simpan pesanan (total dihitung ulang di server agar harga tidak bisa dimanipulasi)
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const d = JSON.parse(e.postData.contents);
    const name = String(d.name || '').trim().slice(0, 80);
    const phone = String(d.phone || '').trim().slice(0, 20);
    const note = String(d.note || '').trim().slice(0, 200);
    if (!name || !phone || !Array.isArray(d.items) || !d.items.length) throw new Error('Data pesanan tidak lengkap');

    const map = {};
    readProducts_().forEach(p => (map[p.id] = p));
    let total = 0;
    const lines = d.items.map(it => {
      const p = map[String(it.id)];
      const q = Math.min(50, Math.max(1, parseInt(it.qty, 10) || 0));
      if (!p) throw new Error('Produk tidak ditemukan: ' + it.id);
      total += p.price * q;
      return p.name + ' x' + q;
    });

    const sh = getSheet_(SHEET_ORDERS, O_HEAD);
    const orderId = 'BT-' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyMMdd') + '-' + String(sh.getLastRow()).padStart(3, '0');
    // tanda kutip di depan mencegah nomor HP diubah jadi angka
    sh.appendRow([new Date(), orderId, name, "'" + phone, note, lines.join(', '), total, 'Baru']);
    return json_({ ok: true, orderId: orderId, total: total });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  } finally {
    lock.releaseLock();
  }
}
