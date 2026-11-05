const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g,
  (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

const CONFIG = State.get("config");
if (!State.get("matricula") || !CONFIG) { window.location.href = "index.html"; }

let CHAPAS = [];
let digitos = "";
let chapaSel = null;
let branco = false;

const bannerHTML = (c) => `<div class="banner" style="background-image:${
  c.foto ? `url('${esc(c.foto)}')` : `linear-gradient(135deg,${esc(c.cor)},#14213d)`
}"><span class="n">${esc(c.numero)}</span></div>`;

async function init() {
  $("escola").textContent = CONFIG.escola;
  $("ano").textContent = CONFIG.ano;
  $("kBranco").style.display = CONFIG.permiteBranco ? "" : "none";
  montarTeclado();

  if (sb) {
    const { data, error } = await sb.rpc("urn_dados_iniciais");
    if (!error) CHAPAS = data.chapas || [];
  }
  if (CHAPAS.length === 0) {
    CHAPAS = [
      {numero:"11",nome:"Voz Ativa",candidato:"Ana",integrantes:["A","B"],info:"",foto:"",cor:"#1d4ed8"},
      {numero:"22",nome:"Novo Horizonte",candidato:"Rafael",integrantes:["C"],info:"",foto:"",cor:"#0f766e"},
      {numero:"33",nome:"União Estudantil",candidato:"Camila",integrantes:["D"],info:"",foto:"",cor:"#9333ea"},
    ];
  }
  render();
}

function montarTeclado() {
  const t = $("teclado"); t.innerHTML = "";
  [1,2,3,4,5,6,7,8,9,0].forEach(n => {
    const b = document.createElement("button");
    b.className = "k" + (n === 0 ? " z" : "");
    b.textContent = n;
    b.setAttribute("aria-label", "Número " + n);
    b.onclick = () => digitar(String(n));
    t.appendChild(b);
  });
}

function digitar(d) {
  if (branco || digitos.length >= CONFIG.digitos) return;
  digitos += d;
  beepTecla();
  atualizar();
}

function atualizar() {
  chapaSel = null;
  if (digitos.length === CONFIG.digitos) {
    chapaSel = CHAPAS.find(c => c.numero === digitos) || null;
  }
  render();
}

function render() {
  let h = "";
  for (let i = 0; i < CONFIG.digitos; i++) {
    h += `<div class="digit${i === digitos.length && !branco ? " cur" : ""}">${esc(digitos[i] || "")}</div>`;
  }
  $("digits").innerHTML = h;

  const v = $("chapaView"), ok = $("kConfirma");
  if (branco) { v.innerHTML = `<div class="hint">VOTO EM BRANCO</div>`; ok.disabled = false; return; }
  if (digitos.length < CONFIG.digitos) { v.innerHTML = `<div class="hint">DIGITE O NÚMERO DA CHAPA</div>`; ok.disabled = true; return; }
  if (!chapaSel) {
    v.innerHTML = `<div class="hint" style="color:var(--err)">NÚMERO INVÁLIDO<br><small style="font-size:18px">Nenhuma chapa com este número. Pressione CORRIGE.</small></div>`;
    ok.disabled = true; return;
  }
  const c = chapaSel;
  v.innerHTML = `<div class="detail">${bannerHTML(c)}
    <div class="info">
      <div class="tag">Chapa</div>
      <h2>${esc(c.nome)}</h2>
      <p><b>Candidato:</b> ${esc(c.candidato)}</p>
      <p><b>Integrantes:</b> ${esc((c.integrantes||[]).join(", "))}</p>
      <p class="tag">${esc(c.info)}</p>
    </div></div>`;
  ok.disabled = false;
}

$("kCorrige").onclick = () => { digitos = ""; chapaSel = null; branco = false; render(); };
$("kBranco").onclick  = () => { digitos = ""; chapaSel = null; branco = true; render(); };

$("kConfirma").onclick = () => {
  if (!branco && !chapaSel) return;
  // Persiste escolha para a tela de confirmação
  State.set("digitos", digitos);
  State.set("branco", branco);
  State.set("chapa", chapaSel);
  window.location.href = "confirmar.html";
};

document.addEventListener("keydown", e => {
  if (/^\d$/.test(e.key)) digitar(e.key);
  else if (e.key === "Backspace") { if (branco) branco = false; else digitos = digitos.slice(0, -1); atualizar(); }
  else if (e.key === "Delete" || e.key === "Escape") $("kCorrige").click();
  else if (e.key === "Enter" && !$("kConfirma").disabled) $("kConfirma").click();
});

init();