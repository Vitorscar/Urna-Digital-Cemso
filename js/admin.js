/* ============================================================
   admin.js — painel administrativo da urna
   Requer: js/config.js (define `sb`) e migracao_turno.sql aplicada
   ============================================================ */

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let eleicaoAtual = null;
let eleitoresCache = [];
let chapasCache = [];

const MOTIVOS = {
  nao_autorizado:      "Sem permissão. Faça login novamente.",
  sem_eleicao:         "Nenhuma eleição cadastrada.",
  numero_duplicado:    "Já existe uma chapa com esse número.",
  matricula_duplicada: "Já existe um eleitor com essa matrícula.",
  tem_votos:           "Essa chapa já recebeu votos e não pode ser excluída.",
  membros_invalidos:   "Dados dos cargos inválidos.",
};

const TURNOS = ["Matutino", "Vespertino", "Noturno"];

/* ─────────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────────── */

// Chama uma RPC e LANÇA erro em português se falhar (rede, SQL ou ok:false)
async function rpc(nome, args) {
  const { data, error } = await sb.rpc(nome, args);
  if (error) throw new Error(error.message);
  if (data && data.ok === false) throw new Error(MOTIVOS[data.motivo] || data.motivo || "erro desconhecido");
  return data;
}

// Desabilita o botão durante a operação; mostra erro via alert; reabilita sempre
async function acao(btn, fn) {
  if (btn) btn.disabled = true;
  try {
    await fn();
  } catch (e) {
    console.error(e);
    alert("Erro: " + (e.message || e));
  } finally {
    if (btn) btn.disabled = false;
  }
}

function debounce(fn, ms = 300) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function selectTurno(valor) {
  const v = valor || "";
  const extra = v && !TURNOS.includes(v) ? `<option selected>${esc(v)}</option>` : "";
  return `<select id="feTurno">
    <option value="">— selecione —</option>
    ${TURNOS.map(t => `<option${t === v ? " selected" : ""}>${t}</option>`).join("")}
    ${extra}
  </select>`;
}

// "M", "mat", "matutino" → "Matutino" etc. Outros valores ficam como vieram.
function normalizarTurno(t) {
  const s = String(t || "").trim();
  if (!s) return "";
  const c = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (c.startsWith("m")) return "Matutino";
  if (c.startsWith("v")) return "Vespertino";
  if (c.startsWith("n")) return "Noturno";
  return s;
}

/* ─────────────────────────────────────────────
   AUTENTICAÇÃO
   ───────────────────────────────────────────── */
async function checarSessao() {
  if (!sb) {
    $("msgLogin").textContent = "Supabase não configurado. Edite js/config.js com URL e anon key.";
    $("msgLogin").classList.add("err");
    $("btnEntrar").disabled = true;
    return;
  }
  try {
    const { data } = await sb.auth.getSession();
    if (data?.session) mostrarDashboard(data.session.user.email);
  } catch (e) {
    console.error("checarSessao:", e);
    $("msgLogin").textContent = "Erro ao verificar sessão. Recarregue a página.";
    $("msgLogin").classList.add("err");
  }
}

async function entrar() {
  const email = $("email").value.trim();
  const senha = $("senha").value;
  const msg = $("msgLogin");
  const btn = $("btnEntrar");

  msg.className = "msg"; msg.textContent = "";

  if (!sb) { msg.textContent = "Supabase não configurado."; msg.classList.add("err"); return; }
  if (!email || !senha) { msg.textContent = "Preencha e-mail e senha."; msg.classList.add("err"); return; }

  btn.disabled = true;
  msg.textContent = "Entrando…";
  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password: senha });
    if (error || !data?.user) {
      msg.textContent = "E-mail ou senha inválidos.";
      msg.classList.add("err");
      return;
    }
    msg.textContent = "";
    mostrarDashboard(data.user.email);
  } catch (e) {
    console.error("entrar:", e);
    msg.textContent = "Erro de conexão. Verifique a URL do Supabase.";
    msg.classList.add("err");
  } finally {
    btn.disabled = false;
  }
}

async function sair() {
  try { await sb.auth.signOut(); } catch (e) { console.error(e); }
  $("telaLogin").hidden = false;
  $("dashboard").hidden = true;
  $("msgLogin").textContent = "";
  $("msgLogin").className = "msg";
}

function mostrarDashboard(email) {
  $("telaLogin").hidden = true;
  $("dashboard").hidden = false;
  $("adminEmail").textContent = email;
  carregarEleicao();
}

$("btnEntrar").onclick = entrar;
$("senha").addEventListener("keydown", e => { if (e.key === "Enter") entrar(); });
$("btnSair").onclick = sair;

/* ─────────────────────────────────────────────
   TABS
   ───────────────────────────────────────────── */
document.querySelectorAll(".tab").forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("ativo"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("ativo"));
    tab.classList.add("ativo");
    $(`tab-${tab.dataset.tab}`).classList.add("ativo");
    if (tab.dataset.tab === "chapas")    carregarChapas();
    if (tab.dataset.tab === "eleitores") carregarEleitores($("buscaEleitor").value.trim());
    if (tab.dataset.tab === "apuracao")  carregarApuracao();
  };
});

/* ─────────────────────────────────────────────
   ABA ELEIÇÃO
   ───────────────────────────────────────────── */
async function carregarEleicao() {
  try {
    const data = await rpc("admin_eleicao_atual");
    eleicaoAtual = data.eleicao;
    $("infoNome").textContent = eleicaoAtual.nome;
    $("infoAno").textContent = eleicaoAtual.ano;
    $("infoDigitos").textContent = eleicaoAtual.digitos;

    const st = $("statusEleicao");
    st.textContent = eleicaoAtual.aberta ? "ABERTA" : "FECHADA";
    st.className = "status" + (eleicaoAtual.aberta ? "" : " fechada");

    const btn = $("btnToggle");
    btn.disabled = false;
    btn.textContent = eleicaoAtual.aberta ? "FECHAR votação" : "ABRIR votação";
    btn.className = "btn" + (eleicaoAtual.aberta ? " warn" : "");
  } catch (e) {
    console.error("carregarEleicao:", e);
    $("statusEleicao").textContent = "Erro ao carregar";
    $("statusEleicao").className = "status fechada";
    $("btnToggle").disabled = true;
  }
}

$("btnToggle").onclick = () => acao($("btnToggle"), async () => {
  if (!eleicaoAtual) { alert("Eleição ainda não carregada. Recarregue a página."); return; }
  await rpc("admin_toggle_eleicao", { p_aberta: !eleicaoAtual.aberta });
  await carregarEleicao();
});

/* ─────────────────────────────────────────────
   ABA CHAPAS  (um bloco por cargo: nome + turma)
   ───────────────────────────────────────────── */
const CARGOS = [
  "Presidente",
  "Vice-Presidente",
  "Secretário(a) Geral",
  "Diretor(a) Financeiro",
  "Diretor(a) Social",
  "Diretor(a) Cultural",
  "Diretor(a) de Imprensa e Comunicação",
  "Diretor(a) de Esporte",
  "Diretor(a) de Meio Ambiente e Saúde",
  "Diretor(a) de Relações Estudantis",
];
// true = todos os cargos exigem nome e turma. false = só o Presidente é obrigatório.
const EXIGIR_TODOS = true;

// Lê os membros da chapa; chapas antigas (sem `membros`) mostram só o candidato como Presidente
function membrosDaChapa(c) {
  if (Array.isArray(c?.membros) && c.membros.length) return c.membros;
  return c?.candidato ? [{ cargo: CARGOS[0], nome: c.candidato, turma: "" }] : [];
}

async function carregarChapas() {
  try {
    const data = await rpc("admin_listar_chapas");
    chapasCache = data.chapas || [];
    $("tblChapas").innerHTML = chapasCache.length === 0
      ? `<tr><td colspan="5" style="text-align:center;color:var(--mut)">Nenhuma chapa cadastrada.</td></tr>`
      : chapasCache.map(c => {
          const m = membrosDaChapa(c).filter(x => x.nome);
          const detalhe = m.map(x => `${x.cargo}: ${x.nome}${x.turma ? ` (${x.turma})` : ""}`).join("\n");
          return `
        <tr>
          <td><b>${esc(c.numero)}</b></td>
          <td>${esc(c.nome)}</td>
          <td>${esc(c.candidato)}</td>
          <td title="${esc(detalhe)}">${m.length} de ${CARGOS.length} cargos</td>
          <td class="acoes-cel">
            <button data-acao="editar" data-id="${c.id}">Editar</button>
            <button data-acao="excluir" data-id="${c.id}">Excluir</button>
          </td>
        </tr>`;
        }).join("");
  } catch (e) {
    console.error("carregarChapas:", e);
    $("tblChapas").innerHTML =
      `<tr><td colspan="5" style="text-align:center;color:var(--err)">Erro ao carregar: ${esc(e.message)}</td></tr>`;
  }
}

$("tblChapas").addEventListener("click", (ev) => {
  const b = ev.target.closest("button[data-acao]");
  if (!b) return;
  const id = Number(b.dataset.id);
  if (b.dataset.acao === "editar") {
    const c = chapasCache.find(x => x.id === id);
    c ? abrirModalChapa(c) : alert("Chapa não encontrada. Recarregue a lista.");
  }
  if (b.dataset.acao === "excluir") excluirChapa(b, id);
});

$("btnNovaChapa").onclick = () => abrirModalChapa(null);

function abrirModalChapa(chapa) {
  const editando = !!chapa;
  const porCargo = Object.fromEntries(membrosDaChapa(chapa).map(m => [m.cargo, m]));

  const blocos = CARGOS.map((cargo, i) => {
    const m = porCargo[cargo] || {};
    return `
    <div class="cargo-bloco">
      <label><b>${esc(cargo.toUpperCase())}</b></label>
      <div class="cargo-linha">
        <input id="fcNome${i}"  placeholder="Nome"  value="${esc(m.nome || "")}" >
        <input id="fcTurma${i}" placeholder="Turma" value="${esc(m.turma || "")}">
      </div>
    </div>`;
  }).join("");

  $("modalTitulo").textContent = editando ? "Editar chapa" : "Nova chapa";
  $("modalCorpo").innerHTML = `
    <label>Número</label>
    <input id="fcNumero" maxlength="4" value="${esc(chapa?.numero || "")}">
    <label>Nome da chapa</label>
    <input id="fcNome" value="${esc(chapa?.nome || "")}">
    <label>Proposta (opcional)</label>
    <textarea id="fcInfo">${esc(chapa?.info || "")}</textarea>
    <label>Cor (hex)</label>
    <input id="fcCor" value="${esc(chapa?.cor || "#1d4ed8")}">
    <hr class="modal-sep">
    ${blocos}
  `;
  $("modalOk").onclick = () => salvarChapa(chapa?.id ?? null);
  abrirModal();
}

function lerFormChapa() {
  const numero = $("fcNumero").value.trim();
  const nome   = $("fcNome").value.trim();
  const cor    = $("fcCor").value.trim() || "#1d4ed8";

  if (!numero || !nome) throw new Error("Preencha o número e o nome da chapa.");
  if (!/^\d+$/.test(numero)) throw new Error("O número da chapa deve conter apenas dígitos.");
  if (!/^#[0-9a-fA-F]{6}$/.test(cor)) throw new Error("Cor inválida. Use o formato #RRGGBB.");

  const membros = CARGOS.map((cargo, i) => ({
    cargo,
    nome:  $(`fcNome${i}`).value.trim(),
    turma: $(`fcTurma${i}`).value.trim(),
  }));

  membros.forEach((m, i) => {
    const obrigatorio = EXIGIR_TODOS || i === 0;
    if (obrigatorio && (!m.nome || !m.turma)) {
      throw new Error(`Preencha nome e turma de: ${m.cargo}.`);
    }
    if (m.turma && !m.nome) throw new Error(`Informe o nome de: ${m.cargo}.`);
  });

  const preenchidos = membros.filter(m => m.nome);
  return {
    numero, nome, cor,
    info: $("fcInfo").value.trim(),
    membros: preenchidos,
    candidato: membros[0].nome,   // Presidente = candidato exibido na urna
    // Texto para a urna (sem o presidente, que já é o candidato)
    integrantes: preenchidos.slice(1).map(m => `${m.cargo}: ${m.nome}${m.turma ? ` (${m.turma})` : ""}`),
  };
}

function salvarChapa(id) {
  return acao($("modalOk"), async () => {
    const f = lerFormChapa();
    const args = {
      p_numero: f.numero, p_nome: f.nome, p_candidato: f.candidato,
      p_integrantes: f.integrantes, p_info: f.info, p_cor: f.cor,
      p_membros: f.membros,
    };
    if (id == null) await rpc("admin_criar_chapa", args);
    else            await rpc("admin_atualizar_chapa", { p_id: id, ...args });
    fecharModal();
    await carregarChapas();
  });
}

function excluirChapa(btn, id) {
  if (!confirm("Excluir esta chapa?")) return;
  acao(btn, async () => {
    await rpc("admin_excluir_chapa", { p_id: id });
    await carregarChapas();
  });
}

/* ─────────────────────────────────────────────
   ABA ELEITORES  (matrícula, nome, turma, turno)
   ───────────────────────────────────────────── */
async function carregarEleitores(busca = "") {
  try {
    const data = await rpc("admin_listar_eleitores", { p_busca: busca });
    eleitoresCache = data.eleitores || [];
    const total = Number(data.total || 0);

    let html = eleitoresCache.length === 0
      ? `<tr><td colspan="6" style="text-align:center;color:var(--mut)">Nenhum eleitor.</td></tr>`
      : eleitoresCache.map(e => `
        <tr>
          <td><b>${esc(e.matricula)}</b></td>
          <td>${esc(e.nome)}</td>
          <td>${esc(e.turma)}</td>
          <td>${esc(e.turno)}</td>
          <td>${e.votou
            ? '<span class="badge ok">Sim</span>'
            : '<span class="badge no">Não</span>'}</td>
          <td class="acoes-cel">
            ${e.votou ? `<button data-acao="desmarcar" data-id="${e.id}">Desmarcar</button>` : ""}
            <button data-acao="excluir" data-id="${e.id}">Excluir</button>
          </td>
        </tr>`).join("");

    if (total > eleitoresCache.length) {
      html += `<tr><td colspan="6" style="text-align:center;color:var(--mut)">
        Mostrando ${eleitoresCache.length} de ${total}. Use a busca para filtrar.</td></tr>`;
    }
    $("tblEleitores").innerHTML = html;
  } catch (e) {
    console.error("carregarEleitores:", e);
    $("tblEleitores").innerHTML =
      `<tr><td colspan="6" style="text-align:center;color:var(--err)">Erro ao carregar: ${esc(e.message)}</td></tr>`;
  }
}

$("buscaEleitor").addEventListener("input",
  debounce(e => carregarEleitores(e.target.value.trim())));

$("tblEleitores").addEventListener("click", (ev) => {
  const b = ev.target.closest("button[data-acao]");
  if (!b) return;
  const id = Number(b.dataset.id);
  if (b.dataset.acao === "desmarcar") desmarcarVoto(b, id);
  if (b.dataset.acao === "excluir")   excluirEleitor(b, id);
});

$("btnNovoEleitor").onclick = () => {
  $("modalTitulo").textContent = "Novo eleitor";
  $("modalCorpo").innerHTML = `
    <label>Matrícula</label><input id="feMat" maxlength="20">
    <label>Nome</label><input id="feNome">
    <label>Turma</label><input id="feTurma" placeholder="ex.: 3º Ano A">
    <label>Turno</label>${selectTurno("")}
  `;
  $("modalOk").onclick = salvarNovoEleitor;
  abrirModal();
};

function salvarNovoEleitor() {
  return acao($("modalOk"), async () => {
    const mat = $("feMat").value.trim();
    const nome = $("feNome").value.trim();
    if (!mat || !nome) throw new Error("Preencha matrícula e nome.");
    await rpc("admin_criar_eleitor", {
      p_matricula: mat,
      p_nome:      nome,
      p_turma:     $("feTurma").value.trim(),
      p_turno:     $("feTurno").value,
    });
    fecharModal();
    await carregarEleitores($("buscaEleitor").value.trim());
  });
}

function desmarcarVoto(btn, id) {
  if (!confirm("Desmarcar 'votou' deste eleitor? O voto continua contado na apuração.")) return;
  acao(btn, async () => {
    await rpc("admin_desmarcar_voto", { p_id: id });
    await carregarEleitores($("buscaEleitor").value.trim());
  });
}

function excluirEleitor(btn, id) {
  if (!confirm("Excluir este eleitor?")) return;
  acao(btn, async () => {
    await rpc("admin_excluir_eleitor", { p_id: id });
    await carregarEleitores($("buscaEleitor").value.trim());
  });
}

/* ─────────────────────────────────────────────
   IMPORTAÇÃO EM MASSA
   Colunas: matrícula, nome, turma, turno
   Aceita: .xlsx, .xls, .csv, .txt ou colagem do Excel
   ───────────────────────────────────────────── */
const SHEETJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";

function carregarSheetJS() {
  if (window.XLSX) return Promise.resolve();
  return new Promise((ok, falha) => {
    const s = document.createElement("script");
    s.src = SHEETJS_URL;
    s.onload = ok;
    s.onerror = () => falha(new Error("Não foi possível carregar o leitor de Excel. Salve como .csv e tente de novo."));
    document.head.appendChild(s);
  });
}

// Divide uma linha respeitando aspas ("Silva, João";3A)
function dividirLinha(linha, sep) {
  const out = []; let cur = ""; let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const ch = linha[i];
    if (ch === '"') {
      if (aspas && linha[i + 1] === '"') { cur += '"'; i++; }
      else aspas = !aspas;
    } else if (ch === sep && !aspas) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

// Texto → lista de {matricula, nome, turma, turno}
function parseEleitores(texto) {
  const linhas = texto.split(/\r?\n/).filter(l => l.trim());
  if (!linhas.length) return [];
  const p = linhas[0];
  const sep = p.includes("\t") ? "\t" : p.includes(";") ? ";" : ",";
  const rows = linhas.map(l => dividirLinha(l, sep));

  // Mapa de colunas: por cabeçalho (se houver) ou por posição
  let idx = { matricula: 0, nome: 1, turma: 2, turno: 3 };
  if (rows[0].some(c => /matr[ií]cula/i.test(c))) {
    const h = rows.shift();
    const achar = (re, padrao) => { const i = h.findIndex(c => re.test(c)); return i >= 0 ? i : padrao; };
    idx = {
      matricula: achar(/matr[ií]cula/i, 0),
      nome:      achar(/nome/i, 1),
      turma:     achar(/turma|s[eé]rie/i, 2),
      turno:     achar(/turno/i, 3),
    };
  }
  return rows
    .map(r => ({
      matricula: (r[idx.matricula] || "").trim(),
      nome:      (r[idx.nome] || "").trim(),
      turma:     (r[idx.turma] || "").trim(),
      turno:     normalizarTurno(r[idx.turno]),
    }))
    .filter(x => x.matricula && x.nome);
}

function atualizarPrevia() {
  const n = parseEleitores($("fiTexto").value).length;
  $("fiProgresso").textContent = n ? `${n} eleitor(es) válidos detectados.` : "";
}

$("btnImportar").onclick = () => {
  $("modalTitulo").textContent = "Importar eleitores";
  $("modalCorpo").innerHTML = `
    <p style="color:var(--mut);margin-bottom:8px">
      Colunas: <code>matrícula, nome, turma, turno</code>.<br>
      Envie um arquivo <b>.xlsx</b> / <b>.csv</b> ou cole as células copiadas do Excel.
      Se a primeira linha tiver cabeçalho, ela é reconhecida automaticamente.
    </p>
    <input type="file" id="fiArquivo" accept=".xlsx,.xls,.csv,.txt">
    <textarea id="fiTexto" style="min-height:160px;margin-top:8px"></textarea>
    <p id="fiProgresso" style="color:var(--mut)"></p>
  `;
  $("fiTexto").addEventListener("input", debounce(atualizarPrevia, 400));

  $("fiArquivo").onchange = async (ev) => {
    const f = ev.target.files[0];
    if (!f) return;
    try {
      $("fiProgresso").textContent = "Lendo arquivo…";
      if (/\.xlsx?$/i.test(f.name)) {
        await carregarSheetJS();
        const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        // raw:false = texto como aparece na célula (preserva zeros à esquerda formatados)
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
        $("fiTexto").value = rows.map(r => r.join("\t")).join("\n");
      } else {
        const buf = await f.arrayBuffer();
        let txt;
        try { txt = new TextDecoder("utf-8", { fatal: true }).decode(buf); }
        catch { txt = new TextDecoder("windows-1252").decode(buf); } // CSV antigo do Excel
        $("fiTexto").value = txt.replace(/^\uFEFF/, "");
      }
      atualizarPrevia();
    } catch (e) {
      console.error(e);
      $("fiProgresso").textContent = "";
      alert("Erro ao ler o arquivo: " + (e.message || e));
    }
  };

  $("modalOk").onclick = importarEleitores;
  abrirModal();
};

function importarEleitores() {
  return acao($("modalOk"), async () => {
    const lista = parseEleitores($("fiTexto").value);
    if (!lista.length) throw new Error("Nenhuma linha válida (matrícula e nome são obrigatórios).");

    let ins = 0, ign = 0;
    const LOTE = 1000;
    for (let i = 0; i < lista.length; i += LOTE) {
      $("fiProgresso").textContent = `Enviando ${Math.min(i + LOTE, lista.length)} / ${lista.length}…`;
      try {
        const d = await rpc("admin_importar_eleitores", { p_lista: lista.slice(i, i + LOTE) });
        ins += d.inseridos; ign += d.ignorados;
      } catch (e) {
        throw new Error(`Falha no lote ${i / LOTE + 1} (já inseridos até aqui: ${ins}). ${e.message}`);
      }
    }
    alert(`Importados: ${ins}.\nIgnorados (matrícula já existia ou duplicada no arquivo): ${ign}.`);
    fecharModal();
    await carregarEleitores();
  });
}

/* ─────────────────────────────────────────────
   ABA APURAÇÃO
   ───────────────────────────────────────────── */
async function carregarApuracao() {
  try {
    const data = await rpc("admin_apuracao_detalhada");
    $("apTotal").textContent      = data.total_votos || 0;
    $("apBrancos").textContent    = data.brancos || 0;
    $("apCompareceu").textContent = `${data.compareceram || 0} / ${data.total_eleitores || 0}`;

    const chapas = data.chapas || [];
    const max = Math.max(1, ...chapas.map(c => Number(c.total)));
    $("apChapas").innerHTML = chapas.map(c => {
      const pct = (Number(c.total) / max) * 100;
      return `<div class="chapa-barra">
        <span class="num">${esc(c.numero)}</span>
        <span class="nome">${esc(c.nome)}</span>
        <div class="barra"><i style="width:${pct}%"></i></div>
        <span class="total">${esc(c.total)}</span>
      </div>`;
    }).join("") || `<p style="color:var(--mut)">Sem votos registrados.</p>`;
  } catch (e) {
    console.error("carregarApuracao:", e);
  }
}

$("btnZerar").onclick = () => {
  if (!confirm("⚠ Isso apaga TODOS os votos e reseta 'votou'. Continuar?")) return;
  if (!confirm("Confirma MESMO? Não tem como desfazer.")) return;
  acao($("btnZerar"), async () => {
    await rpc("admin_zerar_votos");
    alert("Votos zerados.");
    await carregarApuracao();
  });
};

/* ─────────────────────────────────────────────
   MODAL
   ───────────────────────────────────────────── */
function abrirModal() {
  $("modal").hidden = false;
  $("modalOk").disabled = false;
}

function fecharModal() {
  $("modal").hidden = true;
  $("modalOk").onclick = null;
}

$("modalCancelar").onclick = fecharModal;
$("modal").addEventListener("click", e => { if (e.target === $("modal")) fecharModal(); });

/* ─────────────────────────────────────────────
   INIT
   ───────────────────────────────────────────── */
checarSessao();