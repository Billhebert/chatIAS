import { useState, useEffect, useRef } from 'react'

const API_URL = import.meta.env.VITE_API_URL || ''

interface KnowledgeDocument {
  id: string
  name: string
  type: 'pdf' | 'txt' | 'docx' | 'url' | 'text'
  size: number
  chunks: number
  status: 'processing' | 'indexed' | 'error'
  createdAt: string
  lastAccessed?: string
}

interface KnowledgeBase {
  id: string
  name: string
  description?: string
  documents: KnowledgeDocument[]
  modelId?: string
  status: 'active' | 'inactive'
}

export default function KnowledgeBasePage() {
  const [bases, setBases] = useState<KnowledgeBase[]>([])
  const [selectedBase, setSelectedBase] = useState<KnowledgeBase | null>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [formData, setFormData] = useState({ name: '', description: '', modelId: '' })
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])

  const token = localStorage.getItem('token')

  const fetchWithAuth = async (url: string, options?: RequestInit) => {
    const headers = new Headers(options?.headers || {})
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(url, { ...options, headers })
  }

  useEffect(() => {
    loadBases()
  }, [])

  const loadBases = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/knowledge-bases`)
      if (res.ok) setBases(await res.json())
      else setBases(getDefaultBases())
    } catch {
      setBases(getDefaultBases())
    } finally {
      setLoading(false)
    }
  }

  const getDefaultBases = (): KnowledgeBase[] => [
    {
      id: '1',
      name: 'Base de Conhecimento Principal',
      description: 'Documentação e FAQs da empresa',
      status: 'active',
      modelId: '1',
      documents: [
        { id: '1', name: 'Manual do Produto.pdf', type: 'pdf', size: 2450000, chunks: 156, status: 'indexed', createdAt: new Date().toISOString() },
        { id: '2', name: 'FAQ.txt', type: 'txt', size: 45000, chunks: 23, status: 'indexed', createdAt: new Date().toISOString() },
        { id: '3', name: 'Política de Privacidade', type: 'url', size: 0, chunks: 45, status: 'indexed', createdAt: new Date().toISOString() },
      ]
    },
    {
      id: '2',
      name: 'Suporte Técnico',
      description: 'Artigos de suporte técnico',
      status: 'active',
      documents: [
        { id: '4', name: 'Guia de Instalação.pdf', type: 'pdf', size: 1200000, chunks: 89, status: 'indexed', createdAt: new Date().toISOString() },
        { id: '5', name: 'Troubleshooting.docx', type: 'docx', size: 890000, chunks: 67, status: 'processing', createdAt: new Date().toISOString() },
      ]
    },
  ]

  const handleCreateBase = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetchWithAuth(`${API_URL}/api/knowledge-bases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        setShowModal(false)
        setFormData({ name: '', description: '', modelId: '' })
        loadBases()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleFileUpload = async () => {
    if (selectedFiles.length === 0 || !selectedBase) return
    setUploading(true)
    try {
      for (const file of selectedFiles) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('baseId', selectedBase.id)
        await fetch(`${API_URL}/api/knowledge-bases/documents`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        })
      }
      setShowUploadModal(false)
      setSelectedFiles([])
      loadBases()
    } catch (e) {
      console.error(e)
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteDocument = async (baseId: string, docId: string) => {
    try {
      await fetchWithAuth(`${API_URL}/api/knowledge-bases/${baseId}/documents/${docId}`, {
        method: 'DELETE'
      })
      loadBases()
    } catch (e) {
      console.error(e)
    }
  }

  const handleDeleteBase = async (baseId: string) => {
    if (!confirm('Excluir esta base de conhecimento?')) return
    try {
      await fetchWithAuth(`${API_URL}/api/knowledge-bases/${baseId}`, {
        method: 'DELETE'
      })
      loadBases()
    } catch (e) {
      console.error(e)
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '-'
    const kb = bytes / 1024
    if (kb < 1024) return `${kb.toFixed(1)} KB`
    return `${(kb / 1024).toFixed(1)} MB`
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'pdf': return '📄'
      case 'txt': return '📝'
      case 'docx': return '📃'
      case 'url': return '🔗'
      default: return '📁'
    }
  }

  const filteredBases = bases.filter(b =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="size-full flex">
      <div className="w-80 border-r border-border-weak-base flex flex-col bg-surface-raised-base">
        <div className="p-4 border-b border-border-weak-base">
          <h2 className="font-medium text-text-strong mb-3">Bases de Conhecimento</h2>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            placeholder="Buscar..."
            className="input text-sm mb-3"
          />
          <button onClick={() => setShowModal(true)} className="btn-primary w-full text-sm">
            ➕ Nova Base
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-text-subtle">Carregando...</div>
          ) : filteredBases.length > 0 ? (
            filteredBases.map(base => (
              <button
                key={base.id}
                onClick={() => setSelectedBase(base)}
                className={`w-full p-4 text-left border-b border-border-weak-base/50 hover:bg-surface-raised-hover transition-colors ${
                  selectedBase?.id === base.id ? 'bg-surface-raised-hover' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-text-strong truncate">{base.name}</div>
                    <div className="text-sm text-text-subtle truncate">{base.description}</div>
                    <div className="text-xs text-text-subtle mt-1">
                      {base.documents.length} documento(s)
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    base.status === 'active' ? 'bg-green-500/30 text-green-300' : 'bg-gray-500/30 text-gray-300'
                  }`}>
                    {base.status}
                  </span>
                </div>
              </button>
            ))
          ) : (
            <div className="p-4 text-center text-text-subtle">
              Nenhuma base encontrada.
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {selectedBase ? (
          <>
            <div className="p-4 border-b border-border-weak-base bg-surface-raised-base flex items-center justify-between">
              <div>
                <h2 className="font-medium text-text-strong">{selectedBase.name}</h2>
                <p className="text-sm text-text-subtle">{selectedBase.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="btn-primary text-sm"
                >
                  📤 Upload
                </button>
                <button
                  onClick={() => handleDeleteBase(selectedBase.id)}
                  className="btn-secondary text-sm text-red-400"
                >
                  🗑️
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <h3 className="font-medium text-text-strong mb-4">Documentos</h3>
              {selectedBase.documents.length > 0 ? (
                <div className="space-y-3">
                  {selectedBase.documents.map(doc => (
                    <div key={doc.id} className="card">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{getTypeIcon(doc.type)}</span>
                          <div>
                            <div className="font-medium text-text-strong">{doc.name}</div>
                            <div className="text-sm text-text-subtle">
                              {formatSize(doc.size)} • {doc.chunks} chunks • {doc.type.toUpperCase()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            doc.status === 'indexed' ? 'bg-green-500/30 text-green-300' :
                            doc.status === 'processing' ? 'bg-yellow-500/30 text-yellow-300' :
                            'bg-red-500/30 text-red-300'
                          }`}>
                            {doc.status}
                          </span>
                          <button
                            onClick={() => handleDeleteDocument(selectedBase.id, doc.id)}
                            className="p-2 hover:bg-red-500/20 text-red-400 rounded"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="card text-center text-text-subtle py-8">
                  <div className="text-4xl mb-2">📂</div>
                  <p>Nenhum documento</p>
                  <button onClick={() => setShowUploadModal(true)} className="btn-primary mt-4">
                    Adicionar Documento
                  </button>
                </div>
              )}

              <div className="mt-8">
                <h3 className="font-medium text-text-strong mb-4">RAG Configuration</h3>
                <div className="card p-4">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-text-base mb-1">
                        Modelo de Embedding
                      </label>
                      <select className="input" defaultValue="text-embedding-3-small">
                        <option value="text-embedding-3-small">OpenAI text-embedding-3-small</option>
                        <option value="text-embedding-3-large">OpenAI text-embedding-3-large</option>
                        <option value="sentence-transformers">Sentence Transformers</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-text-base mb-1">
                          Chunk Size
                        </label>
                        <input type="number" className="input" defaultValue="1000" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-text-base mb-1">
                          Chunk Overlap
                        </label>
                        <input type="number" className="input" defaultValue="200" />
                      </div>
                    </div>
                    <button className="btn-secondary">Salvar Configuração</button>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-text-subtle">
            <div className="text-center">
              <div className="text-4xl mb-4">📚</div>
              <p>Selecione uma base de conhecimento</p>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised-base rounded-lg border border-border-weak-base p-6 w-full max-w-lg">
            <h3 className="text-lg font-medium text-text-strong mb-4">Nova Base de Conhecimento</h3>
            <form onSubmit={handleCreateBase} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-base mb-1">Nome</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.currentTarget.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-base mb-1">Descrição</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.currentTarget.value })}
                  className="input"
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary">Criar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised-base rounded-lg border border-border-weak-base p-6 w-full max-w-lg">
            <h3 className="text-lg font-medium text-text-strong mb-4">Upload de Documentos</h3>
            <div
              className="border-2 border-dashed border-border-weak-base rounded-lg p-8 text-center cursor-pointer hover:border-text-interactive-base transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="text-4xl mb-2">📤</div>
              <p className="text-text-base mb-2">Arraste arquivos aqui ou clique para selecionar</p>
              <p className="text-sm text-text-subtle">PDF, TXT, DOCX até 10MB</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.txt,.docx"
                onChange={(e) => setSelectedFiles(Array.from(e.currentTarget.files || []))}
                className="hidden"
              />
            </div>
            {selectedFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                {selectedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-surface-raised-base rounded">
                    <span className="text-sm text-text-base">{file.name}</span>
                    <span className="text-xs text-text-subtle">{formatSize(file.size)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-4">
              <button type="button" onClick={() => setShowUploadModal(false)} className="btn-secondary">Cancelar</button>
              <button
                onClick={handleFileUpload}
                className="btn-primary"
                disabled={selectedFiles.length === 0 || uploading}
              >
                {uploading ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
