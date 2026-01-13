import { createMemo, createSignal, Show, onMount, onCleanup } from "solid-js"
import { Button } from "@opencode-ai/ui/button"
import { Icon } from "@opencode-ai/ui/icon"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { useGlobalSDK } from "@/context/global-sdk"
import { useParams } from "@solidjs/router"

interface RAGSource {
  filename: string
  score: number
}

interface RAGContextEvent {
  sessionID: string
  userId: string
  contextLength: number
  sourcesCount: number
  sources: RAGSource[]
}

export function SessionRagIndicator() {
  const globalSDK = useGlobalSDK()
  const params = useParams()
  
  const [ragActive, setRagActive] = createSignal(false)
  const [lastContext, setLastContext] = createSignal<RAGContextEvent | null>(null)
  const [fadeOut, setFadeOut] = createSignal(false)
  
  let fadeTimeout: ReturnType<typeof setTimeout> | null = null
  
  onMount(() => {
    // Subscribe to RAG context events via the global emitter
    // Events come from the "global" directory for global events
    const unsubscribe = globalSDK.event.on("global", (event: any) => {
      if (event.type === "rag.context.injected") {
        const props = event.properties as RAGContextEvent
        // Only show if it's for the current session
        if (props.sessionID === params.id) {
          setLastContext(props)
          setRagActive(true)
          setFadeOut(false)
          
          // Clear existing timeout
          if (fadeTimeout) {
            clearTimeout(fadeTimeout)
          }
          
          // Start fade out after 5 seconds
          fadeTimeout = setTimeout(() => {
            setFadeOut(true)
            // Hide completely after fade animation
            setTimeout(() => {
              setRagActive(false)
              setFadeOut(false)
            }, 300)
          }, 5000)
        }
      }
    })
    
    onCleanup(() => {
      unsubscribe()
      if (fadeTimeout) {
        clearTimeout(fadeTimeout)
      }
    })
  })
  
  const tooltipContent = createMemo(() => {
    const ctx = lastContext()
    if (!ctx) return "RAG ativo"
    
    const sources = ctx.sources.slice(0, 3)
    const sourceList = sources
      .map(s => `${s.filename} (${(s.score * 100).toFixed(0)}%)`)
      .join(", ")
    
    return `RAG: ${ctx.sourcesCount} fonte(s) usada(s) - ${sourceList}`
  })

  return (
    <Show when={ragActive()}>
      <Tooltip value={tooltipContent()}>
        <Button 
          variant="ghost" 
          class={`transition-opacity duration-300 ${fadeOut() ? 'opacity-0' : 'opacity-100'}`}
        >
          <div class="size-1.5 rounded-full bg-blue-500 animate-pulse" />
          <Icon name="brain" size="small" class="text-blue-500" />
          <span class="text-12-regular text-blue-500">
            RAG ({lastContext()?.sourcesCount || 0})
          </span>
        </Button>
      </Tooltip>
    </Show>
  )
}
