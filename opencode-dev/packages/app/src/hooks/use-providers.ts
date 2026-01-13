import { useGlobalSync } from "@/context/global-sync"
import { useAuth } from "@/context/auth"
import { base64Decode } from "@opencode-ai/util/encode"
import { useParams } from "@solidjs/router"
import { createMemo } from "solid-js"

export const popularProviders = ["opencode", "anthropic", "github-copilot", "openai", "google", "openrouter", "vercel"]

export function useProviders() {
  const globalSync = useGlobalSync()
  const auth = useAuth()
  const params = useParams()
  const currentDirectory = createMemo(() => base64Decode(params.dir ?? ""))
  
  const rawProviders = createMemo(() => {
    if (currentDirectory()) {
      const [projectStore] = globalSync.child(currentDirectory())
      return projectStore.provider
    }
    return globalSync.data.provider
  })

  // Filtrar provedores baseado nas permissões do usuário
  const filteredProviders = createMemo(() => {
    const permissions = auth.getUserPermissions()
    if (!permissions) return { all: [], connected: [], default: rawProviders().default }
    
    // Se tem permissão para todos, retorna tudo
    if (permissions.providers.includes("*")) {
      return rawProviders()
    }

    // Filtrar apenas provedores permitidos
    const allowedProviderIds = permissions.providers
    const filteredAll = rawProviders().all.filter(p => allowedProviderIds.includes(p.id))
    const filteredConnected = rawProviders().connected.filter(id => allowedProviderIds.includes(id))
    
    return {
      all: filteredAll,
      connected: filteredConnected,
      default: rawProviders().default,
    }
  })

  const connected = createMemo(() => 
    filteredProviders().all.filter((p) => filteredProviders().connected.includes(p.id))
  )
  
  const paid = createMemo(() =>
    connected().filter((p) => p.id !== "opencode" || Object.values(p.models).find((m) => m.cost?.input)),
  )
  
  const popular = createMemo(() => 
    filteredProviders().all.filter((p) => popularProviders.includes(p.id))
  )

  // Filtrar modelos baseado nas permissões
  const filterModels = (provider: any) => {
    const permissions = auth.getUserPermissions()
    if (!permissions) return {}
    
    // Se tem permissão para todos os modelos, retorna tudo
    if (permissions.models.includes("*")) {
      return provider.models
    }

    // Filtrar apenas modelos permitidos
    const allowedModelIds = permissions.models
    const filteredModels: Record<string, any> = {}
    
    for (const [modelId, model] of Object.entries(provider.models || {})) {
      if (allowedModelIds.includes(modelId) || allowedModelIds.includes(`${provider.id}/${modelId}`)) {
        filteredModels[modelId] = model
      }
    }
    
    return filteredModels
  }

  return {
    all: createMemo(() => filteredProviders().all),
    default: createMemo(() => filteredProviders().default),
    popular,
    connected,
    paid,
    filterModels,
    // Expor função para verificar se pode usar provedor/modelo
    canUseProvider: (providerId: string) => auth.canUseProvider(providerId),
    canUseModel: (modelId: string) => auth.canUseModel(modelId),
  }
}
