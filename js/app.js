(() => {
  "use strict";

  // Calls go through our own PHP proxy (server/redeem.php) because
  // coupon.netmarble.com does not allow cross-origin requests from github.io.
  const API = "https://online-multiservice.com/7k/redeem/api/redeem.php";
  const PAGE = "https://coupon.netmarble.com/tskgb";
  const CODES_URL = "https://online-multiservice.com/7k/redeem/data/codes.json";
  const BULK_DELAY_MS = 700;

  const $ = (id) => document.getElementById(id);
  const pidInput = $("pid");
  const pidError = $("pidError");
  const pidHint = $("pidHint");
  const listEl = $("codeList");
  const countEl = $("count");
  const allBtn = $("redeemAll");
  const toastEl = $("toast");

  // ---------- storage (safe in private mode) ----------
  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v === null ? fallback : v;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch {}
    },
  };

  let redeemed = (() => {
    try {
      const v = JSON.parse(store.get("redeemedCodes", "[]"));
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  })();

  let items = [];

  // ---------- helpers ----------
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const sanitizePID = (v) => v.toUpperCase().replace(/[^A-F0-9]/g, "").slice(0, 32);
  const validatePID = (pid) => /^[A-F0-9]{32}$/.test(pid);
  const isUsed = (code) => redeemed.includes(code);

  function markUsed(code) {
    if (!isUsed(code)) {
      redeemed.push(code);
      store.set("redeemedCodes", JSON.stringify(redeemed));
    }
  }

  function expireInfo(dateStr) {
    const expire = new Date(dateStr + "T23:59:59");
    const diff = expire - new Date();
    if (isNaN(diff) || diff <= 0) return { text: "หมดอายุแล้ว", urgent: true, expired: true };

    const hours = Math.floor(diff / 3600000);
    const d = String(expire.getDate()).padStart(2, "0");
    const m = String(expire.getMonth() + 1).padStart(2, "0");
    const date = `${d}/${m}/${expire.getFullYear()}`;

    if (hours < 24) return { text: `${date} (เหลือ ${hours} ชั่วโมง)`, urgent: true, expired: false };
    return { text: `${date} (เหลือ ${Math.ceil(hours / 24)} วัน)`, urgent: false, expired: false };
  }

  let toastTimer;
  function toast(message, type = "") {
    toastEl.textContent = message;
    toastEl.className = "show " + type;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toastEl.className = ""), 3500);
  }

  // ---------- UID field ----------
  function showPidError(msg) {
    pidInput.classList.add("is-invalid", "shake");
    pidError.textContent = msg;
    pidError.hidden = false;
    setTimeout(() => pidInput.classList.remove("shake"), 300);
    pidInput.focus();
  }

  function clearPidError() {
    pidInput.classList.remove("is-invalid", "shake");
    pidError.hidden = true;
  }

  function syncPidUi() {
    const pid = pidInput.value;
    if (validatePID(pid)) {
      pidHint.textContent = "UID ถูกต้อง กดรับโค้ดแล้วระบบจะเติมให้อัตโนมัติ UID เก็บไว้ในเครื่องคุณเท่านั้น";
    } else {
      pidHint.textContent = "ไม่กรอก UID ก็กดรับได้ ระบบจะเปิดหน้ารับโค้ดของ Netmarble ให้ UID เก็บไว้ในเครื่องคุณเท่านั้น";
    }
    allBtn.hidden = !(validatePID(pid) && items.length > 0);
  }

  pidInput.value = sanitizePID(store.get("pid", ""));
  pidInput.addEventListener("input", () => {
    pidInput.value = sanitizePID(pidInput.value);
    store.set("pid", pidInput.value);
    clearPidError();
    syncPidUi();
  });

  // ---------- redeem ----------
  function setState(item, state) {
    const b = item.btn;
    const used = state === "used";
    b.disabled = state === "busy";
    b.classList.toggle("busy", state === "busy");
    b.classList.toggle("used", used);
    item.el.classList.toggle("used", used);
    b.textContent = state === "busy" ? "กำลังรับ..." : used ? "✓ รับแล้ว" : "รับโค้ด";
  }

  const restState = (item) => setState(item, isUsed(item.code) ? "used" : "idle");

  // returns: "ok" | "fail" | "network" | "manual" | "invalid"
  async function redeemOne(item, silent = false) {
    const { code } = item;
    const pid = pidInput.value.trim();

    if (pid && !validatePID(pid)) {
      showPidError("กรุณากรอก UID ให้ถูกต้อง (32 ตัว ใช้ A–F และ 0–9)");
      return "invalid";
    }

    // no UID -> open Netmarble's own page
    if (!pid) {
      markUsed(code);
      setState(item, "used");
      window.open(`${PAGE}?code=${encodeURIComponent(code)}`, "_blank", "noopener");
      return "manual";
    }

    setState(item, "busy");
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ couponCode: code, pid }),
      });
      const data = await res.json();

      if (data && data.success) {
        markUsed(code);
        setState(item, "used");
        if (!silent) toast(`รับโค้ด ${code} สำเร็จ`, "ok");
        return "ok";
      }

      restState(item);
      console.warn("redeem failed", code, data);
      if (!silent) {
        const detail = data && data.errorMessage ? ` ${data.errorMessage}` : "";
        const codeNo = data && data.errorCode ? ` (${data.errorCode})` : "";
        toast(`รับโค้ด ${code} ไม่สำเร็จ${codeNo}${detail}`, "err");
      }
      return "fail";
    } catch (err) {
      // proxy unreachable / blocked / non-JSON response
      console.warn("redeem request error", err);
      restState(item);
      if (silent) return "network";

      markUsed(code);
      setState(item, "used");
      window.open(
        `${PAGE}?playerId=${encodeURIComponent(pid)}&code=${encodeURIComponent(code)}`,
        "_blank",
        "noopener"
      );
      toast("เชื่อมต่อระบบเติมอัตโนมัติไม่ได้ จึงเปิดหน้ารับโค้ดของ Netmarble แทน");
      return "manual";
    }
  }

  allBtn.addEventListener("click", async () => {
    const pid = pidInput.value.trim();
    if (!validatePID(pid)) {
      showPidError("กรอก UID ให้ถูกต้องก่อนกดรับทั้งหมด");
      return;
    }

    const pending = items.filter((i) => !isUsed(i.code));
    if (!pending.length) {
      toast("รับครบทุกโค้ดแล้ว");
      return;
    }

    allBtn.disabled = true;
    let ok = 0;
    let fail = 0;

    for (const item of pending) {
      const r = await redeemOne(item, true);
      if (r === "ok") ok++;
      else if (r === "network") {
        allBtn.disabled = false;
        toast("เชื่อมต่อระบบไม่ได้ ลองกดรับทีละโค้ดแทน", "err");
        return;
      } else fail++;
      await sleep(BULK_DELAY_MS);
    }

    allBtn.disabled = false;
    toast(`สำเร็จ ${ok} โค้ด${fail ? ` ไม่สำเร็จ ${fail} โค้ด` : ""}`, fail ? "" : "ok");
  });

  // ---------- render ----------
  function renderCard(c, info) {
    const el = document.createElement("article");
    el.className = "ticket" + (info.urgent ? " urgent" : "");

    const body = document.createElement("div");

    const codeBtn = document.createElement("button");
    codeBtn.type = "button";
    codeBtn.className = "code";
    codeBtn.textContent = c.code;
    codeBtn.title = "แตะเพื่อคัดลอกโค้ด";
    codeBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(c.code);
        toast(`คัดลอก ${c.code} แล้ว`, "ok");
      } catch {
        toast("คัดลอกไม่ได้ ลองกดค้างที่โค้ดแล้วคัดลอกเอง", "err");
      }
    });

    const reward = document.createElement("p");
    reward.className = "reward";
    reward.textContent = c.reward || "";

    const expire = document.createElement("p");
    expire.className = "expire";
    expire.textContent = `หมดอายุ ${info.text}`;

    body.append(codeBtn, reward, expire);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-redeem";

    el.append(body, btn);

    const item = { code: c.code, el, btn };
    btn.addEventListener("click", () => redeemOne(item));
    restState(item);
    return item;
  }

  function showNotice(html) {
    listEl.replaceChildren();
    const box = document.createElement("div");
    box.className = "notice";
    html(box);
    listEl.append(box);
    listEl.setAttribute("aria-busy", "false");
  }

  function showSkeleton() {
    listEl.replaceChildren();
    for (let i = 0; i < 3; i++) {
      const s = document.createElement("div");
      s.className = "ticket skeleton";
      listEl.append(s);
    }
    listEl.setAttribute("aria-busy", "true");
  }

  async function loadCodes() {
    showSkeleton();
    countEl.textContent = "";
    items = [];
    syncPidUi();

    try {
      const res = await fetch(CODES_URL, { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const codes = (Array.isArray(data.codes) ? data.codes : [])
        .map((c) => ({ c, info: expireInfo(c.expire) }))
        .filter(({ info }) => !info.expired)
        .sort((a, b) => new Date(a.c.expire) - new Date(b.c.expire));

      if (!codes.length) {
        showNotice((box) => {
          const p = document.createElement("p");
          p.textContent = "ตอนนี้ยังไม่มีโค้ดที่ใช้ได้ กลับมาดูใหม่เมื่อมีอีเวนต์";
          box.append(p);
        });
        return;
      }

      listEl.replaceChildren();
      items = codes.map(({ c, info }) => renderCard(c, info));
      items.forEach((i) => listEl.append(i.el));
      listEl.setAttribute("aria-busy", "false");
      countEl.textContent = `${items.length} โค้ด`;
      syncPidUi();
    } catch (err) {
      console.error("load codes failed", err);
      showNotice((box) => {
        const p = document.createElement("p");
        p.textContent = "โหลดรายการโค้ดไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่";
        const retry = document.createElement("button");
        retry.type = "button";
        retry.className = "btn-ghost";
        retry.textContent = "ลองใหม่";
        retry.addEventListener("click", loadCodes);
        box.append(p, retry);
      });
    }
  }

  syncPidUi();
  loadCodes();
})();
