const stateCodes = new Set(["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"]);
let localityRequest = null;

function loadLocalities() {
  if (localityRequest) return localityRequest;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10000);
  localityRequest = fetch(new URL("../public/brazil-localities.v1.json", import.meta.url), { signal: controller.signal, cache: "force-cache" })
    .then(async (response) => {
      if (!response.ok) throw new Error("Localities unavailable");
      const data = await response.json();
      const codes = new Set();
      const ids = new Set();
      if (data.version !== 1 || !Array.isArray(data.states) || data.states.length !== stateCodes.size) throw new Error("Invalid localities");
      for (const state of data.states) {
        if (!stateCodes.has(state.code) || codes.has(state.code) || !Number.isInteger(state.id) || typeof state.name !== "string" || !Array.isArray(state.municipalities) || !state.municipalities.length) throw new Error("Invalid state");
        codes.add(state.code);
        for (const city of state.municipalities) {
          if (!Array.isArray(city) || !Number.isInteger(city[0]) || !String(city[0]).startsWith(String(state.id)) || ids.has(city[0]) || typeof city[1] !== "string" || !city[1].trim()) throw new Error("Invalid municipality");
          ids.add(city[0]);
        }
      }
      return data.states;
    })
    .catch((error) => { localityRequest = null; throw error; })
    .finally(() => window.clearTimeout(timeout));
  return localityRequest;
}

export function initializeSearchCriteria(form) {
  const state = form?.querySelector("#search-state");
  const city = form?.querySelector("#search-city");
  const quantity = form?.querySelector("#search-quantity");
  const help = form?.querySelector("#search-city-help");
  const retry = form?.querySelector("#retry-search-cities");
  const submit = form?.querySelector('[type="submit"]');
  const niche = form?.querySelector("#search-niche");
  if (!state || !city || !quantity || !help || !retry || !submit || !niche) return null;
  let revision = 0;
  let selectedState = null;

  async function populateCities() {
    const currentRevision = ++revision;
    const code = state.value;
    selectedState = null;
    state.setCustomValidity("");
    city.setCustomValidity("");
    city.disabled = true;
    city.removeAttribute("aria-busy");
    retry.hidden = true;
    if (!stateCodes.has(code)) {
      city.replaceChildren(new Option("Escolha o estado primeiro", ""));
      help.textContent = "Selecione um estado para ver as cidades.";
      submit.disabled = false;
      return;
    }
    city.replaceChildren(new Option("Carregando cidades…", ""));
    city.setAttribute("aria-busy", "true");
    help.textContent = "Carregando as cidades do estado escolhido…";
    submit.disabled = true;
    try {
      const states = await loadLocalities();
      if (currentRevision !== revision || state.value !== code) return;
      selectedState = states.find((item) => item.code === code);
      if (!selectedState) throw new Error("State unavailable");
      const options = document.createDocumentFragment();
      options.append(new Option("Todas as cidades do estado", ""));
      for (const [id, name] of selectedState.municipalities) options.append(new Option(name, String(id)));
      city.replaceChildren(options);
      city.disabled = false;
      city.removeAttribute("aria-busy");
      help.textContent = "Escolha uma cidade ou busque em todo o estado.";
      submit.disabled = false;
    } catch {
      if (currentRevision !== revision || state.value !== code) return;
      city.replaceChildren(new Option("Cidades indisponíveis", ""));
      city.removeAttribute("aria-busy");
      help.textContent = "Não foi possível carregar as cidades. Tente novamente.";
      retry.hidden = false;
      submit.disabled = true;
    }
  }

  state.addEventListener("change", populateCities);
  retry.addEventListener("click", populateCities);
  city.addEventListener("change", () => city.setCustomValidity(""));
  quantity.addEventListener("input", () => quantity.setCustomValidity(""));
  niche.addEventListener("input", () => niche.setCustomValidity(""));
  form.addEventListener("reset", () => window.queueMicrotask(populateCities));
  if (state.value) populateCities();

  return {
    read() {
      niche.setCustomValidity(niche.value.trim() ? "" : "Informe o tipo de empresa que você procura.");
      state.setCustomValidity(stateCodes.has(state.value) ? "" : "Selecione um estado brasileiro.");
      const limit = Number(quantity.value);
      quantity.setCustomValidity(quantity.value.trim() && Number.isInteger(limit) && limit >= 1 && limit <= 100 ? "" : "Informe um número inteiro de 1 a 100 leads.");
      if (!form.reportValidity()) return null;
      if (!selectedState || selectedState.code !== state.value || city.disabled) {
        help.textContent = "Carregue as cidades do estado escolhido antes de continuar.";
        state.focus();
        return null;
      }
      const municipality = city.value ? selectedState.municipalities.find(([id]) => String(id) === city.value) : null;
      city.setCustomValidity(city.value && !municipality ? "Selecione uma cidade deste estado." : "");
      if (!city.reportValidity()) return null;
      return { niche: niche.value.trim(), state: selectedState.code, stateName: selectedState.name, cityId: municipality?.[0] ?? null, cityName: municipality?.[1] ?? null, quantity: limit };
    },
  };
}
