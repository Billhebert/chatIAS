const agentsList = document.getElementById("agents-list");
const toolsList = document.getElementById("tools-list");
const modelsInfo = document.getElementById("models-info");
const runsLog = document.getElementById("runs-log");
const sdkStatus = document.getElementById("sdk-status");
const runForm = document.getElementById("run-form");
const promptInput = document.getElementById("prompt-input");
const agentSelect = document.getElementById("agent-select");
const useFallback = document.getElementById("use-fallback");
const refreshAgentsBtn = document.getElementById("refresh-agents");
const refreshToolsBtn = document.getElementById("refresh-tools");
const refreshSdkBtn = document.getElementById("refresh-sdk");

const state = {
  runs: [],
};

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    let message = "Erro inesperado";
    try {
      const data = await res.json();
      message = data.error || message;
    } catch (err) {
      message = await res.text();
    }
    throw new Error(message || `Request failed: ${res.status}`);
  }
  return res.json();
}

function renderAgents(data = []) {
  if (!data.length) {
    agentsList.innerHTML = `<p class="muted">Nenhum agente registrado.</p>`;
    return;
  }

  agentsList.innerHTML = data
    .map((agent) => {
      const subagents = agent.subagents
        .map((name) => `<span class="tag">${name}</span>`)
        .join("");
      const tools = agent.tools
        .map((tool) => {
          const origin = tool.origin || "local";
          return `
            <div class="tool-origin">
              <code>${tool.name}</code>
              <span class="origin ${origin}">${origin}</span>
            </div>
          `;
        })
        .join("");

      return `
        <article class="card">
          <div class="card-header">
            <div class="card-title">
              <strong>${agent.label}</strong>
              <span>${agent.description || ""}</span>
            </div>
            <span class="status-pill ${agent.enabled ? "success" : "error"}">
              ${agent.enabled ? "Ativo" : "Inativo"}
            </span>
          </div>
          <div>
            <p>Subagentes:</p>
            <div class="subagents">${subagents || "<span class=\"muted\">Nenhum</span>"}</div>
          </div>
          <div>
            <p>Ferramentas:</p>
            <div class="subagents">${tools || "<span class=\"muted\">Nenhuma</span>"}</div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderTools(data = []) {
  if (!data.length) {
    toolsList.innerHTML = `<p class="muted">Nenhuma tool registrada.</p>`;
    return;
  }

  toolsList.innerHTML = data
    .map((tool) => {
      const params = Object.entries(tool.parameters || {})
        .map(([key, info]) => `${key}${info.required ? "*" : ""}`)
        .join(", ");
      const origin = tool.source || "local";
      return `
        <article class="tool-item">
          <div class="card-header">
            <div class="card-title">
              <strong>${tool.name}</strong>
              <span>${tool.description || ""}</span>
            </div>
            <span class="origin ${origin}">${origin}</span>
          </div>
          <div class="meta">
            <span>Parâmetros: ${params || "Nenhum"}</span>
            <span>Status: ${tool.enabled ? "Ativo" : "Inativo"}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderModels(data) {
  if (!data) {
    modelsInfo.innerHTML = `<p class="muted">Sem informações carregadas.</p>`;
    return;
  }

  const {
    sdk,
    remoteModels = [],
    ollamaModels = [],
    lastAttempts = [],
    lastSummary,
    lastSource,
    lastModel,
  } = data;

  const sdkConnected = sdk?.initialized;
  const sdkPill = sdkConnected ? "online" : sdk?.mode === "auto" ? "warning" : "offline";
  const ollamaPill = data?.ollama?.available ? "online" : "offline";
  const statusLines = [sdk?.statusMessage];
  if (sdk?.connectedAt) {
    statusLines.push(`Conectado em ${new Date(sdk.connectedAt).toLocaleTimeString()}`);
  }
  if (!sdkConnected && sdk?.nextRetryAt) {
    statusLines.push(`Próxima tentativa ${new Date(sdk.nextRetryAt).toLocaleTimeString()}`);
  }
  if (sdk?.lastError) {
    statusLines.push(`Último erro: ${sdk.lastError}`);
  }

  sdkStatus.innerHTML = `
    <div class="sdk-pill ${sdkPill}">
      <div>
        SDK ${sdkConnected ? "Conectado" : sdk?.mode === "auto" ? "Reconectando" : "Desconectado"}
        ${sdk?.sessionId ? `• Sessão ${sdk.sessionId}` : ""}
      </div>
      <small>${statusLines.filter(Boolean).join(" • ") || "Status desconhecido"}</small>
    </div>
    <div class="ollama-pill ${ollamaPill}">
      <div>Ollama ${ollamaPill === "online" ? "Disponível" : "Indisponível"}</div>
      <small>${ollamaPill === "online" ? "Respondendo localmente" : "Inicie o serviço Ollama"}</small>
    </div>
  `;

  modelsInfo.innerHTML = `
    <div class="model-item">
      <strong>Modelos Remotos (${remoteModels.length})</strong>
      <p>${remoteModels
        .map((m) => `${m.providerID}/${m.modelID}`)
        .join(" • ") || "Nenhum modelo configurado"}</p>
    </div>
    <div class="model-item">
      <strong>Modelos Ollama (${ollamaModels.length})</strong>
      <p>${ollamaModels.join(" • ") || "Nenhum modelo configurado"}</p>
    </div>
    <div class="model-item">
      <strong>Última Execução</strong>
      <p>Fonte: ${lastSource || "-"}</p>
      <p>Modelo: ${lastModel ? `${lastModel.providerID}/${lastModel.modelID}` : "-"}</p>
      <p>${lastSummary ? `Resumo: ${lastSummary}` : "Resumo indisponível"}</p>
      <div>
        <strong>Tentativas:</strong>
        <div class="attempts">
          ${lastAttempts.length
            ? lastAttempts
                .map(
                  (attempt) => `
                    <div class="tag">
                      ${attempt.source || attempt.providerID} → ${attempt.modelID || attempt.error || "erro"}
                    </div>
                  `,
                )
                .join("")
            : "<span class=\"muted\">Nenhuma</span>"}
        </div>
      </div>
    </div>
  `;
}

function renderRuns() {
  if (!state.runs.length) {
    runsLog.innerHTML = `<p class="muted">Nenhuma execução ainda.</p>`;
    return;
  }

  runsLog.innerHTML = state.runs
    .map((run) => `
      <article class="run-entry">
        <div class="meta">
          <span>${run.timestamp}</span>
          <span>Agente: ${run.agent}</span>
          <span>Fonte: ${run.source}</span>
          <span class="status-pill ${run.success ? "success" : "error"}">
            ${run.success ? "Sucesso" : "Falha"}
          </span>
        </div>
        <pre>${run.summary}</pre>
        ${run.attempts?.length
          ? `
              <div>
                <strong>Tentativas:</strong>
                <div class="attempts">
                  ${run.attempts
                    .map(
                      (attempt) => `
                        <div class="tag">
                          ${attempt.source || attempt.providerID} → ${attempt.modelID || attempt.error || "erro"}
                        </div>
                      `,
                    )
                    .join("")}
                </div>
              </div>
            `
          : ""}
      </article>
    `)
    .join("");
}

async function loadAgents() {
  try {
    const data = await fetchJSON("/api/agents");
    renderAgents(data);
  } catch (error) {
    agentsList.innerHTML = `<p class="muted">${error.message}</p>`;
  }
}

async function loadTools() {
  try {
    const data = await fetchJSON("/api/tools");
    renderTools(data);
  } catch (error) {
    toolsList.innerHTML = `<p class="muted">${error.message}</p>`;
  }
}

async function loadSdk() {
  try {
    const data = await fetchJSON("/api/sdk");
    renderModels(data);
  } catch (error) {
    modelsInfo.innerHTML = `<p class="muted">${error.message}</p>`;
    sdkStatus.innerHTML = `<div class="sdk-pill offline">${error.message}</div>`;
  }
}

async function runPrompt(evt) {
  evt.preventDefault();
  const payload = {
    prompt: promptInput.value,
    agent: agentSelect.value,
    fallback: useFallback.checked,
  };

  try {
    const res = await fetchJSON("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    state.runs.unshift({
      timestamp: new Date().toLocaleTimeString(),
      ...res,
    });
    state.runs = state.runs.slice(0, 10);
    renderRuns();
    loadSdk();
  } catch (error) {
    alert(error.message);
  }
}

runForm.addEventListener("submit", runPrompt);
refreshAgentsBtn.addEventListener("click", loadAgents);
refreshToolsBtn.addEventListener("click", loadTools);
refreshSdkBtn.addEventListener("click", loadSdk);

document.addEventListener("DOMContentLoaded", () => {
  loadAgents();
  loadTools();
  loadSdk();
  renderRuns();
});
