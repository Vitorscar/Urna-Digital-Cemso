const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g,
  (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

function fmt(n) { return Number(n || 0).toLocaleString("pt-BR"); }

async function carregar() {
  if (!sb) {
    $("conteudo").innerHTML = `<div class="bloqueio">
      <h2>Supabase não configurado</h2>
      <p>Preencha <code>SUPABASE_URL</code> e <code>SUPABASE_ANON_KEY</code> em <code>js/config.js</code>.</p>
    </div>`;
    return;
  }

  const { data, error } = await sb.rpc("urn_apuracao_publica");

  if (error || !data?.ok) {
    $("conteudo").innerHTML = `<div class="bloqueio">
      <h2>Erro ao carregar</h2>
      <p>${esc(error?.message || "Tente novamente em alguns instantes.")}</p>
    </div>`;
    return;
  }

  $("ano").textContent = data.eleicao?.ano ?? "";
  $("escola").textContent = "Apuração — " + (data.eleicao?.nome ?? "Eleição");

  // ─── Votação ainda aberta ───
  if (data.bloqueada) {
    $("status").textContent = "Em andamento";
    $("conteudo").innerHTML = `<div class="bloqueio">
      <h2>Apuração bloqueada</h2>
      <p style="margin-top:8px">Os resultados serão divulgados <b>após o encerramento da votação</b>.</p>
      <p style="margin-top:16px;color:var(--mut);font-size:14px">
        A comissão eleitoral encerra a votação pelo painel administrativo.
      </p>
    </div>`;
    // Re-checa a cada 20s — quando o admin fechar, esta tela se atualiza sozinha
    setTimeout(carregar, 20000);
    return;
  }

  // ─── Votação encerrada — mostra o resultado ───
  $("status").textContent = "Encerrada";
  const chapas = data.chapas || [];
  const total  = Number(data.total_votos || 0);
  const brancos = Number(data.brancos || 0);
  const vencedor = chapas[0];
  const empatado = chapas.length > 1 && Number(chapas[0].total) === Number(chapas[1].total);

  let html = "";

  // Cabeçalho do vencedor
  if (vencedor && Number(vencedor.total) > 0 && !empatado) {
    html += `<div class="vencedor">
      <div class="label">Chapa mais votada</div>
      <div class="num">${esc(vencedor.numero)}</div>
      <div class="nome">${esc(vencedor.nome)}</div>
      <div>${esc(vencedor.candidato)} — ${fmt(vencedor.total)} voto(s)</div>
    </div>`;
  } else if (empatado) {
    html += `<div class="vencedor" style="background:linear-gradient(135deg,#cfe1ff,#e6efff);color:#14213d">
      <div class="label">Empate</div>
      <div class="nome" style="font-size:30px">Empate técnico entre as chapas mais votadas</div>
    </div>`;
  }

  // Estatísticas
  html += `<div class="stats">
    <div class="stat"><div class="n">${fmt(total)}</div><div class="l">Votos válidos + brancos</div></div>
    <div class="stat"><div class="n">${fmt(brancos)}</div><div class="l">Brancos</div></div>
    <div class="stat"><div class="n">${fmt(data.votaram)}</div><div class="l">Compareceram</div></div>
    <div class="stat"><div class="n">${fmt(data.eleitores)}</div><div class="l">Eleitores aptos</div></div>
  </div>`;

  // Ranking
  html += `<div class="resultado">
    <h2>Votos por chapa</h2>`;

  if (chapas.length === 0) {
    html += `<p style="color:var(--mut)">Nenhuma chapa cadastrada.</p>`;
  } else {
    const max = Math.max(1, ...chapas.map(c => Number(c.total)));
    chapas.forEach((c, i) => {
      const pct = total > 0 ? ((Number(c.total) / total) * 100).toFixed(1) : "0.0";
      const largura = (Number(c.total) / max) * 100;
      html += `<div class="linha">
        <div class="num">${esc(c.numero)}</div>
        <div class="barra-wrap">
          <div class="nome">${esc(c.nome)} <span class="pct">(${pct}%)</span></div>
          <div class="barra"><i style="width:0;background:${esc(c.cor || "#1d4ed8")}" data-w="${largura}"></i></div>
        </div>
        <div class="votos">${fmt(c.total)}</div>
      </div>`;
    });
  }
  html += `</div>`;

  // Rodapé
  html += `<p class="center" style="color:var(--mut);font-size:13px;margin-top:16px">
    Apuração encerrada. <a href="apuracao.html" style="color:var(--mut)">Atualizar</a>
  </p>`;

  $("conteudo").innerHTML = html;

  // Anima as barras depois que o DOM está pronto
  requestAnimationFrame(() => {
    document.querySelectorAll(".linha .barra i").forEach(el => {
      el.style.width = el.dataset.w + "%";
    });
  });
}

carregar();