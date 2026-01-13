// @refresh reload
import { render } from "solid-js/web"
import { AppBaseProviders, AppInterface } from "@/app"
import { Platform, PlatformProvider } from "@/context/platform"
import { getStoredToken } from "@/api/user-api"
import pkg from "../package.json"

const root = document.getElementById("root")
if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    "Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?",
  )
}

// SUATEC: Custom fetch that adds auth token to all requests
const authenticatedFetch: any = async (input: Request | string, init?: RequestInit) => {
  const token = getStoredToken()
  
  // Handle both Request objects and URL strings
  if (input instanceof Request) {
    // Clone the request and add auth header
    const headers = new Headers(input.headers)
    if (token) headers.set("Authorization", `Bearer ${token}`)
    
    // DEBUG - only log POST requests to /message or /session
    if (input.method === "POST" && (input.url.includes("/message") || input.url.endsWith("/session"))) {
      const bodyText = input.body ? await input.clone().text() : ""
      console.log("[SUATEC FETCH]", input.method, input.url)
      console.log("[SUATEC FETCH] Token present:", !!token, token ? token.substring(0, 20) + "..." : "none")
      console.log("[SUATEC FETCH] Body:", bodyText.substring(0, 300))
    }
    
    const newRequest = new Request(input, { headers })
    return fetch(newRequest)
  } else {
    // Original path for URL strings
    const headers = Object.assign({}, init?.headers || {})
    if (token) (headers as any)["Authorization"] = `Bearer ${token}`
    return fetch(input, { ...init, headers })
  }
}

const platform: Platform = {
  platform: "web",
  version: pkg.version,
  fetch: authenticatedFetch as any,
  openLink(url: string) {
    window.open(url, "_blank")
  },
  restart: async () => {
    window.location.reload()
  },
  notify: async (title, description, href) => {
    if (!("Notification" in window)) return


    const permission =
      Notification.permission === "default"
        ? await Notification.requestPermission().catch(() => "denied")
        : Notification.permission

    if (permission !== "granted") return

    const inView = document.visibilityState === "visible" && document.hasFocus()
    if (inView) return

    await Promise.resolve()
      .then(() => {
        const notification = new Notification(title, {
          body: description ?? "",
          icon: "https://opencode.ai/favicon-96x96.png",
        })
        notification.onclick = () => {
          window.focus()
          if (href) {
            window.history.pushState(null, "", href)
            window.dispatchEvent(new PopStateEvent("popstate"))
          }
          notification.close()
        }
      })
      .catch(() => undefined)
  },
}

render(
  () => (
    <PlatformProvider value={platform}>
      <AppBaseProviders>
        <AppInterface />
      </AppBaseProviders>
    </PlatformProvider>
  ),
  root!,
)
