/* ═══════════════════════════════════════════════════════
   Smart Shopper — Background Service Worker
   Holds the last detected product per tab.
   + Sends detected products to Neon DB (via Cloudflare Worker).
   ═══════════════════════════════════════════════════════ */

const tabProducts = new Map(); // tabId -> product

// ⭐ رابط الـ Worker الخاص بقاعدة بيانات Neon
const DB_WORKER_URL = "https://cold-art-c5df.fisilouiza91.workers.dev/product";

// ⭐ منع إرسال نفس المنتج مرتين متتاليتين
let lastSentUrl = "";

/* ═══════════════════════════════════════════════════════
   ⭐ إرسال بيانات المنتج إلى قاعدة بيانات Neon
   ═══════════════════════════════════════════════════════ */
async function sendProductToDB(product) {
  if (!product || !product.url) return;

  // لا نرسل منتجات بدون سعر
  if (!product.price || product.price <= 0) {
    console.log("[Smart Shopper] تم تخطي الإرسال: السعر غير متوفر.");
    return;
  }

  // لا نرسل نفس المنتج مرتين على التوالي
  if (product.url === lastSentUrl) {
    console.log("[Smart Shopper] المنتج نفسه أُرسل مسبقاً، تم التخطي.");
    return;
  }

  lastSentUrl = product.url;

  try {
    const response = await fetch(DB_WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: product.url,
        title: product.title || "",
        price: product.price,
        currency: product.currency || "USD"
      })
    });

    const result = await response.json();
    console.log("✅ [Smart Shopper] تم حفظ المنتج في Neon:", result);
  } catch (error) {
    console.error("❌ [Smart Shopper] فشل حفظ المنتج في قاعدة البيانات:", error);
  }
}

/* ═══════════════════════════════════════════════════════
   📨 مستمع الرسائل
   ═══════════════════════════════════════════════════════ */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const tabId = sender.tab?.id;

  if (msg.type === "PRODUCT_DETECTED" && tabId) {
    tabProducts.set(tabId, msg.product);

    // ⭐ إرسال المنتج إلى قاعدة البيانات
    sendProductToDB(msg.product);

    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === "GET_CURRENT_PRODUCT") {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) return sendResponse({ ok: false, error: "No active tab" });

        // Cached
        if (tabProducts.has(tab.id)) {
          return sendResponse({ ok: true, product: tabProducts.get(tab.id) });
        }

        // Ask content script
        try {
          const res = await chrome.tabs.sendMessage(tab.id, { type: "GET_PRODUCT" });
          if (res?.ok) {
            tabProducts.set(tab.id, res.product);
            return sendResponse(res);
          }
          return sendResponse({ ok: false, error: res?.error || "Not on AliExpress product page" });
        } catch (e) {
          return sendResponse({ ok: false, error: "Content script not available on this page" });
        }
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }
});

// Clean up on tab close
chrome.tabs.onRemoved.addListener((tabId) => tabProducts.delete(tabId));