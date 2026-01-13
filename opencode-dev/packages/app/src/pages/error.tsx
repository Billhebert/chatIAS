import { TextField } from "@opencode-ai/ui/text-field"
import { Button } from "@opencode-ai/ui/button"
import { Component, Show, createMemo } from "solid-js"
import { createStore } from "solid-js/store"
import { usePlatform } from "@/context/platform"

export type InitError = {
  name: string
  data: Record<string, unknown>
}

function isInitError(error: unknown): error is InitError {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    "data" in error &&
    typeof (error as InitError).data === "object"
  )
}

function safeJson(value: unknown): string {
  const seen = new WeakSet<object>()
  const json = JSON.stringify(
    value,
    (_key, val) => {
      if (typeof val === "bigint") return val.toString()
      if (typeof val === "object" && val) {
        if (seen.has(val)) return "[Circular]"
        seen.add(val)
      }
      return val
    },
    2,
  )
  return json ?? String(value)
}

// Tipos de erro e suas mensagens amigáveis
type ErrorInfo = {
  title: string
  message: string
  suggestion: string
  technicalDetails?: string
}

function getErrorInfo(error: unknown): ErrorInfo {
  // Erro de conexão com servidor
  if (error instanceof Error && error.message.includes("servidor")) {
    return {
      title: "Serviço Temporariamente Indisponível",
      message: "Não foi possível estabelecer conexão com o servidor de processamento.",
      suggestion: "Aguarde alguns instantes e tente novamente. Se o problema persistir, verifique sua conexão com a internet ou entre em contato com o suporte técnico.",
      technicalDetails: error.message,
    }
  }

  if (isInitError(error)) {
    const data = error.data
    switch (error.name) {
      case "MCPFailed":
        return {
          title: "Serviço de Integração Indisponível",
          message: `O serviço de integração "${data.name}" não está respondendo no momento.`,
          suggestion: "Nossa equipe técnica foi notificada. Por favor, tente novamente em alguns minutos.",
          technicalDetails: `MCP Server: ${data.name}`,
        }
      case "ProviderAuthError": {
        const providerID = typeof data.providerID === "string" ? data.providerID : "desconhecido"
        return {
          title: "Problema de Autenticação",
          message: "Não foi possível validar as credenciais de acesso ao serviço de IA.",
          suggestion: "Verifique se suas credenciais estão configuradas corretamente nas configurações do sistema.",
          technicalDetails: `Provedor: ${providerID}`,
        }
      }
      case "APIError": {
        const statusCode = typeof data.statusCode === "number" ? data.statusCode : undefined
        let title = "Erro de Comunicação"
        let message = "Ocorreu um problema ao processar sua solicitação."
        
        if (statusCode === 429) {
          title = "Limite de Uso Atingido"
          message = "O limite de requisições foi temporariamente excedido."
        } else if (statusCode && statusCode >= 500) {
          title = "Serviço em Manutenção"
          message = "O servidor está passando por manutenção ou enfrentando alta demanda."
        } else if (statusCode === 401 || statusCode === 403) {
          title = "Acesso Não Autorizado"
          message = "Suas credenciais de acesso precisam ser atualizadas."
        }
        
        return {
          title,
          message,
          suggestion: "Aguarde alguns instantes e tente novamente. Se o problema persistir, entre em contato com o suporte.",
          technicalDetails: statusCode ? `Código: ${statusCode}` : undefined,
        }
      }
      case "ProviderModelNotFoundError": {
        const { providerID, modelID } = data as { providerID: string; modelID: string }
        return {
          title: "Modelo de IA Não Disponível",
          message: "O modelo de inteligência artificial selecionado não está disponível no momento.",
          suggestion: "Selecione outro modelo nas configurações ou aguarde a disponibilidade ser restabelecida.",
          technicalDetails: `Modelo: ${providerID}/${modelID}`,
        }
      }
      case "ProviderInitError": {
        const providerID = typeof data.providerID === "string" ? data.providerID : "desconhecido"
        return {
          title: "Serviço de IA Indisponível",
          message: "Não foi possível inicializar o serviço de inteligência artificial.",
          suggestion: "Verifique suas configurações de API ou tente novamente em alguns instantes.",
          technicalDetails: `Provedor: ${providerID}`,
        }
      }
      case "ConfigJsonError":
      case "ConfigDirectoryTypoError":
      case "ConfigFrontmatterError":
      case "ConfigInvalidError":
        return {
          title: "Configuração Inválida",
          message: "Foi detectado um problema no arquivo de configuração do sistema.",
          suggestion: "Entre em contato com o administrador do sistema para verificar as configurações.",
          technicalDetails: typeof data.path === "string" ? `Arquivo: ${data.path}` : undefined,
        }
      default:
        break
    }
  }

  // Erro genérico
  const errorMessage = error instanceof Error ? error.message : String(error)
  return {
    title: "Sistema em Manutenção",
    message: "Estamos trabalhando para resolver um problema técnico.",
    suggestion: "Por favor, aguarde alguns instantes e tente novamente. Agradecemos sua compreensão.",
    technicalDetails: errorMessage,
  }
}

function formatTechnicalDetails(error: unknown): string {
  if (!error) return "Erro desconhecido"
  
  if (error instanceof Error) {
    return error.stack || error.message
  }
  
  if (isInitError(error)) {
    return `${error.name}: ${safeJson(error.data)}`
  }
  
  return safeJson(error)
}

interface ErrorPageProps {
  error: unknown
}

export const ErrorPage: Component<ErrorPageProps> = (props) => {
  const platform = usePlatform()
  const [store, setStore] = createStore({
    checking: false,
    version: undefined as string | undefined,
    showDetails: false,
  })

  const errorInfo = createMemo(() => getErrorInfo(props.error))

  async function checkForUpdates() {
    if (!platform.checkUpdate) return
    setStore("checking", true)
    const result = await platform.checkUpdate()
    setStore("checking", false)
    if (result.updateAvailable && result.version) setStore("version", result.version)
  }

  async function installUpdate() {
    if (!platform.update || !platform.restart) return
    await platform.update()
    await platform.restart()
  }

  return (
    <div class="relative flex-1 h-screen w-screen min-h-0 flex flex-col items-center justify-center bg-background-base font-sans">
      <div class="w-full max-w-2xl px-8 flex flex-col items-center justify-center gap-6">
        {/* Logo */}
        <h1 class="text-5xl font-bold tracking-tight text-white">SUATEC</h1>
        
        {/* Ícone de manutenção */}
        <div class="w-24 h-24 rounded-full bg-amber-500/20 flex items-center justify-center border-2 border-amber-500/30">
          <svg class="w-12 h-12 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        {/* Título e mensagem principal */}
        <div class="flex flex-col items-center gap-4 text-center">
          <h2 class="text-3xl font-bold text-white">{errorInfo().title}</h2>
          <p class="text-lg text-gray-300 max-w-md leading-relaxed">
            {errorInfo().message}
          </p>
        </div>

        {/* Sugestão */}
        <div class="bg-white/10 border border-white/20 rounded-xl px-6 py-5 max-w-lg backdrop-blur-sm">
          <p class="text-white text-center leading-relaxed">
            {errorInfo().suggestion}
          </p>
        </div>

        {/* Botões de ação */}
        <div class="flex flex-wrap items-center justify-center gap-4 mt-4">
          <Button size="large" onClick={platform.restart}>
            Tentar Novamente
          </Button>
          <Show when={platform.checkUpdate}>
            <Show
              when={store.version}
              fallback={
                <Button size="large" variant="ghost" onClick={checkForUpdates} disabled={store.checking}>
                  {store.checking ? "Verificando..." : "Verificar Atualizações"}
                </Button>
              }
            >
              <Button size="large" onClick={installUpdate}>
                Atualizar para {store.version}
              </Button>
            </Show>
          </Show>
        </div>

        {/* Detalhes técnicos (colapsável) */}
        <div class="w-full max-w-md mt-6">
          <button
            type="button"
            class="w-full text-sm text-gray-500 hover:text-gray-300 transition-colors flex items-center justify-center gap-2"
            onClick={() => setStore("showDetails", !store.showDetails)}
          >
            <span>{store.showDetails ? "Ocultar" : "Mostrar"} detalhes técnicos</span>
            <svg 
              class="w-4 h-4 transition-transform" 
              classList={{ "rotate-180": store.showDetails }}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          <Show when={store.showDetails}>
            <div class="mt-3">
              <TextField
                value={formatTechnicalDetails(props.error)}
                readOnly
                copyable
                multiline
                class="max-h-48 w-full font-mono text-xs"
                label="Detalhes técnicos"
                hideLabel
              />
            </div>
          </Show>
        </div>

        {/* Rodapé */}
        <div class="mt-8 flex flex-col items-center gap-2 text-center">
          <p class="text-sm text-gray-500">
            Se o problema persistir, entre em contato com o suporte técnico.
          </p>
          <Show when={platform.version}>
            <p class="text-xs text-gray-600">Versão {platform.version}</p>
          </Show>
        </div>
      </div>
    </div>
  )
}
