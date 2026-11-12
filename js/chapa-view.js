/* ============================================================
   chapa-view.js — monta a ficha da chapa na tela da urna
   Expõe: window.renderChapaDetalhe(chapa) → string HTML

   Entrada (objeto vindo de urn_dados_iniciais):
     { numero, nome, candidato, cor, info,
       membros:     [{cargo, nome, turma}, ...]   ← preferido
       integrantes: ["Cargo: Nome (Turma)", ...]  ← usado se não houver membros }
   ============================================================ */
(function () {
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // "Diretor(a) de Meio Ambiente e Saúde" → "Dir. Meio Ambiente e Saúde"
  // (o nome completo fica no atributo title do bloco)
  function cargoCurto(cargo) {
    return String(cargo || "").trim().replace(/^Diretor\(a\)\s+(de\s+)?/i, "Dir. ");
  }

  // Lista única de {cargo, nome, turma}, venha de `membros` ou de `integrantes` (texto)
  function listarMembros(chapa) {
    if (Array.isArray(chapa.membros) && chapa.membros.length) {
      return chapa.membros
        .filter((m) => m && m.nome)
        .map((m) => ({ cargo: m.cargo || "", nome: m.nome, turma: m.turma || "" }));
    }

    const lista = [];
    if (chapa.candidato) lista.push({ cargo: "Presidente", nome: chapa.candidato, turma: "" });

    const integ = Array.isArray(chapa.integrantes) ? chapa.integrantes : [];
    for (const bruto of integ) {
      const t = String(bruto || "").trim();
      if (!t) continue;
      // "Cargo: Nome (Turma)"  — a turma entre parênteses no fim é opcional
      const m = t.match(/^([^:]+):\s*(.*?)(?:\s*\(([^)]*)\))?$/);
      lista.push(m
        ? { cargo: m[1].trim(), nome: m[2].trim(), turma: (m[3] || "").trim() }
        : { cargo: "", nome: t, turma: "" });
    }
    return lista;
  }

  function blocoMembro(m) {
    return `
      <li class="membro" title="${esc(m.cargo)}">
        <span class="m-cargo">${esc(cargoCurto(m.cargo))}</span>
        ${m.turma ? `<span class="m-turma">${esc(m.turma)}</span>` : ""}
        <span class="m-nome">${esc(m.nome)}</span>
      </li>`;
  }

  window.renderChapaDetalhe = function (chapa) {
    if (!chapa) return "";
    const cor = /^#[0-9a-f]{6}$/i.test(chapa.cor || "") ? chapa.cor : "#1d4ed8";

    const todos = listarMembros(chapa);
    const iPres = todos.findIndex((m) => /^presidente$/i.test(m.cargo));
    const pres = iPres >= 0
      ? todos[iPres]
      : (chapa.candidato ? { cargo: "Presidente", nome: chapa.candidato, turma: "" } : null);
    const demais = todos.filter((_, i) => i !== iPres);

    return `
    <div class="ficha" style="--cor:${cor}">
      <div class="ficha-topo">
        <div class="ficha-num" aria-label="Chapa ${esc(chapa.numero)}">${esc(chapa.numero)}</div>
        <div class="ficha-id">
          <h2>${esc(chapa.nome)}</h2>
          ${pres ? `
          <div class="pres">
            <span class="m-cargo">${esc(pres.cargo || "Presidente")}</span>
            <div class="linha">
              <span class="m-nome">${esc(pres.nome)}</span>
              ${pres.turma ? `<span class="m-turma">${esc(pres.turma)}</span>` : ""}
            </div>
          </div>` : ""}
        </div>
      </div>
      ${chapa.info ? `<p class="proposta">${esc(chapa.info)}</p>` : ""}
      ${demais.length ? `<ul class="membros" aria-label="Integrantes da chapa">${demais.map(blocoMembro).join("")}</ul>` : ""}
    </div>`;
  };

  // ── Cartão da tela inicial: compacto; a diretoria fica recolhida ──
  const FOTO_OK = /^(https?:\/\/|data:image\/)[^\s'"()<>]+$/i;

  function lider(m, rotulo) {
    return `
        <div class="lider">
          <span class="m-cargo">${esc(rotulo)}</span>
          <div class="linha">
            <span class="m-nome">${esc(m.nome)}</span>
            ${m.turma ? `<span class="m-turma">${esc(m.turma)}</span>` : ""}
          </div>
        </div>`;
  }

  window.renderChapaCard = function (c) {
    if (!c) return "";
    const cor = /^#[0-9a-f]{6}$/i.test(c.cor || "") ? c.cor : "#1d4ed8";
    const fundo = FOTO_OK.test(c.foto || "")
      ? `linear-gradient(180deg,#0000,#0008),url('${c.foto}')`
      : `linear-gradient(135deg,${cor},#14213d)`;

    const todos = listarMembros(c);
    const iPres = todos.findIndex((m) => /^presidente$/i.test(m.cargo));
    const iVice = todos.findIndex((m) => /^vice/i.test(m.cargo));
    const pres = iPres >= 0 ? todos[iPres]
      : (c.candidato ? { cargo: "Presidente", nome: c.candidato, turma: "" } : null);
    const vice = iVice >= 0 ? todos[iVice] : null;
    const resto = todos.filter((_, i) => i !== iPres && i !== iVice);

    return `
    <article class="card chapa-card" style="--cor:${cor}">
      <div class="banner" style="background-image:${fundo}"><span class="n">${esc(c.numero)}</span></div>
      <div class="bd">
        <h3>${esc(c.nome)}</h3>
        <div class="lideres">
          ${pres ? lider(pres, "Presidente") : ""}
          ${vice ? lider(vice, "Vice-Presidente") : ""}
        </div>
        ${resto.length ? `
        <details class="integrantes">
          <summary>
            <span class="ver-mais">Ver diretoria (${resto.length})</span>
            <span class="ver-menos">Ocultar diretoria</span>
          </summary>
          <ul class="membros" aria-label="Diretoria da chapa ${esc(c.nome)}">${resto.map(blocoMembro).join("")}</ul>
        </details>` : ""}
      </div>
    </article>`;
  };
})();