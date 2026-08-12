/* =====================================================================
   AURUM — سلة التسوق (مشتركة بين index.html و product.html)
   - تُخزَّن محليًا فـ localStorage
   - نافذة السلة فيها نموذج تأكيد (اسم/هاتف/مدينة/عنوان)
   - إذا العميل عبّأ معلوماته ولم يؤكد، تُسجَّل كسلة مهجورة (تظهر فـ اللوحة)
   - عند التأكيد: يُسجَّل طلب حقيقي لكل منتج فالسلة + يُفتح واتساب كملخّص
   ===================================================================== */
const CART_KEY = "aurum_cart";
let cartAbandonedId = null;
let cartOrderSubmitted = false;

function getCart(){
  try{ return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); }
  catch(e){ return []; }
}
function saveCart(cart){
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartBadge();
}
function addToCart(item){
  const cart = getCart();
  cart.push(item);
  saveCart(cart);
}
function removeFromCart(index){
  const cart = getCart();
  cart.splice(index, 1);
  saveCart(cart);
}
function updateCartBadge(){
  const el = document.getElementById("cart-count");
  if (el) el.textContent = getCart().length;
}
function cartTotal(cart){
  return cart.reduce((sum, it) => sum + Number(it.price) * (it.qty || 1), 0);
}

function buildWhatsAppLink(cart, whatsappNumber){
  const num = (whatsappNumber || "212600000000").replace(/\D/g, "");
  if (!cart.length) return `https://wa.me/${num}`;
  const isAr = (typeof lang === "undefined") || lang === "ar";
  const currency = (typeof DICT !== "undefined" && DICT.currency) ? DICT.currency : (isAr ? "د.م." : "MAD");
  const totalLabel = isAr ? "المجموع" : "Total";
  const greeting = isAr ? "مرحبًا، أكّدت طلب:" : "Hello, I just confirmed an order:";

  const lines = cart.map(it => {
    const variant = [it.band, it.color].filter(Boolean).join(" / ");
    return `- ${it.name}${variant ? " (" + variant + ")" : ""} — ${Number(it.price).toLocaleString(isAr ? "ar-MA" : "en-US")} ${currency}`;
  });
  const text = `${greeting}\n${lines.join("\n")}\n\n${totalLabel}: ${cartTotal(cart).toLocaleString(isAr ? "ar-MA" : "en-US")} ${currency}`;
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
}

function debounceCart(fn, ms){
  let h;
  return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); };
}

/** يبني ويعرض محتوى نافذة السلة، ويربط نموذج التأكيد (مرة واحدة فقط) */
function renderCartDrawer(whatsappNumber){
  const cart = getCart();
  const list = document.getElementById("cart-items");
  const emptyMsg = document.getElementById("cart-empty");
  const totalEl = document.getElementById("cart-total");
  const form = document.getElementById("cart-checkout-form");
  const isAr = (typeof lang === "undefined") || lang === "ar";
  const currency = (typeof DICT !== "undefined" && DICT.currency) ? DICT.currency : (isAr ? "د.م." : "MAD");

  cartOrderSubmitted = false;

  if (!cart.length){
    list.innerHTML = "";
    emptyMsg.hidden = false;
    totalEl.textContent = "";
    form.hidden = true;
  } else {
    emptyMsg.hidden = true;
    form.hidden = false;
    form.reset();
    document.getElementById("cart-order-success").hidden = true;
    form.querySelectorAll("input, textarea, button[type=submit]").forEach(el => el.disabled = false);

    list.innerHTML = cart.map((it, i) => `
      <div class="cart-line">
        <div class="cart-line-info">
          <strong>${it.name}</strong>
          ${(it.band || it.color) ? `<div class="cart-line-variant">${[it.band, it.color].filter(Boolean).join(" / ")}</div>` : ""}
        </div>
        <div class="cart-line-price">${Number(it.price).toLocaleString(isAr ? "ar-MA" : "en-US")} ${currency}</div>
        <button type="button" class="cart-remove" data-i="${i}" aria-label="حذف">✕</button>
      </div>`).join("");
    totalEl.textContent = `${isAr ? "المجموع" : "Total"}: ${cartTotal(cart).toLocaleString(isAr ? "ar-MA" : "en-US")} ${currency}`;

    list.querySelectorAll(".cart-remove").forEach(btn => {
      btn.addEventListener("click", () => { removeFromCart(Number(btn.dataset.i)); renderCartDrawer(whatsappNumber); });
    });
  }

  document.getElementById("cart-overlay").classList.add("open");
  wireCartForm(whatsappNumber);
}

/** يسجّل (أو يحدّث) سلة مهجورة للسلة الحالية إذا كان الاسم والهاتف معبّأين */
async function saveCartAbandoned(form){
  if (cartOrderSubmitted) return;
  const cart = getCart();
  if (!cart.length) return;
  const name = form.customer_name.value.trim();
  const phone = form.phone.value.trim();
  if (!name || !phone) return;

  const entry = {
    product_id: null,
    product_name: cart.map(it => it.name).join("، "),
    band_type: null,
    color: null,
    customer_name: name,
    phone,
    city: form.city.value.trim(),
    address: form.address.value.trim(),
    last_field_filled: document.activeElement?.name || null
  };

  if (cartAbandonedId) return;
  cartAbandonedId = await logAbandonedCart(entry);
}

/** يربط أحداث نموذج تأكيد السلة مرة واحدة فقط (يتفادى تكرار الربط عند كل فتح) */
function wireCartForm(whatsappNumber){
  const form = document.getElementById("cart-checkout-form");
  if (form.dataset.wired) return;
  form.dataset.wired = "1";

  // حفظ مؤجَّل أثناء الكتابة المتواصلة
  form.addEventListener("input", debounceCart(() => saveCartAbandoned(form), 900));
  // حفظ فوري بمجرد مغادرة أي حقل تغيّرت قيمته (يلتقط حالة "غادر بسرعة")
  form.addEventListener("change", () => saveCartAbandoned(form));
  // حفظ فوري أيضًا إذا غادر الصفحة/أغلق التبويب وهو معبّي الحقول
  window.addEventListener("pagehide", () => saveCartAbandoned(form));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const cart = getCart();
    if (!cart.length) return;

    const name = form.customer_name.value.trim();
    const phone = form.phone.value.trim();
    const city = form.city.value.trim();
    const address = form.address.value.trim();

    const rows = cart.map(it => ({
      product_id: it.id,
      product_name: it.name,
      band_type: it.band || null,
      color: it.color || null,
      quantity: it.qty || 1,
      unit_price: it.price,
      customer_name: name,
      phone, city, address,
      notes: null
    }));

    const { error } = await sb.from("orders").insert(rows);
    if (error){ alert("خطأ: " + error.message); return; }

    cartOrderSubmitted = true;
    if (cartAbandonedId){ deleteAbandonedCart(cartAbandonedId); cartAbandonedId = null; }

    document.getElementById("cart-order-success").hidden = false;
    form.querySelectorAll("input, textarea, button[type=submit]").forEach(el => el.disabled = true);

    window.open(buildWhatsAppLink(cart, whatsappNumber), "_blank");
    saveCart([]);
    setTimeout(() => document.getElementById("cart-overlay").classList.remove("open"), 1800);
  });
}
