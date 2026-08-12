/* =====================================================================
   AURUM — طبقة الاتصال بـ Supabase
   يُستعمل من index.html (ولاحقًا product.html) لقراءة البيانات الحقيقية.
   المفتاح المستعمل هنا هو anon key العام — مسموح له فقط بالقراءة وبعض
   عمليات الإضافة (زيارات، طلبات، تعليقات) حسب سياسات RLS في supabase-schema.sql.
   الكتابة/التعديل/الحذف الكامل محجوزة على service_role في لوحة التحكم فقط.
   ===================================================================== */

const SUPABASE_URL = "https://wbinkivrwtlgrdswrklo.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndiaW5raXZyd3RsZ3Jkc3dya2xvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMjM1NTYsImV4cCI6MjA5MDc5OTU1Nn0.7frD9MYWWUtRqnuNTb9uThP4H2NRy8eMW_YUXtxlg6Q";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/** يقرأ صف الإعدادات الوحيد (اسم المتجر، الشعار، الوضع الافتراضي) */
async function fetchSiteSettings(){
  const { data, error } = await sb.from("site_settings").select("*").eq("id", 1).single();
  if (error){ console.warn("[site_settings]", error.message); return null; }
  return data;
}

/** يقرأ المنتجات النشطة فقط، مرتبة حسب sort_order */
async function fetchActiveProducts(){
  const { data, error } = await sb
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error){ console.warn("[products]", error.message); return []; }
  return data || [];
}

/** يقرأ منتجًا واحدًا حسب id */
async function fetchProductById(id){
  const { data, error } = await sb.from("products").select("*").eq("id", id).eq("is_active", true).single();
  if (error){ console.warn("[product]", error.message); return null; }
  return data;
}

/** يقرأ منتجات أخرى (للكاروسيل) باستثناء المنتج الحالي */
async function fetchOtherProducts(excludeId, limit = 8){
  const { data, error } = await sb
    .from("products")
    .select("*")
    .eq("is_active", true)
    .neq("id", excludeId)
    .order("sort_order", { ascending: true })
    .limit(limit);
  if (error){ console.warn("[other products]", error.message); return []; }
  return data || [];
}

/** يقرأ التقييمات المعتمدة لمنتج معيّن */
async function fetchReviews(productId){
  const { data, error } = await sb
    .from("reviews")
    .select("*")
    .eq("product_id", productId)
    .eq("is_approved", true)
    .order("created_at", { ascending: false });
  if (error){ console.warn("[reviews]", error.message); return []; }
  return data || [];
}

/** يضيف تقييم/تعليق جديد من عميل، ويحدّث تلقائيًا معدّل تقييم المنتج وعدد التعليقات */
async function insertReview({ product_id, customer_name, rating, comment }){
  const { error } = await sb.from("reviews").insert({ product_id, customer_name, rating, comment });
  if (error){ console.warn("[insertReview]", error.message); return false; }
  await sb.rpc("recalculate_product_rating", { p_id: product_id });
  return true;
}

/** يسجل طلبًا مؤكَّدًا */
async function insertOrder(order){
  const { error } = await sb.from("orders").insert(order);
  if (error){ console.warn("[insertOrder]", error.message); return false; }
  return true;
}

/** يسجل استمارة عبّأها زائر ولم يؤكد الطلب بعد، ويعيد id الصف المُنشأ */
async function logAbandonedCart(entry){
  const { data, error } = await sb.from("abandoned_carts").insert(entry).select("id").single();
  if (error){ console.warn("[logAbandonedCart]", error.message); return null; }
  return data?.id || null;
}

/** يحذف صف الاستمارة المتروكة بعد ما العميل أكّد الطلب فعليًا */
async function deleteAbandonedCart(id){
  if (!id) return;
  try{ await sb.from("abandoned_carts").delete().eq("id", id); }
  catch(e){ console.warn("[deleteAbandonedCart]", e); }
}

/** يقرأ أزرار الفوتر الظاهرة (سياسات/من نحن...) مرتبة حسب sort_order —
    هذا ما يجعل إضافة/حذف زر من اللوحة ينعكس مباشرة على الموقع */
async function fetchFooterContent(){
  const { data, error } = await sb
    .from("footer_content")
    .select("*")
    .eq("is_visible", true)
    .order("sort_order", { ascending: true });
  if (error){ console.warn("[footer_content]", error.message); return []; }
  return data || [];
}

/** يسجل زيارة (صفحة رئيسية أو صفحة منتج) مع معرّف زائر مجهول ثابت */
async function logVisit(page, productId = null){
  try{
    let visitorId = localStorage.getItem("aurum_visitor_id");
    if (!visitorId){
      visitorId = crypto.randomUUID();
      localStorage.setItem("aurum_visitor_id", visitorId);
    }
    const { error } = await sb.from("visits").insert({
      page,
      product_id: productId,
      visitor_id: visitorId,
      referrer: document.referrer || null
    });
    if (error) console.warn("[logVisit]", error.message);
  }catch(e){
    console.warn("[logVisit]", e);
  }
}
