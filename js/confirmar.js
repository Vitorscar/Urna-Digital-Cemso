const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g,
  (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

const CONFIG   = State.get("config");
const matricula = State.get("matricula");
const digitos   = State.get("digitos");
const branco    = State.get("branco");
const chapa     = State.get("chapa");
const chave     = State.get("chave");

if (!CONFIG || !matricula || !chave || (!branco && !chapa)) {
  window.location.href = "index.html";
}

let enviando = false;

const bannerHTML = (c) => `<div class="banner" style="background-image:${
  c.foto ? `url('${esc(c.foto)}')` : `linear-gradient(135deg,${esc(c.cor)},#14213d)`
}"><span class="n">${esc(c.numero)}</span></div>`;

$("escola").textContent = CONFIG.escola;

$("cardConfirma").innerHTML = branco
  ? `<div class="bd center"><h2 style="font-size:44px">VOTO EM BRANCO</h2></div>`
  : `${bannerHTML(chapa)}
     <div class="bd">
       <h3>${esc(chapa.nome)}</h3>
       <p><b>Candidato:</b> ${esc(chapa.candidato)}</p>
       <p><b>Integrantes:</b> ${esc((chapa.integrantes||[]).join(", "))}</p>
     </div>`;

$("btnVolta").onclick = () => { if (!enviando) window.location.href = "voto.html"; };

$("btnConfirmaFinal").onclick = async () => {
  if (enviando) return;
  enviando = true;
  const b = $("btnConfirmaFinal"), m = $("msgVoto");
  b.disabled = true; $("btnVolta").disabled = true;
  m.className = "msg"; m.textContent = "Registrando seu voto…";

  try {
    let r;
    if (sb) {
      const { data, error } = await sb.rpc("urn_registrar_voto", {
        p_matricula: matricula,
        p_numero: branco ? null : (chapa?.numero ?? null),
        p_branco: branco,
        p_chave: chave,
      });
      if (error) throw error;
      r = data;
    } else {
      await new Promise(res => setTimeout(res, 400));
      r = { ok: true };
    }

    if (!r.ok) throw new Error(r.motivo || "erro");

    State.limparVoto();
    State.set("concluido", true);
    State.set("voltaSeg", CONFIG.voltaInicioSeg || 6);
    beepFim();
    window.location.href = "fim.html";
  } catch (e) {
    m.className = "msg err";
    m.textContent = "Não foi possível confirmar o registro. Seu voto NÃO foi dado como registrado. Toque em CONFIRMA para tentar de novo.";
    b.disabled = false; $("btnVolta").disabled = false;
    console.error(e);
  } finally {
    enviando = false;
  }
};