/* =====================================================================
   AURUM — سلة التسوق (مشتركة بين index.html و product.html)
   تُخزَّن محليًا فـ localStorage. زر "اطلب الآن" فالسلة كيبني رسالة
   واتساب جاهزة تلخّص كل المنتجات المختارة ويفتحها مباشرة.
   ===================================================================== */
const CART_KEY = "aurum_cart";

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
  const greeting = isAr ? "مرحبًا، أريد طلب:" : "Hello, I'd like to order:";

  const lines = cart.map(it => {
    const variant = [it.band, it.color].filter(Boolean).join(" / ");
    return `- ${it.name}${variant ? " (" + variant + ")" : ""} — ${Number(it.price).toLocaleString(isAr ? "ar-MA" : "en-US")} ${currency}`;
  });
  const text = `${greeting}\n${lines.join("\n")}\n\n${totalLabel}: ${cartTotal(cart).toLocaleString(isAr ? "ar-MA" : "en-US")} ${currency}`;
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
}

/** يبني ويعرض محتوى نافذة السلة — يتطلب عناصر cart-items/cart-empty/cart-total/cart-whatsapp-btn/cart-overlay فالصفحة */
function renderCartDrawer(whatsappNumber){
  const cart = getCart();
  const list = document.getElementById("cart-items");
  const emptyMsg = document.getElementById("cart-empty");
  const totalEl = document.getElementById("cart-total");
  const isAr = (typeof lang === "undefined") || lang === "ar";
  const currency = (typeof DICT !== "undefined" && DICT.currency) ? DICT.currency : (isAr ? "د.م." : "MAD");

  if (!cart.length){
    list.innerHTML = "";
    emptyMsg.hidden = false;
    totalEl.textContent = "";
  } else {
    emptyMsg.hidden = true;
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

  document.getElementById("cart-whatsapp-btn").href = buildWhatsAppLink(cart, whatsappNumber);
  document.getElementById("cart-overlay").classList.add("open");
}

