export default function HomePage() {
  const projects = JSON.parse(localStorage.getItem('projects') || '[]')

  return (
    <div className="size-full p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-text-strong mb-6">OpenCode</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="card">
            <h2 className="font-medium text-text-strong mb-2">Quick Actions</h2>
            <p className="text-sm text-text-subtle mb-4">Start a new session.</p>
            <button className="btn-primary w-full">New Session</button>
          </div>
          <div className="card">
            <h2 className="font-medium text-text-strong mb-2">Recent</h2>
            <p className="text-sm text-text-subtle">View your recent projects.</p>
          </div>
          <div className="card">
            <h2 className="font-medium text-text-strong mb-2">Tools</h2>
            <p className="text-sm text-text-subtle mb-4">Access installed tools.</p>
            <button className="btn-secondary w-full">Manage</button>
          </div>
        </div>

        {projects.length > 0 && (
          <div>
            <h2 className="text-lg font-medium text-text-strong mb-4">Recent Projects</h2>
            <div className="space-y-2">
              {projects.slice(0, 5).map((project: any, i: number) => (
                <div key={i} className="card flex items-center gap-3">
                  <div className="size-10 rounded bg-text-interactive-base/20 flex items-center justify-center text-text-interactive-base">
                    📁
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-text-strong">{project.name || 'Project'}</div>
                    <div className="text-xs text-text-subtle">{project.path}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
