const State = {
  set(k, v) { sessionStorage.setItem("urna." + k, JSON.stringify(v)); },
  get(k, padrao = null) {
    const v = sessionStorage.getItem("urna." + k);
    return v ? JSON.parse(v) : padrao;
  },
  del(k) { sessionStorage.removeItem("urna." + k); },
  limparVoto() {
    ["matricula","digitos","branco","chave","chapa"].forEach(k => this.del(k));
  },
};