if (!State.get("concluido")) {
  window.location.href = "index.html";
}

const seg = State.get("voltaSeg", 6);
const barra = document.getElementById("barra");
barra.style.animation = `sh ${seg}s linear forwards`;

setTimeout(() => {
  State.del("concluido");
  State.del("voltaSeg");
  window.location.href = "index.html";
}, seg * 1000);