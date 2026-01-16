import { useState } from 'react'

const APP_VERSION = '3.0.0'

const FAQS = [
  {
    question: 'Como adicionar um novo agente?',
    answer: 'Vá em Users > Novo Usuário e defina o cargo como "Agent". O agente receberá um email com instruções de login.'
  },
  {
    question: 'Como configurar o WhatsApp?',
    answer: 'Acesse Integrações > Nova Integração e selecione "Evolution API". Você precisará da URL da sua instância Evolution e do token de acesso.'
  },
  {
    question: 'Como criar templates de mensagem?',
    answer: 'Vá em Templates > Novo Template. Use variáveis como {{name}} para personalização. As variáveis serão substituídas automaticamente.'
  },
  {
    question: 'Como funciona a base de conhecimento?',
    answer: 'A base de conhecimento usa RAG (Retrieval-Augmented Generation). Faça upload de documentos e o chatbot usará esse conteúdo para responder perguntas.'
  },
  {
    question: 'Como agendar broadcasts?',
    answer: 'Crie um novo broadcast e defina a data/hora no campo "Agendar". O sistema enviará automaticamente na data definida.'
  },
  {
    question: 'Onde vejo os logs de auditoria?',
    answer: 'Acesse a página Audit Logs no menu. Você pode filtrar por ação, recurso, data e exportar para CSV.'
  },
]

const SHORTCUTS = [
  { key: 'Ctrl + K', action: 'Abrir comando rápido' },
  { key: 'Ctrl + N', action: 'Nova conversa' },
  { key: 'Esc', action: 'Fechar modal' },
  { key: '/', action: 'Buscar' },
]

export default function HelpPage() {
  const [activeTab, setActiveTab] = useState('faq')
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)

  return (
    <div className="size-full p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-text-strong mb-2">Ajuda e Suporte</h1>
          <p className="text-text-subtle">Encontre respostas e aprenda a usar o OpenCode ChatIAS</p>
        </div>

        <div className="flex gap-2 mb-6 border-b border-border-weak-base">
          {[
            { id: 'faq', label: 'Perguntas Frequentes', icon: '❓' },
            { id: 'shortcuts', label: 'Atalhos', icon: '⌨️' },
            { id: 'docs', label: 'Documentação', icon: '📖' },
            { id: 'about', label: 'Sobre', icon: 'ℹ️' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'text-text-interactive-base border-b-2 border-text-interactive-base'
                  : 'text-text-subtle hover:text-text-base'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {activeTab === 'faq' && (
          <div className="space-y-3">
            {FAQS.map((faq, idx) => (
              <div key={idx} className="card">
                <button
                  onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                  className="w-full text-left flex items-center justify-between"
                >
                  <span className="font-medium text-text-strong">{faq.question}</span>
                  <span className={`transform transition-transform ${
                    expandedFaq === idx ? 'rotate-180' : ''
                  }`}>
                    ▼
                  </span>
                </button>
                {expandedFaq === idx && (
                  <div className="mt-4 pt-4 border-t border-border-weak-base text-text-subtle">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'shortcuts' && (
          <div className="card">
            <h3 className="font-medium text-text-strong mb-4">Atalhos de Teclado</h3>
            <div className="space-y-3">
              {SHORTCUTS.map((shortcut, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-surface-raised-base rounded">
                  <span className="text-text-base">{shortcut.action}</span>
                  <kbd className="px-3 py-1 bg-surface-raised-base border border-border-weak-base rounded text-sm font-mono">
                    {shortcut.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'docs' && (
          <div className="space-y-4">
            <div className="card p-4">
              <h3 className="font-medium text-text-strong mb-2">📚 Guia do Usuário</h3>
              <p className="text-sm text-text-subtle mb-4">
                Aprenda a usar todas as funcionalidades do OpenCode ChatIAS.
              </p>
              <button className="btn-secondary">Ver Documentação</button>
            </div>
            <div className="card p-4">
              <h3 className="font-medium text-text-strong mb-2">🔌 API Documentation</h3>
              <p className="text-sm text-text-subtle mb-4">
                Integre o ChatIAS com seus sistemas usando nossa REST API.
              </p>
              <button className="btn-secondary">Ver API Docs</button>
            </div>
            <div className="card p-4">
              <h3 className="font-medium text-text-strong mb-2">🎓 Tutoriais em Vídeo</h3>
              <p className="text-sm text-text-subtle mb-4">
                Assista tutoriais passo a passo sobre as principais funcionalidades.
              </p>
              <button className="btn-secondary">Ver Vídeos</button>
            </div>
          </div>
        )}

        {activeTab === 'about' && (
          <div className="card p-6 text-center">
            <div className="text-6xl mb-4">🤖</div>
            <h2 className="text-2xl font-bold text-text-strong mb-2">OpenCode ChatIAS</h2>
            <p className="text-text-subtle mb-4">Plataforma de Chatbot com IA</p>
            <div className="inline-block px-4 py-2 bg-surface-raised-base rounded-lg mb-6">
              <span className="text-sm text-text-subtle">Versão </span>
              <span className="font-medium text-text-strong">{APP_VERSION}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 text-left">
              <div className="p-4 bg-surface-raised-base rounded">
                <div className="font-medium text-text-strong">Desenvolvido por</div>
                <div className="text-sm text-text-subtle">OpenCode Team</div>
              </div>
              <div className="p-4 bg-surface-raised-base rounded">
                <div className="font-medium text-text-strong">Tecnologias</div>
                <div className="text-sm text-text-subtle">React, Node.js, PostgreSQL</div>
              </div>
              <div className="p-4 bg-surface-raised-base rounded">
                <div className="font-medium text-text-strong">Licença</div>
                <div className="text-sm text-text-subtle">MIT License</div>
              </div>
            </div>
            <div className="flex justify-center gap-4">
              <a href="#" className="text-text-interactive-base hover:underline">Website</a>
              <a href="#" className="text-text-interactive-base hover:underline">GitHub</a>
              <a href="#" className="text-text-interactive-base hover:underline">Suporte</a>
            </div>
          </div>
        )}

        <div className="mt-8 card p-4 bg-blue-500/10 border-blue-500/30">
          <div className="flex items-start gap-3">
            <span className="text-xl">💬</span>
            <div>
              <div className="font-medium text-text-strong">Precisa de ajuda?</div>
              <div className="text-sm text-text-subtle">
                Entre em contato com nosso suporte através do chat ou email support@opencode.ai
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
