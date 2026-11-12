const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const CONFIG = State.get("config");
if (!State.get("matricula") || !CONFIG) { window.location.href = "index.html"; }

let CHAPAS = [];
let digitos = "";
let chapaSel = null;
let branco = false;
let erroCarga = "";   // mensagem exibida no lugar da chapa se o carregamento falhar

async function init() {
  $("escola").textContent = CONFIG.escola;
  $("ano").textContent = CONFIG.ano;
  $("kBranco").style.display = CONFIG.permiteBranco ? "" : "none";
  montarTeclado();

  if (sb) {
    try {
      const { data, error } = await sb.rpc("urn_dados_iniciais");
      if (error || !data) erroCarga = "Não foi possível carregar as chapas. Recarregue a página.";
      else if (!data.eleicao) erroCarga = "A votação não está aberta.";
      else CHAPAS = data.chapas || [];
    } catch (e) {
      console.error("urn_dados_iniciais:", e);
      erroCarga = "Sem conexão. Recarregue a página.";
    }
  } else {
    // Modo demonstração: só quando o Supabase NÃO está configurado
    CHAPAS = [
      { numero: "11", nome: "Voz Ativa", candidato: "Ana", integrantes: ["A", "B"], info: "", cor: "#1d4ed8" },
      { numero: "22", nome: "Novo Horizonte", candidato: "Rafael", integrantes: ["C"], info: "", cor: "#0f766e" },
      { numero: "33", nome: "União Estudantil", candidato: "Camila", integrantes: ["D"], info: "", cor: "#9333ea" },
    ];
  }
  render();
}

function montarTeclado() {
  const t = $("teclado");
  t.innerHTML = "";
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].forEach(n => {
    const b = document.createElement("button");
    b.type = "button";
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

  if (erroCarga) {
    v.innerHTML = `<div class="hint" style="color:var(--err)">${esc(erroCarga)}</div>`;
    ok.disabled = true;
    return;
  }
  if (branco) {
    v.innerHTML = `<div class="hint">VOTO EM BRANCO</div>`;
    ok.disabled = false;
    return;
  }
  if (digitos.length < CONFIG.digitos) {
    v.innerHTML = `<div class="hint">DIGITE O NÚMERO DA CHAPA</div>`;
    ok.disabled = true;
    return;
  }
  if (!chapaSel) {
    v.innerHTML = `<div class="hint" style="color:var(--err)">NÚMERO INVÁLIDO<br><small style="font-size:18px">Nenhuma chapa com este número. Pressione CORRIGE.</small></div>`;
    ok.disabled = true;
    return;
  }

  // Ficha da chapa: presidente + integrantes em mini blocos (js/chapa-view.js)
  v.innerHTML = renderChapaDetalhe(chapaSel);
  ok.disabled = false;
}

$("kCorrige").onclick = () => { digitos = ""; chapaSel = null; branco = false; render(); };
$("kBranco").onclick  = () => { digitos = ""; chapaSel = null; branco = true; render(); };

$("kConfirma").onclick = () => {
  if (erroCarga) return;
  if (!branco && !chapaSel) return;
  // Persiste escolha para a tela de confirmação
  State.set("digitos", digitos);
  State.set("branco", branco);
  State.set("chapa", chapaSel);
  window.location.href = "confirmar.html";
};

document.addEventListener("keydown", e => {
  if (/^\d$/.test(e.key)) digitar(e.key);
  else if (e.key === "Backspace") {
    if (branco) branco = false; else digitos = digitos.slice(0, -1);
    atualizar();
  }
  else if (e.key === "Delete" || e.key === "Escape") $("kCorrige").click();
  else if (e.key === "Enter" && !$("kConfirma").disabled) $("kConfirma").click();
});

init();