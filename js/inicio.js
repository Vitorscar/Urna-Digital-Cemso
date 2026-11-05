const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g,
  (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

const MOTIVOS = {
  nao_encontrada: "Matrícula não encontrada. Confira o número e tente de novo.",
  ja_votou: "Seu voto já foi registrado. Obrigado por participar!",
  eleicao_fechada: "A votação não está aberta neste momento.",
};

const DEMO_CHAPAS = [
 {numero:"11",nome:"Voz Ativa",candidato:"Ana Beatriz Souza",integrantes:["Pedro Lima","Júlia Alves","Caio Mendes"],info:"Mais eventos culturais e esportivos.",foto:"",cor:"#1d4ed8"},
 {numero:"22",nome:"Novo Horizonte",candidato:"Rafael Costa",integrantes:["Marina Rocha","Lucas Pinto"],info:"Biblioteca aberta no contraturno.",foto:"",cor:"#0f766e"},
 {numero:"33",nome:"União Estudantil",candidato:"Camila Ferreira",integrantes:["Bruno Dias","Larissa Gomes","Tiago Nunes"],info:"Grêmio mais perto dos alunos.",foto:"",cor:"#9333ea"},
];

const bannerHTML = (c) => `<div class="banner" style="background-image:${
  c.foto ? `url('${esc(c.foto)}')` : `linear-gradient(135deg,${esc(c.cor)},#14213d)`
}"><span class="n">${esc(c.numero)}</span></div>`;

// Ao entrar na tela inicial, limpa estado de votação anterior
State.limparVoto();

async function init() {
  let cfg = { escola_nome:"Escola", ano:"", digitos:2, permite_branco:true, volta_inicio_seg:6 };
  let chapas = DEMO_CHAPAS;

  if (sb) {
    const { data, error } = await sb.rpc("urn_dados_iniciais");
    if (error) { $("msgMat").textContent = "Erro: " + error.message; $("msgMat").classList.add("err"); return; }
    cfg = data.config || cfg;
    const el = data.eleicao || {};
    chapas = data.chapas || [];
    State.set("config", {
      escola: cfg.escola_nome,
      ano: el.ano ?? "",
      digitos: el.digitos ?? 2,
      permiteBranco: el.permite_branco ?? true,
      voltaInicioSeg: cfg.volta_inicio_seg ?? 6,
    });
  } else {
    State.set("config", { escola:"CEMSO", ano:2026, digitos:2, permiteBranco:true, voltaInicioSeg:6 });
  }

  const conf = State.get("config");
  $("escola").textContent = conf.escola;
  $("ano").textContent = conf.ano;

  $("listaChapas").innerHTML = chapas.map(c =>
    `<article class="card">${bannerHTML(c)}
       <div class="bd">
         <h3>${esc(c.nome)}</h3>
         <p><b>${esc(c.candidato)}</b></p>
         <p>${esc((c.integrantes||[]).join(", "))}</p>
       </div>
     </article>`).join("");
}

$("mat").addEventListener("input", e => { e.target.value = e.target.value.replace(/\D/g,""); $("msgMat").textContent = ""; });
$("mat").addEventListener("keydown", e => { if (e.key === "Enter") iniciar(); });
$("btnIniciar").onclick = iniciar;

async function iniciar() {
  const m = $("mat").value.trim(), msg = $("msgMat");
  msg.className = "msg";
  if (m.length < 3) { msg.textContent = "Digite sua matrícula."; msg.classList.add("err"); return; }

  $("btnIniciar").disabled = true; msg.textContent = "Verificando…";
  try {
    let r;
    if (sb) {
      const { data, error } = await sb.rpc("urn_validar_matricula", { p_matricula: m });
      if (error) throw error;
      r = data;
    } else {
      r = (m === "000000") ? {ok:false,motivo:"nao_encontrada"}
        : (m === "111111") ? {ok:false,motivo:"ja_votou"} : {ok:true};
    }

    if (!r.ok) { msg.textContent = MOTIVOS[r.motivo] || "Não foi possível validar."; msg.classList.add("err"); return; }

    State.set("matricula", m);
    State.set("chave", crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
    window.location.href = "voto.html";
  } catch (e) {
    msg.textContent = "Falha de conexão. Tente novamente."; msg.classList.add("err");
    console.error(e);
  } finally {
    $("btnIniciar").disabled = false;
  }
}

init();