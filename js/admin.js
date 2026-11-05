const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g,
  (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

let eleicaoAtual = null;

/* ─────────────────────────────────────────────
   HELPER: desabilita botão durante operação
   Garante disabled=false mesmo se der exceção
   ───────────────────────────────────────────── */
async function comBotao(btn, fn) {
  if (!btn) return;
  const original = btn.textContent;
  btn.disabled = true;
  try {
    await fn();
  } finally {
    btn.disabled = false;
    // Se o fn não mudou o texto, restaura
    if (btn.textContent === original || btn.textContent === "Aguarde…") {
      btn.textContent = original;
    }
  }
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

  if (!sb) {
    msg.textContent = "Supabase não configurado.";
    msg.classList.add("err");
    return;
  }
  if (!email || !senha) {
    msg.textContent = "Preencha e-mail e senha.";
    msg.classList.add("err");
    return;
  }

  btn.disabled = true;
  msg.textContent = "Entrando…";
  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password: senha });
    if (error || !data?.user) {
      msg.textContent = "E-mail ou senha inválidos.";
      msg.classList.add("err");
      return;
    }
    mostrarDashboard(data.user.email);
  } catch (e) {
    console.error("entrar:", e);
    msg.textContent = "Erro de conexão. Verifique a URL do Supabase.";
    msg.classList.add("err");
  } finally {
    btn.disabled = false;   // ← GARANTIDO
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
    if (tab.dataset.tab === "eleitores") carregarEleitores();
    if (tab.dataset.tab === "apuracao")  carregarApuracao();
  };
});

/* ─────────────────────────────────────────────
   ABA ELEIÇÃO
   ───────────────────────────────────────────── */
async function carregarEleicao() {
  try {
    const { data, error } = await sb.rpc("admin_eleicao_atual");
    if (error || !data?.ok) {
      console.error("carregarEleicao:", error || data);
      $("statusEleicao").textContent = "Erro ao carregar";
      $("statusEleicao").className = "status fechada";
      $("btnToggle").disabled = true;
      return;
    }
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
    $("statusEleicao").textContent = "Erro";
    $("statusEleicao").className = "status fechada";
    $("btnToggle").disabled = true;
  }
}

$("btnToggle").onclick = async () => {
  if (!eleicaoAtual) {
    alert("Eleição ainda não carregada. Aguarde ou recarregue a página.");
    return;
  }
  const btn = $("btnToggle");
  btn.disabled = true;
  try {
    const { data, error } = await sb.rpc("admin_toggle_eleicao", {
      p_aberta: !eleicaoAtual.aberta,
    });
    if (error || !data?.ok) {
      alert("Erro: " + (error?.message || data?.motivo || "desconhecido"));
      return;
    }
    await carregarEleicao();
  } catch (e) {
    console.error("btnToggle:", e);
    alert("Erro de conexão. Tente novamente.");
  } finally {
    btn.disabled = false;
  }
};

/* ─────────────────────────────────────────────
   ABA CHAPAS
   ───────────────────────────────────────────── */
async function carregarChapas() {
  try {
    const { data, error } = await sb.rpc("urn_dados_iniciais");
    if (error) { console.error(error); return; }
    const chapas = data?.chapas || [];
    $("tblChapas").innerHTML = chapas.length === 0
      ? `<tr><td colspan="5" style="text-align:center;color:var(--mut)">Nenhuma chapa cadastrada.</td></tr>`
      : chapas.map(c => `
        <tr>
          <td><b>${esc(c.numero)}</b></td>
          <td>${esc(c.nome)}</td>
          <td>${esc(c.candidato)}</td>
          <td>${esc((c.integrantes || []).join(", "))}</td>
          <td class="acoes-cel">
            <button onclick="editarChapa(${c.id})">Editar</button>
            <button onclick="excluirChapa(${c.id})">Excluir</button>
          </td>
        </tr>`).join("");
  } catch (e) {
    console.error("carregarChapas:", e);
    $("tblChapas").innerHTML =
      `<tr><td colspan="5" style="text-align:center;color:var(--err)">Erro ao carregar.</td></tr>`;
  }
}

$("btnNovaChapa").onclick = () => abrirModalChapa(null);

function abrirModalChapa(chapa) {
  const editando = !!chapa;
  $("modalTitulo").textContent = editando ? "Editar chapa" : "Nova chapa";
  $("modalCorpo").innerHTML = `
    <label>Número</label>
    <input id="fcNumero" maxlength="4" value="${esc(chapa?.numero || '')}">
    <label>Nome da chapa</label>
    <input id="fcNome" value="${esc(chapa?.nome || '')}">
    <label>Candidato(a)</label>
    <input id="fcCandidato" value="${esc(chapa?.candidato || '')}">
    <label>Integrantes (separados por vírgula)</label>
    <input id="fcIntegrantes" value="${esc((chapa?.integrantes || []).join(', '))}">
    <label>Proposta (opcional)</label>
    <textarea id="fcInfo">${esc(chapa?.info || '')}</textarea>
    <label>Cor (hex)</label>
    <input id="fcCor" value="${esc(chapa?.cor || '#1d4ed8')}">
  `;
  $("modalOk").onclick = () => editando ? salvarEdicaoChapa(chapa.id) : salvarNovaChapa();
  abrirModal();
}

async function salvarNovaChapa() {
  const btn = $("modalOk");
  btn.disabled = true;
  try {
    const integ = $("fcIntegrantes").value.split(",").map(s => s.trim()).filter(Boolean);
    const { data, error } = await sb.rpc("admin_criar_chapa", {
      p_numero:     $("fcNumero").value.trim(),
      p_nome:       $("fcNome").value.trim(),
      p_candidato:  $("fcCandidato").value.trim(),
      p_integrantes: integ,
      p_info:       $("fcInfo").value.trim(),
      p_cor:        $("fcCor").value.trim(),
    });
    if (error || !data?.ok) {
      alert("Erro: " + (error?.message || data?.motivo || "desconhecido"));
      return;
    }
    fecharModal();
    await carregarChapas();
  } catch (e) {
    console.error(e);
    alert("Erro inesperado: " + (e.message || e));
  } finally {
    btn.disabled = false;
  }
}

async function salvarEdicaoChapa(id) {
  const btn = $("modalOk");
  btn.disabled = true;
  try {
    const integ = $("fcIntegrantes").value.split(",").map(s => s.trim()).filter(Boolean);
    const { data, error } = await sb.rpc("admin_atualizar_chapa", {
      p_id: id,
      p_numero:     $("fcNumero").value.trim(),
      p_nome:       $("fcNome").value.trim(),
      p_candidato:  $("fcCandidato").value.trim(),
      p_integrantes: integ,
      p_info:       $("fcInfo").value.trim(),
      p_cor:        $("fcCor").value.trim(),
    });
    if (error || !data?.ok) {
      alert("Erro: " + (error?.message || data?.motivo || "desconhecido"));
      return;
    }
    fecharModal();
    await carregarChapas();
  } catch (e) {
    console.error(e);
    alert("Erro inesperado: " + (e.message || e));
  } finally {
    btn.disabled = false;
  }
}

window.editarChapa = async (id) => {
  try {
    const { data, error } = await sb.rpc("urn_dados_iniciais");
    if (error) { alert("Erro ao carregar: " + error.message); return; }
    const c = (data?.chapas || []).find(x => x.id === id);
    if (c) abrirModalChapa(c);
    else alert("Chapa não encontrada.");
  } catch (e) {
    console.error(e);
    alert("Erro: " + (e.message || e));
  }
};

window.excluirChapa = async (id) => {
  if (!confirm("Excluir esta chapa?")) return;
  try {
    const { data, error } = await sb.rpc("admin_excluir_chapa", { p_id: id });
    if (error || !data?.ok) {
      alert("Não é possível excluir: " + (error?.message || data?.motivo || "erro"));
      return;
    }
    await carregarChapas();
  } catch (e) {
    console.error(e);
    alert("Erro: " + (e.message || e));
  }
};

/* ─────────────────────────────────────────────
   ABA ELEITORES
   ───────────────────────────────────────────── */
let eleitoresCache = [];

async function carregarEleitores(busca = "") {
  try {
    const { data, error } = await sb.rpc("admin_listar_eleitores", { p_busca: busca });
    if (error || !data?.ok) {
      console.error("carregarEleitores:", error || data);
      return;
    }
    eleitoresCache = data.eleitores || [];
    $("tblEleitores").innerHTML = eleitoresCache.length === 0
      ? `<tr><td colspan="5" style="text-align:center;color:var(--mut)">Nenhum eleitor.</td></tr>`
      : eleitoresCache.map(e => `
        <tr>
          <td><b>${esc(e.matricula)}</b></td>
          <td>${esc(e.nome)}</td>
          <td>${esc(e.turma)}</td>
          <td>${e.votou
            ? '<span class="badge ok">Sim</span>'
            : '<span class="badge no">Não</span>'}</td>
          <td class="acoes-cel">
            ${e.votou ? `<button onclick="desmarcarVoto(${e.id})">Desmarcar</button>` : ""}
            <button onclick="excluirEleitor(${e.id})">Excluir</button>
          </td>
        </tr>`).join("");
  } catch (e) {
    console.error("carregarEleitores:", e);
  }
}

$("buscaEleitor").addEventListener("input", e => carregarEleitores(e.target.value.trim()));

$("btnNovoEleitor").onclick = () => {
  $("modalTitulo").textContent = "Novo eleitor";
  $("modalCorpo").innerHTML = `
    <label>Matrícula</label><input id="feMat" maxlength="20">
    <label>Nome</label><input id="feNome">
    <label>Turma</label><input id="feTurma" placeholder="ex.: 3º Ano A">
  `;
  $("modalOk").onclick = salvarNovoEleitor;
  abrirModal();
};

async function salvarNovoEleitor() {
  const btn = $("modalOk");
  btn.disabled = true;
  try {
    const { data, error } = await sb.rpc("admin_criar_eleitor", {
      p_matricula: $("feMat").value.trim(),
      p_nome:      $("feNome").value.trim(),
      p_turma:     $("feTurma").value.trim(),
    });
    if (error || !data?.ok) {
      alert("Erro: " + (error?.message || data?.motivo || "desconhecido"));
      return;
    }
    fecharModal();
    await carregarEleitores();
  } catch (e) {
    console.error(e);
    alert("Erro: " + (e.message || e));
  } finally {
    btn.disabled = false;
  }
}

$("btnImportar").onclick = () => {
  $("modalTitulo").textContent = "Importar eleitores";
  $("modalCorpo").innerHTML = `
    <p style="color:var(--mut);margin-bottom:8px">
      Cole uma linha por eleitor: <code>matricula, nome, turma</code>
    </p>
    <textarea id="fiTexto" style="min-height:200px"></textarea>
  `;
  $("modalOk").onclick = importarEleitores;
  abrirModal();
};

async function importarEleitores() {
  const btn = $("modalOk");
  btn.disabled = true;
  try {
    const linhas = $("fiTexto").value.split("\n").map(l => l.trim()).filter(Boolean);
    const lista = linhas.map(l => {
      const [matricula, nome, turma] = l.split(",").map(s => s.trim());
      return { matricula, nome, turma: turma || "" };
    }).filter(x => x.matricula && x.nome);

    if (lista.length === 0) { alert("Nenhuma linha válida."); return; }

    const { data, error } = await sb.rpc("admin_importar_eleitores", { p_lista: lista });
    if (error || !data?.ok) {
      alert("Erro: " + (error?.message || data?.motivo || "desconhecido"));
      return;
    }
    alert(`Importados: ${data.inseridos}. Ignorados (já existiam): ${data.ignorados}.`);
    fecharModal();
    await carregarEleitores();
  } catch (e) {
    console.error(e);
    alert("Erro: " + (e.message || e));
  } finally {
    btn.disabled = false;
  }
}

window.desmarcarVoto = async (id) => {
  if (!confirm("Desmarcar 'votou' deste eleitor? O voto continua contado na apuração.")) return;
  try {
    const { data, error } = await sb.rpc("admin_desmarcar_voto", { p_id: id });
    if (error || !data?.ok) { alert("Erro ao desmarcar."); return; }
    await carregarEleitores($("buscaEleitor").value.trim());
  } catch (e) { console.error(e); alert("Erro: " + (e.message || e)); }
};

window.excluirEleitor = async (id) => {
  if (!confirm("Excluir este eleitor?")) return;
  try {
    const { data, error } = await sb.rpc("admin_excluir_eleitor", { p_id: id });
    if (error || !data?.ok) { alert("Erro ao excluir."); return; }
    await carregarEleitores($("buscaEleitor").value.trim());
  } catch (e) { console.error(e); alert("Erro: " + (e.message || e)); }
};

/* ─────────────────────────────────────────────
   ABA APURAÇÃO
   ───────────────────────────────────────────── */
async function carregarApuracao() {
  try {
    const { data, error } = await sb.rpc("admin_apuracao_detalhada");
    if (error || !data?.ok) {
      console.error("carregarApuracao:", error || data);
      return;
    }
    $("apTotal").textContent      = data.total_votos || 0;
    $("apBrancos").textContent    = data.brancos || 0;
    $("apCompareceu").textContent = `${data.compareceram || 0} / ${data.total_eleitores || 0}`;

    const max = Math.max(1, ...(data.chapas || []).map(c => Number(c.total)));
    $("apChapas").innerHTML = (data.chapas || []).map(c => {
      const pct = (Number(c.total) / max) * 100;
      return `<div class="chapa-barra">
        <span class="num">${esc(c.numero)}</span>
        <span class="nome">${esc(c.nome)}</span>
        <div class="barra"><i style="width:${pct}%"></i></div>
        <span class="total">${c.total}</span>
      </div>`;
    }).join("") || `<p style="color:var(--mut)">Sem votos registrados.</p>`;
  } catch (e) {
    console.error("carregarApuracao:", e);
  }
}

$("btnZerar").onclick = async () => {
  if (!confirm("⚠ Isso apaga TODOS os votos e reseta 'votou'. Continuar?")) return;
  if (!confirm("Confirma MESMO? Não tem como desfazer.")) return;

  const btn = $("btnZerar");
  btn.disabled = true;
  try {
    const { data, error } = await sb.rpc("admin_zerar_votos");
    if (error || !data?.ok) {
      alert("Erro ao zerar: " + (error?.message || data?.motivo || "desconhecido"));
      return;
    }
    alert("Votos zerados.");
    await carregarApuracao();
  } catch (e) {
    console.error(e);
    alert("Erro: " + (e.message || e));
  } finally {
    btn.disabled = false;
  }
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