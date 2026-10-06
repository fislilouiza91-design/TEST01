/* ═══════════════════════════════════════════════════════
   Smart Shopper — Background Service Worker
   Holds the last detected product per tab.
   ═══════════════════════════════════════════════════════ */

const tabProducts = new Map(); // tabId -> product

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const tabId = sender.tab?.id;

  if (msg.type === "PRODUCT_DETECTED" && tabId) {
    tabProducts.set(tabId, msg.product);
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