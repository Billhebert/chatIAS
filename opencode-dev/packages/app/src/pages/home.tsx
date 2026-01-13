import { useGlobalSync } from "@/context/global-sync"
import { createMemo, For, Match, Show, Switch } from "solid-js"
import { Button } from "@opencode-ai/ui/button"
import { useLayout } from "@/context/layout"
import { useNavigate } from "@solidjs/router"
import { base64Encode } from "@opencode-ai/util/encode"
import { Icon } from "@opencode-ai/ui/icon"
import { usePlatform } from "@/context/platform"
import { DateTime } from "luxon"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { DialogSelectDirectory } from "@/components/dialog-select-directory"
import { DialogSelectServer } from "@/components/dialog-select-server"
import { useServer } from "@/context/server"

export default function Home() {
  const sync = useGlobalSync()
  const layout = useLayout()
  const platform = usePlatform()
  const dialog = useDialog()
  const navigate = useNavigate()
  const server = useServer()
  const homedir = createMemo(() => sync.data.path.home)

  function openProject(directory: string) {
    layout.projects.open(directory)
    navigate(`/${base64Encode(directory)}`)
  }

  async function chooseProject() {
    function resolve(result: string | string[] | null) {
      if (Array.isArray(result)) {
        for (const directory of result) {
          openProject(directory)
        }
      } else if (result) {
        openProject(result)
      }
    }

    if (platform.openDirectoryPickerDialog && server.isLocal()) {
      const result = await platform.openDirectoryPickerDialog?.({
        title: "Abrir projeto",
        multiple: true,
      })
      resolve(result)
    } else {
      dialog.show(
        () => <DialogSelectDirectory multiple={true} onSelect={resolve} />,
        () => resolve(null),
      )
    }
  }

  return (
    <div class="flex flex-col w-full h-full">
      {/* Header mobile com menu hamburger */}
      <header class="xl:hidden h-12 shrink-0 bg-background-base border-b border-border-weak-base flex items-center">
        <button
          type="button"
          class="w-12 shrink-0 flex items-center justify-center border-r border-border-weak-base hover:bg-surface-raised-base-hover active:bg-surface-raised-base-active transition-colors"
          onClick={layout.mobileSidebar.toggle}
        >
          <Icon name="menu" size="small" />
        </button>
        <div class="flex-1 flex items-center justify-center">
          <span class="text-14-medium text-text-strong">SUATEC</span>
        </div>
        <div class="w-12" /> {/* Spacer para centralizar */}
      </header>

      {/* Conteúdo principal */}
      <div class="flex-1 flex items-start justify-center overflow-auto">
        <div class="mx-auto mt-20 xl:mt-55 w-full md:w-auto px-4">
          <div class="md:w-xl text-center">
            <h1 class="text-5xl font-bold text-text-strong opacity-80">SUATEC</h1>
            <p class="text-lg text-text-subtle mt-2">AGENTE DE IA</p>
          </div>
          <Button
            size="large"
            variant="ghost"
            class="mt-4 mx-auto text-14-regular text-text-weak"
            onClick={() => dialog.show(() => <DialogSelectServer />)}
          >
            <div
              classList={{
                "size-2 rounded-full": true,
                "bg-icon-success-base": server.healthy() === true,
                "bg-icon-critical-base": server.healthy() === false,
                "bg-border-weak-base": server.healthy() === undefined,
              }}
            />
            {server.name}
          </Button>
          <Switch>
            <Match when={sync.data.project.length > 0}>
              <div class="mt-20 w-full flex flex-col gap-4">
                <div class="flex gap-2 items-center justify-between pl-3">
                  <div class="text-14-medium text-text-strong">Projetos recentes</div>
                  <Button icon="folder-add-left" size="normal" class="pl-2 pr-3" onClick={chooseProject}>
                    Abrir projeto
                  </Button>
                </div>
                <ul class="flex flex-col gap-2">
                  <For
                    each={sync.data.project
                      .toSorted((a, b) => (b.time.updated ?? b.time.created) - (a.time.updated ?? a.time.created))
                      .slice(0, 5)}
                  >
                    {(project) => (
                      <Button
                        size="large"
                        variant="ghost"
                        class="text-14-mono text-left justify-between px-3"
                        onClick={() => openProject(project.worktree)}
                      >
                        {project.worktree.replace(homedir(), "~")}
                        <div class="text-14-regular text-text-weak">
                          {DateTime.fromMillis(project.time.updated ?? project.time.created).toRelative()}
                        </div>
                      </Button>
                    )}
                  </For>
                </ul>
              </div>
            </Match>
            <Match when={true}>
              <div class="mt-30 mx-auto flex flex-col items-center gap-3">
                <Icon name="folder-add-left" size="large" />
                <div class="flex flex-col gap-1 items-center justify-center">
                  <div class="text-14-medium text-text-strong">Nenhum projeto recente</div>
                  <div class="text-12-regular text-text-weak">Comece abrindo um projeto local</div>
                </div>
                <div />
                <Button class="px-3" onClick={chooseProject}>
                  Abrir projeto
                </Button>
              </div>
            </Match>
          </Switch>
        </div>
      </div>
    </div>
  )
}
