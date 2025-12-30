const ADMIN_PASS = "bearcarrot";
const pass = prompt("lvcr270319");

if (pass !== ADMIN_PASS) {
  location.href = "./";
}

let codes = [];

fetch("data/codes.json")
  .then(r => r.json())
  .then(data => {
    codes = data.codes || [];
    render();
  });

function render() {
  const tbody = document.getElementById("codeTable");
  tbody.innerHTML = "";

  const now = new Date();

  codes.forEach((c, i) => {
    const exp = new Date(c.expire);
    const expired = exp < now;

    tbody.innerHTML += `
      <tr>
        <td><strong>${c.code}</strong></td>
        <td>${c.reward}</td>
        <td>${formatDate(exp)}</td>
        <td>
          ${expired
            ? `<span class="badge bg-danger">หมดอายุ</span>`
            : `<span class="badge bg-success">ใช้งานได้</span>`}
        </td>
        <td>
          <button class="btn btn-sm btn-warning" onclick="editCode(${i})">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-sm btn-danger" onclick="deleteCode(${i})">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  });
}

function addCode() {
  const code = document.getElementById("code").value.trim().toUpperCase();
  const reward = document.getElementById("reward").value.trim();
  const expire = document.getElementById("expire").value;

  if (!code || !reward || !expire) return alert("กรอกข้อมูลให้ครบ");

  codes.push({
    code,
    reward,
    expire: expire + "T23:59:59"
  });

  render();
}

function deleteCode(i) {
  if (!confirm("ลบโค้ดนี้?")) return;
  codes.splice(i, 1);
  render();
}

function editCode(i) {
  const c = codes[i];
  document.getElementById("code").value = c.code;
  document.getElementById("reward").value = c.reward;
  document.getElementById("expire").value = c.expire.split("T")[0];
  codes.splice(i, 1);
  render();
}

function exportJSON() {
  const blob = new Blob(
    [JSON.stringify({ codes }, null, 2)],
    { type: "application/json" }
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "codes.json";
  a.click();
}

function formatDate(d) {
  return d.toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}