import { useRouteError, useNavigate } from 'react-router-dom'

export default function ErrorPage() {
  const error = useRouteError()
  const navigate = useNavigate()

  return (
    <div className="size-full flex items-center justify-center bg-background-base">
      <div className="text-center max-w-md p-8">
        <div className="text-6xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold text-text-strong mb-2">Erro</h1>
        <p className="text-text-subtle mb-6">
          {error instanceof Error ? error.message : 'Algo deu errado.'}
        </p>
        <div className="flex gap-4 justify-center">
          <button onClick={() => navigate('/')} className="btn-primary">
            Voltar ao Início
          </button>
          <button onClick={() => window.location.reload()} className="btn-secondary">
            Recarregar
          </button>
        </div>
      </div>
    </div>
  )
}
