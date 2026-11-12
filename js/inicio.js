/* ============================================================
   inicio.js — tela inicial: lista as chapas e valida a matrícula
   Requer: config.js (sb), state.js (State), chapa-view.js (renderChapaCard)
   ============================================================ */

const $ = (id) => document.getElementById(id);

const MOTIVOS = {
  nao_encontrada: "Matrícula não encontrada. Confira o número e tente de novo.",
  ja_votou: "Seu voto já foi registrado. Obrigado por participar!",
  eleicao_fechada: "A votação não está aberta neste momento.",
};

// Usadas só quando o Supabase NÃO está configurado (modo demonstração)
const DEMO_CHAPAS = [
  { numero: "11", nome: "Voz Ativa", candidato: "Ana Beatriz Souza", cor: "#1d4ed8", foto: "",
    membros: [
      { cargo: "Presidente", nome: "Ana Beatriz Souza", turma: "3A" },
      { cargo: "Vice-Presidente", nome: "Pedro Lima", turma: "3A" },
      { cargo: "Secretário(a) Geral", nome: "Júlia Alves", turma: "2B" },
      { cargo: "Diretor(a) Financeiro", nome: "Caio Mendes", turma: "2B" },
    ] },
  { numero: "22", nome: "Novo Horizonte", candidato: "Rafael Costa", cor: "#0f766e", foto: "",
    membros: [
      { cargo: "Presidente", nome: "Rafael Costa", turma: "1C" },
      { cargo: "Vice-Presidente", nome: "Marina Rocha", turma: "1C" },
      { cargo: "Secretário(a) Geral", nome: "Lucas Pinto", turma: "3A" },
    ] },
  { numero: "33", nome: "União Estudantil", candidato: "Camila Ferreira", cor: "#9333ea", foto: "",
    membros: [
      { cargo: "Presidente", nome: "Camila Ferreira", turma: "2B" },
      { cargo: "Vice-Presidente", nome: "Bruno Dias", turma: "1C" },
      { cargo: "Secretário(a) Geral", nome: "Larissa Gomes", turma: "3A" },
      { cargo: "Diretor(a) Social", nome: "Tiago Nunes", turma: "2B" },
    ] },
];

let bloqueado = false;   // true = votação fechada ou falha ao carregar

// Ao entrar na tela inicial, limpa o estado de uma votação anterior
State.limparVoto();

function aviso(texto, erro = false) {
  const m = $("msgMat");
  m.className = "msg" + (erro ? " err" : "");
  m.textContent = texto;
}

function bloquear(textoLista) {
  bloqueado = true;
  $("btnIniciar").disabled = true;
  $("listaChapas").innerHTML = `<p class="msg err">${textoLista}</p>`;
}

async function init() {
  let cfg = { escola_nome: "Escola", volta_inicio_seg: 6 };
  let el = { ano: "", digitos: 2, permite_branco: true };
  let chapas = DEMO_CHAPAS;

  if (sb) {
    try {
      const { data, error } = await sb.rpc("urn_dados_iniciais");
      if (error || !data) throw (error || new Error("resposta vazia"));
      cfg = data.config || cfg;
      chapas = data.chapas || [];
      if (data.eleicao) el = data.eleicao;
      else bloquear("A votação não está aberta neste momento.");
    } catch (e) {
      console.error("urn_dados_iniciais:", e);
      bloquear("Não foi possível carregar as chapas. Recarregue a página.");
      return;
    }
    State.set("config", {
      escola: cfg.escola_nome,
      ano: el.ano ?? "",
      digitos: el.digitos ?? 2,
      permiteBranco: el.permite_branco ?? true,
      voltaInicioSeg: cfg.volta_inicio_seg ?? 6,
    });
  } else {
    State.set("config", { escola: "CEMSO", ano: 2026, digitos: 2, permiteBranco: true, voltaInicioSeg: 6 });
  }

  const conf = State.get("config");
  $("escola").textContent = conf.escola;
  $("ano").textContent = conf.ano;

  if (bloqueado) return;   // o aviso já está na tela

  $("listaChapas").innerHTML = chapas.length
    ? chapas.map(renderChapaCard).join("")
    : `<p class="sub">Nenhuma chapa cadastrada.</p>`;
}

$("mat").addEventListener("input", (e) => {
  e.target.value = e.target.value.replace(/\D/g, "");
  aviso("");
});
$("mat").addEventListener("keydown", (e) => { if (e.key === "Enter") iniciar(); });
$("btnIniciar").onclick = iniciar;

async function iniciar() {
  if (bloqueado) return;
  const m = $("mat").value.trim();
  if (m.length < 3) { aviso("Digite sua matrícula.", true); return; }

  $("btnIniciar").disabled = true;
  aviso("Verificando…");
  try {
    let r;
    if (sb) {
      const { data, error } = await sb.rpc("urn_validar_matricula", { p_matricula: m });
      if (error) throw error;
      r = data;
    } else {
      r = (m === "000000") ? { ok: false, motivo: "nao_encontrada" }
        : (m === "111111") ? { ok: false, motivo: "ja_votou" } : { ok: true };
    }

    if (!r.ok) { aviso(MOTIVOS[r.motivo] || "Não foi possível validar.", true); return; }

    State.set("matricula", m);
    State.set("chave", crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
    window.location.href = "voto.html";
  } catch (e) {
    console.error(e);
    aviso("Falha de conexão. Tente novamente.", true);
  } finally {
    $("btnIniciar").disabled = bloqueado;
  }
}

init();