/* =====================================================================
   AURUM — طبقة الترجمة (i18n)
   تحمّل data-ar.json / data-en.json وتطبّقها على أي عنصر يحمل
   data-i18n (نص) أو data-i18n-ph (placeholder). مشتركة بين كل صفحات الموقع.
   ملاحظة: fetch() لملف JSON محلي يتطلب تصفّح الموقع عبر خادم حقيقي
   (Vercel، أو أي dev server) وليس بفتح الملف مباشرة من الجهاز (file://).
   ===================================================================== */
let DICT = {};

async function loadI18n(lang){
  try{
    const res = await fetch(`data-${lang}.json`);
    DICT = await res.json();
  }catch(e){
    console.warn("[i18n] تعذّر تحميل ملف الترجمة:", e);
    DICT = {};
  }
  return DICT;
}

/** يستبدل اسم المتجر الافتراضي باسم site_settings الحقيقي إن وُجد */
function applyBrandOverride(settings, lang){
  if (!settings) return;
  const name = lang === "ar" ? settings.store_name_ar : settings.store_name_en;
  if (name) DICT.brand = name;
}

/** يطبّق القاموس الحالي على كل عناصر الصفحة (نص + placeholder) + اتجاه RTL/LTR */
function applyStaticI18n(lang){
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  const langLabel = document.getElementById("lang-label");
  if (langLabel) langLabel.textContent = lang === "ar" ? "EN" : "AR";

  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (DICT[key]) el.innerHTML = DICT[key].replace("{brand}", DICT.brand || "");
  });
  document.querySelectorAll("[data-i18n-ph]").forEach(el => {
    const key = el.getAttribute("data-i18n-ph");
    if (DICT[key]) el.setAttribute("placeholder", DICT[key]);
  });
}
