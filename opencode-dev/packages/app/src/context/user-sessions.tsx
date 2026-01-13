import { createContext, useContext, type ParentProps, createMemo } from "solid-js"
import { createStore } from "solid-js/store"
import { persisted, Persist } from "@/utils/persist"
import { useAuth } from "./auth"

// Mapeamento de sessões por usuário
interface UserSessionsState {
  // sessionId -> userId
  sessionOwners: Record<string, string>
}

interface UserSessionsContextValue {
  // Registra uma sessão como pertencente ao usuário atual
  registerSession: (sessionId: string) => void
  // Verifica se uma sessão pertence ao usuário atual
  isUserSession: (sessionId: string) => boolean
  // Filtra lista de sessões para mostrar apenas as do usuário atual
  filterUserSessions: <T extends { id: string }>(sessions: T[]) => T[]
  // Remove mapeamento de sessão (quando deletada/arquivada)
  unregisterSession: (sessionId: string) => void
  // Retorna o userId dono da sessão
  getSessionOwner: (sessionId: string) => string | undefined
  // Adota sessões órfãs (sem dono) para o usuário atual - útil para migrações
  adoptOrphanSessions: (sessionIds: string[]) => void
}

const UserSessionsContext = createContext<UserSessionsContextValue>()

export function UserSessionsProvider(props: ParentProps) {
  const auth = useAuth()
  
  const [store, setStore] = createStore<UserSessionsState>({
    sessionOwners: {},
  })

  // Persiste o mapeamento de sessões
  persisted(Persist.global("suatec.user-sessions"), [store, setStore])

  const currentUserId = createMemo(() => auth.currentUser()?.id ?? null)

  const registerSession = (sessionId: string) => {
    const userId = currentUserId()
    if (!userId) return
    
    setStore("sessionOwners", sessionId, userId)
  }

  const unregisterSession = (sessionId: string) => {
    setStore("sessionOwners", (prev) => {
      const next = { ...prev }
      delete next[sessionId]
      return next
    })
  }

  const getSessionOwner = (sessionId: string): string | undefined => {
    return store.sessionOwners[sessionId]
  }

  const isUserSession = (sessionId: string): boolean => {
    const userId = currentUserId()
    if (!userId) return false
    
    const owner = store.sessionOwners[sessionId]
    
    // Se não tem dono registrado:
    // - Master/Admin pode ver todas as sessões órfãs
    // - Usuários normais não veem sessões órfãs
    if (!owner) {
      return auth.isMaster() || auth.isAdmin()
    }
    
    return owner === userId
  }

  const filterUserSessions = <T extends { id: string }>(sessions: T[]): T[] => {
    const userId = currentUserId()
    if (!userId) return []
    
    return sessions.filter((session) => {
      const owner = store.sessionOwners[session.id]
      
      // Sessões sem dono são visíveis apenas para master/admin
      if (!owner) {
        return auth.isMaster() || auth.isAdmin()
      }
      
      return owner === userId
    })
  }

  // Adota sessões órfãs para o usuário atual (útil para migrações)
  const adoptOrphanSessions = (sessionIds: string[]) => {
    const userId = currentUserId()
    if (!userId) return
    
    for (const sessionId of sessionIds) {
      if (!store.sessionOwners[sessionId]) {
        setStore("sessionOwners", sessionId, userId)
      }
    }
  }

  const value: UserSessionsContextValue = {
    registerSession,
    unregisterSession,
    isUserSession,
    filterUserSessions,
    getSessionOwner,
    adoptOrphanSessions,
  }

  return (
    <UserSessionsContext.Provider value={value}>
      {props.children}
    </UserSessionsContext.Provider>
  )
}

export function useUserSessions() {
  const context = useContext(UserSessionsContext)
  if (!context) {
    throw new Error("useUserSessions must be used within a UserSessionsProvider")
  }
  return context
}
