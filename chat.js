import { createOpencode } from "./sdk/index.js";
import dotenv from "dotenv";
dotenv.config();

// export
class OpenCodeManager {
  constructor() {
    this.initialized = false;
    this.sdkPort = process.env.SDK_PORT;
    this.opencode = null;
    this.client = null;
    this.models = [
      {
        providerID: "opencode",
        modelID: "minimax-m2.1-free",
      },
      {
        providerID: "opencode",
        modelID: "glm-4.7-free",
      },
      {
        providerID: "openrouter",
        modelID: "kwaipilot/kat-coder-pro:free",
      },
      {
        providerID: "openrouter",
        modelID: "google/gemini-2.0-flash-exp:free",
      },
      {
        providerID: "openrouter",
        modelID: "qwen/qwen3-coder:free",
      },
      {
        providerID: "openrouter",
        modelID: "mistralai/devstral-2512:free",
      },
      {
        providerID: "openrouter",
        modelID: "meta-llama/llama-3.3-70b-instruct:free",
      },
      {
        providerID: "openrouter",
        modelID: "mistralai/devstral-small-2507",
      },
      {
        providerID: "openrouter",
        modelID: "z-ai/glm-4.5-air:free",
      },
      {
        providerID: "zenmux",
        modelID: "xiaomi/mimo-v2-flash-free",
      },
      {
        providerID: "zenmux",
        modelID: "z-ai/glm-4.6v-flash-free",
      },
      {
        providerID: "zenmux",
        modelID: "kuaishou/kat-coder-pro-v1-free",
      },
    ];
  }
  async create() {
    this.opencode = await createOpencode({
      hostname: "127.0.0.1",
      port: this.sdkPort,
    });
    this.client = this.opencode.client;
  }
}
class OpencodeCliente extends OpenCodeManager {
  constructor() {
    super();
    this.sessionId = null;
  }

  async createSession(title = "Chat Session", cliente) {
    console.log("Criando sessão...");
    const sessionRes = await cliente.session.create({
      body: { title: title },
    });
    this.sessionId = sessionRes?.data?.id ?? sessionRes?.id ?? null;
    if (this.sessionId) {
      console.log(`🧩 Session criada: ${this.sessionId}`);
    }
  }

  async createMessage(session, providerID, modelID, parts, number = 0) {
    try {
      var model =
        number > 0
          ? this.models[number]
          : { providerID: providerID, modelID: modelID };
      console.log(model);
      var result = await session.session.prompt({
        path: { id: this.sessionId },
        body: {
          model: model,
          parts: parts,
        },
      });
      if (
        result?.error ||
        result?.data?.error ||
        result.data === null ||
        Reflect.ownKeys(result.data).length === 0
      ) {
        console.log("Erro ao gerar resposta, tentando próximo modelo...");
        throw new Error(result.error.message || "Erro desconhecido");
      }
      return result;
    } catch (error) {
      try {
        if (number < this.models.length) {
          return await this.createMessage(
            session,
            null,
            null,
            parts,
            number + 1
          );
        }

        const ollamaResponse = await this.generateResponseWithOllama(
          "TESTE",
          "Escreva um poema sobre inteligência artificial."
        );
        console.log("Resposta gerada com Ollama.");
        console.log(ollamaResponse);
        return ollamaResponse;
      } catch (error) {
        console.log(error);
        return true;
      }
    }
  }

  async shutdown() {
    if (!this.opencode) return;

    try {
      await this.opencode.server.close();
      console.log(`🛑 OpenCode SDK encerrado`);
    } catch (error) {
      console.warn(`Erro ao encerrar OpenCode SDK: ${error}`);
    }
  }
}

async function init() {
  var client = await new OpencodeCliente();
  await client.create();
  await client.createSession("Teste de Chat", client.client);
  var mensagem = await client
    .createMessage(client.client, "opencode1", "glm-4.7-free", [
      { type: "text", text: "Escreva um poema sobre inteligência artificial." },
    ])
    .then((response) => {
      //console.log("Resposta:", response);
      client.shutdown();
    });
  //console.log(mensagem);
}
init();
