import { createSignal, Show, For, onMount, createResource } from "solid-js"
import { useAuth } from "@/context/auth"
import { Button } from "@opencode-ai/ui/button"
import { Icon } from "@opencode-ai/ui/icon"

export default function Login() {
  const auth = useAuth()
  const [mode, setMode] = createSignal<"login" | "register">("login")
  const [username, setUsername] = createSignal("")
  const [password, setPassword] = createSignal("")
  const [confirmPassword, setConfirmPassword] = createSignal("")
  const [error, setError] = createSignal("")
  const [showPassword, setShowPassword] = createSignal(false)
  const [loading, setLoading] = createSignal(false)
  const [publicUsers, setPublicUsers] = createSignal<{ id: string; username: string; role: string }[]>([])

  // Carregar lista publica de usuarios
  onMount(async () => {
    try {
      const users = await auth.getApiClient().getPublicUsers()
      setPublicUsers(users)
    } catch (err) {
      console.error("Failed to load users:", err)
    }
  })

  const isFirstUser = () => publicUsers().length === 0

  async function handleSubmit(e: Event) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      if (mode() === "register") {
        if (password() !== confirmPassword()) {
          setError("As senhas não coincidem")
          setLoading(false)
          return
        }
        const result = await auth.register(username(), password())
        if (!result.success) {
          setError(result.error || "Erro ao registrar")
        }
      } else {
        const result = await auth.login(username(), password())
        if (!result.success) {
          setError(result.error || "Erro ao fazer login")
        }
      }
    } catch (err: any) {
      setError(err.message || "Erro inesperado")
    } finally {
      setLoading(false)
    }
  }

  function toggleMode() {
    setMode(mode() === "login" ? "register" : "login")
    setError("")
    setPassword("")
    setConfirmPassword("")
  }

  return (
    <div class="size-full flex items-center justify-center bg-background-base">
      <div class="w-full max-w-md p-8">
        <div class="text-center mb-10">
          <h1 class="text-6xl font-bold text-text-strong mb-4 tracking-tight">SUATEC</h1>
          <p class="text-text-subtle text-lg">Agente de IA Inteligente</p>
          <p class="text-text-base text-base mt-2">
            {mode() === "login" ? "Entre na sua conta" : "Crie uma nova conta"}
          </p>
          <Show when={isFirstUser()}>
            <div class="mt-4 p-3 rounded-lg bg-blue-500/20 border border-blue-500/30">
              <div class="flex items-center justify-center gap-2 text-blue-300">
                <Icon name="info-circle" size="small" />
                <span class="text-sm font-medium">Primeiro usuário será o Master</span>
              </div>
            </div>
          </Show>
        </div>

        <form onSubmit={handleSubmit} class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-text-base mb-1">Usuário</label>
            <input
              type="text"
              value={username()}
              onInput={(e) => setUsername(e.currentTarget.value)}
              class="w-full px-4 py-3 rounded-lg bg-background-stronger border border-border-weak-base text-text-strong focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-text-subtle"
              placeholder="Digite seu usuário"
              autocomplete="username"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-text-base mb-1">Senha</label>
            <div class="relative">
              <input
                type={showPassword() ? "text" : "password"}
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
                class="w-full px-4 py-3 rounded-lg bg-background-stronger border border-border-weak-base text-text-strong focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-text-subtle pr-12"
                placeholder="Digite sua senha"
                autocomplete={mode() === "login" ? "current-password" : "new-password"}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword())}
                class="absolute right-3 top-1/2 -translate-y-1/2 text-text-subtle hover:text-text-base transition-colors"
              >
                <Icon name={showPassword() ? "eye-off" : "eye"} size="small" />
              </button>
            </div>
          </div>

          <Show when={mode() === "register"}>
            <div>
              <label class="block text-sm font-medium text-text-base mb-1">Confirmar Senha</label>
              <input
                type={showPassword() ? "text" : "password"}
                value={confirmPassword()}
                onInput={(e) => setConfirmPassword(e.currentTarget.value)}
                class="w-full px-4 py-3 rounded-lg bg-background-stronger border border-border-weak-base text-text-strong focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-text-subtle"
                placeholder="Confirme sua senha"
                autocomplete="new-password"
              />
            </div>
          </Show>

          <Show when={error()}>
            <div class="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm text-center">
              {error()}
            </div>
          </Show>

          <Button type="submit" class="w-full py-3 text-base font-medium" disabled={loading()}>
            {loading() ? "Aguarde..." : mode() === "login" ? "Entrar" : "Registrar"}
          </Button>
        </form>

        <div class="mt-6 text-center">
          <button
            type="button"
            onClick={toggleMode}
            class="text-blue-400 hover:text-blue-300 hover:underline text-sm transition-colors"
          >
            {mode() === "login"
              ? "Não tem conta? Registre-se"
              : "Já tem conta? Faça login"}
          </button>
        </div>

        <Show when={publicUsers().length > 0 && mode() === "login"}>
          <div class="mt-8 pt-6 border-t border-border-weak-base">
            <p class="text-sm text-text-subtle mb-3">Selecione um usuário:</p>
            <div class="space-y-2">
              <For each={publicUsers()}>
                {(user) => (
                  <button
                    type="button"
                    onClick={() => setUsername(user.username)}
                    class="w-full text-left px-4 py-3 rounded-lg bg-surface-raised-base hover:bg-surface-raised-base-hover border border-border-weak-base text-text-base text-sm flex items-center justify-between gap-2 transition-colors"
                  >
                    <div class="flex items-center gap-3">
                      <div class="size-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-300 font-medium">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <span class="text-text-strong">{user.username}</span>
                    </div>
                    <span class={`text-xs px-2 py-0.5 rounded ${
                      user.role === "master" 
                        ? "bg-purple-500/30 text-purple-300" 
                        : user.role === "admin" 
                          ? "bg-blue-500/30 text-blue-300" 
                          : "bg-gray-500/30 text-gray-300"
                    }`}>
                      {user.role === "master" ? "Master" : user.role === "admin" ? "Admin" : "Usuário"}
                    </span>
                  </button>
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>
    </div>
  )
}
