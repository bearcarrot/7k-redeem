const pidInput = document.getElementById("pid");
const pidError = document.getElementById("pidError");
const codeList = document.getElementById("codeList");

function getExpireText(dateStr) {
  const expire = new Date(dateStr + "T23:59:59");
  const now = new Date();

  const diffMs = expire - now;
  if (diffMs <= 0) return "หมดอายุแล้ว";

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  const d = expire.getDate().toString().padStart(2, "0");
  const m = (expire.getMonth() + 1).toString().padStart(2, "0");
  const y = expire.getFullYear();

  if (diffHours < 24) {
    return `${d}/${m}/${y} ( ${diffHours} ชั่วโมง )`;
  }

  const diffDays = Math.ceil(diffHours / 24);
  return `${d}/${m}/${y} ( ${diffDays} วัน )`;
}

// load PID
pidInput.value = localStorage.getItem("pid") || "";
pidInput.addEventListener("input", () => {
  localStorage.setItem("pid", pidInput.value.trim());
});

// input handler
pidInput.addEventListener("input", () => {
  pidInput.value = pidInput.value.toUpperCase().replace(/[^A-F0-9]/g, "");

  localStorage.setItem("pid", pidInput.value);

  pidInput.classList.remove("is-invalid", "shake");
  pidError.classList.add("d-none");
});

// validate function
function validatePID(pid) {
  return /^[A-F0-9]{32}$/.test(pid);
}

// load redeemed
let redeemed = JSON.parse(localStorage.getItem("redeemedCodes") || "[]");

fetch("data/codes.json")
  .then(r => r.json())
  .then(data => {
    const today = new Date();

    data.codes.forEach(c => {
      if (new Date(c.expire) < today) return;

      const used = redeemed.includes(c.code);

      const col = document.createElement("div");
      col.className = "col-12 col-md-6";

      col.innerHTML = `
        <div class="card p-3 h-100">
          <h5>${c.code}</h5>
          <p class="mb-1">${c.reward}</p>
          <small>หมดอายุ: ${getExpireText(c.expire)}</small>
          <button class="btn btn-redeem mt-2" data-code="${c.code}">
            <i class="fas ${used ? "fa-check text-success" : "fa-gift"}"></i>
            ${used ? "รับแล้ว" : "รับโค้ด"}
          </button>
        </div>
      `;

      codeList.appendChild(col);
    });

    document.querySelectorAll(".btn-redeem").forEach(btn => {
      btn.addEventListener("click", () => {
        const code = btn.dataset.code;
        const pid = pidInput.value.trim();

        if (!validatePID(pid)) {
          pidInput.classList.add("is-invalid", "shake");
          pidError.textContent = "กรุณากรอก UID ให้ถูกต้อง";
          pidError.classList.remove("d-none");

          // reset shake เพื่อให้สั่นซ้ำได้
          setTimeout(() => pidInput.classList.remove("shake"), 300);

          pidInput.focus();
          return;
        }

        // mark redeemed
        if (!redeemed.includes(code)) {
          redeemed.push(code);
          localStorage.setItem("redeemedCodes", JSON.stringify(redeemed));
          btn.querySelector("i").className = "fas fa-check text-success";
          btn.classList.add("used");
          btn.innerHTML = `<i class="fas fa-check text-success"></i> รับแล้ว`;
        }

        const url = `https://coupon.netmarble.com/tskgb?playerId=${pid}&code=${code}`;
        window.open(url, "_blank");
      });
    });
  });
