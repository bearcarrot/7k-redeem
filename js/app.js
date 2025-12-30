const pidInput = document.getElementById("pid");
const codeList = document.getElementById("codeList");

// load PID
pidInput.value = localStorage.getItem("pid") || "";
pidInput.addEventListener("input", () => {
  localStorage.setItem("pid", pidInput.value.trim());
});

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
          <small>หมดอายุ: ${c.expire}</small>
          <button class="btn btn-redeem mt-2" data-code="${c.code}">
            <i class="fas ${used ? "fa-check text-success" : "fa-gift"}"></i>
            รับโค้ด
          </button>
        </div>
      `;

      codeList.appendChild(col);
    });

    document.querySelectorAll(".btn-redeem").forEach(btn => {
      btn.addEventListener("click", () => {
        const code = btn.dataset.code;
        const pid = pidInput.value.trim();

        if (!pid) {
          alert("กรุณากรอก Player ID");
          return;
        }

        // mark redeemed
        if (!redeemed.includes(code)) {
          redeemed.push(code);
          localStorage.setItem("redeemedCodes", JSON.stringify(redeemed));
          btn.querySelector("i").className = "fas fa-check";
        }

        const url = `https://coupon.netmarble.com/tskgb?playerId=${pid}&code=${code}`;
        window.open(url, "_blank");
      });
    });
  });
