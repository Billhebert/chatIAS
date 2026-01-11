const form = document.getElementById("chat-form");
const input = document.getElementById("chat-input");
const agentSelect = document.getElementById("chat-agent");
const fallbackCheckbox = document.getElementById("chat-fallback");
const messages = document.getElementById("messages");
const historyList = document.getElementById("history-list");

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

function createMessage({ role, text, source, agent, attempts = [], log = [] }) {
  const article = document.createElement("article");
  article.className = `message ${role}`;

  // Normalizar o source para ter um nome amigável
  const sourceDisplay = {
    local: "LOCAL",
    remote: "REMOTE",
    ollama: "OLLAMA",
    tool: "TOOL",
  }[source] || source?.toUpperCase() || "LOCAL";

  const header = document.createElement("div");
  header.className = "message-header";
  header.innerHTML = `
    <span>${role === "user" ? "Você" : agent || "Agente"}</span>
    <span>
      <span class="message-dot ${source || "local"}"></span>
      ${sourceDisplay}
    </span>
  `;

  const body = document.createElement("div");
  body.className = "message-body";
  body.textContent = text;

  article.appendChild(header);
  article.appendChild(body);

  // Exibir log de execução se houver
  if (log.length) {
    const logWrapper = document.createElement("div");
    logWrapper.className = "message-log";
    const list = document.createElement("ul");
    log.forEach((entry) => {
      const item = document.createElement("li");
      item.textContent = `[${new Date(entry.timestamp).toLocaleTimeString()}] ${entry.message}`;
      list.appendChild(item);
    });
    logWrapper.appendChild(list);
    article.appendChild(logWrapper);
  }

  // Exibir tentativas de modelos se houver
  if (attempts.length) {
    const legend = document.createElement("div");
    legend.className = "message-legend";
    attempts.forEach((attempt) => {
      const pill = document.createElement("span");
      const origin = attempt.source === "ollama" ? "ollama" : "remote";
      pill.className = "legend-pill";
      pill.innerHTML = `
        <span class="message-dot ${origin}"></span>
        ${attempt.source || attempt.providerID} → ${attempt.modelID || attempt.error || "erro"}
      `;
      legend.appendChild(pill);
    });
    article.appendChild(legend);
  }

  messages.appendChild(article);
  messages.scrollTop = messages.scrollHeight;
}

async function refreshHistory() {
  try {
    const data = await fetchJSON("/api/sdk");
    const history = data.history || [];
    const extra = data.sdk?.lastSuccessAt
      ? `<li class="history-meta">Última resposta remota em ${new Date(data.sdk.lastSuccessAt).toLocaleTimeString()}</li>`
      : "";
    historyList.innerHTML =
      extra +
      history
        .map(
          (item) => `
        <li>
          <strong>${new Date(item.timestamp).toLocaleTimeString()}</strong>
          — ${item.agent} • ${item.source || "local"}
        </li>
      `,
        )
        .join("");
  } catch (error) {
    historyList.innerHTML = `<li>${error.message}</li>`;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const prompt = input.value.trim();
  if (!prompt) return;

  createMessage({ role: "user", text: prompt });
  input.value = "";

  try {
    const response = await fetchJSON("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        agent: agentSelect.value,
        fallback: fallbackCheckbox.checked,
      }),
    });

    createMessage({
      role: "agent",
      text: response.summary,
      source: response.source,
      agent: response.agent,
      attempts: response.attempts,
      log: response.log,
    });

    refreshHistory();
  } catch (error) {
    createMessage({
      role: "agent",
      text: `Erro: ${error.message}`,
      source: "erro",
      agent: "Sistema",
    });
  }
});

refreshHistory();
