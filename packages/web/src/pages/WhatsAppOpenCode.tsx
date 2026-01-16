import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

interface WhatsAppInstance {
  instanceName: string;
  status: string;
  profileName?: string;
  profilePicUrl?: string;
}

interface WhatsAppConversation {
  id: string;
  remoteJid: string;
  contact: {
    pushName: string;
    profilePicUrl?: string;
    isGroup: boolean;
  };
  lastMessage?: {
    content: string;
    timestamp: number;
    fromMe: boolean;
  };
  unreadCount: number;
}

interface WhatsAppMessage {
  id: string;
  fromMe: boolean;
  content: string;
  timestamp: number;
}

export default function WhatsAppOpenCode() {
  const { token } = useAuth();
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<WhatsAppConversation | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const filteredConversations = useMemo(() => {
    if (!searchQuery) return conversations;
    return conversations.filter(c =>
      c.contact.pushName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.remoteJid.includes(searchQuery)
    );
  }, [conversations, searchQuery]);

  const loadInstances = async () => {
    try {
      const res = await fetch('/api/integrations?type=EVOLUTION', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const normalized = (Array.isArray(data) ? data : []).map((inst: any) => ({
          instanceName: inst.name || inst.instanceName,
          status: inst.status || 'DISCONNECTED'
        }));
        setInstances(normalized);
        if (!selectedInstance() && normalized.length > 0) {
          setSelectedInstance(normalized[0]?.instanceName);
        }
      }
    } catch (e) {
      console.error('Error loading instances:', e);
    }
  };

  const loadConversations = async () => {
    if (!selectedInstance) return;
    try {
      const res = await fetch(`/api/whatsapp/${selectedInstance}/conversations/direct`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (e) {
      console.error('Error loading conversations:', e);
    }
  };

  const loadMessages = async (conv: WhatsAppConversation) => {
    setLoadingMessages(true);
    setSelectedConversation(conv);
    try {
      const res = await fetch(`/api/whatsapp/${selectedInstance}/${conv.remoteJid}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (e) {
      console.error('Error loading messages:', e);
    } finally {
      setLoadingMessages(false);
    }
  };

  const sendMessage = async () => {
    if (!selectedInstance || !selectedConversation || !messageInput.trim()) return;
    
    try {
      const res = await fetch(`/api/whatsapp/${selectedInstance}/${selectedConversation.remoteJid}/send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: messageInput })
      });

      if (res.ok) {
        setMessageInput('');
        loadMessages(selectedConversation);
      } else {
        alert('Falha ao enviar mensagem');
      }
    } catch (e) {
      alert('Erro ao enviar mensagem');
    }
  };

  useEffect(() => {
    loadInstances().then(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (selectedInstance) {
      loadConversations();
    }
  }, [selectedInstance, token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="whatsapp-container">
      <aside className="instances-sidebar">
        <div className="sidebar-header">
          <h2>💬 WhatsApp</h2>
        </div>
        
        <button className="add-instance-btn" onClick={() => setShowModal(true)}>
          + Nova Instância
        </button>

        <div className="instances-list">
          {instances.map(inst => (
            <div
              key={inst.instanceName}
              className={`instance-item ${selectedInstance === inst.instanceName ? 'active' : ''}`}
              onClick={() => setSelectedInstance(inst.instanceName)}
            >
              <div className="instance-avatar">📱</div>
              <div className="instance-info">
                <span className="instance-name">{inst.instanceName}</span>
                <span className={`instance-status ${inst.status}`}>{inst.status}</span>
              </div>
            </div>
          ))}
          {instances.length === 0 && (
            <div className="empty-instances">
              <p>Nenhuma instância</p>
              <button className="btn-link" onClick={() => setShowModal(true)}>
                Criar primeira instância
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="conversations-main">
        {!selectedConversation ? (
          <div className="conversations-list">
            <div className="search-bar">
              <input
                type="text"
                placeholder="Buscar conversas..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            
            {loading ? (
              <div className="loading">Carregando conversas...</div>
            ) : filteredConversations.length === 0 ? (
              <div className="empty-state">
                <p>Nenhuma conversa encontrada</p>
              </div>
            ) : (
              <div className="conversations">
                {filteredConversations.map(conv => (
                  <div
                    key={conv.id}
                    className="conversation-item"
                    onClick={() => loadMessages(conv)}
                  >
                    <div className="conv-avatar">
                      {conv.contact.profilePicUrl ? (
                        <img src={conv.contact.profilePicUrl} alt="" />
                      ) : (
                        <span>{conv.contact.pushName?.charAt(0) || '?'}</span>
                      )}
                    </div>
                    <div className="conv-content">
                      <div className="conv-header">
                        <span className="conv-name">{conv.contact.pushName || conv.remoteJid.split('@')[0]}</span>
                        <span className="conv-time">
                          {conv.lastMessage && formatTime(conv.lastMessage.timestamp)}
                        </span>
                      </div>
                      <div className="conv-preview">
                        {conv.lastMessage ? (
                          <span className={conv.lastMessage.fromMe ? 'sent' : ''}>
                            {conv.lastMessage.fromMe ? '✓ ' : ''}{conv.lastMessage.content.substring(0, 50)}...
                          </span>
                        ) : (
                          <span className="no-messages">Sem mensagens</span>
                        )}
                      </div>
                    </div>
                    {conv.unreadCount > 0 && (
                      <div className="unread-badge">{conv.unreadCount}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="chat-view">
            <div className="chat-header">
              <button className="back-btn" onClick={() => setSelectedConversation(null)}>
                ←
              </button>
              <div className="chat-contact-info">
                <span className="chat-name">{selectedConversation.contact.pushName || selectedConversation.remoteJid.split('@')[0]}</span>
              </div>
            </div>

            <div className="messages-container">
              {loadingMessages ? (
                <div className="loading">Carregando mensagens...</div>
              ) : messages.length === 0 ? (
                <div className="empty-messages">
                  <p>Sem mensagens ainda</p>
                  <p className="hint">Envie uma mensagem para começar a conversa</p>
                </div>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className={`message ${msg.fromMe ? 'sent' : 'received'}`}>
                    <div className="message-content">{msg.content}</div>
                    <div className="message-time">{formatTime(msg.timestamp)}</div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-input">
              <input
                type="text"
                placeholder="Digite uma mensagem..."
                value={messageInput}
                onChange={e => setMessageInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
              />
              <button className="send-btn" onClick={sendMessage} disabled={!messageInput.trim()}>
                ➤
              </button>
            </div>
          </div>
        )}
      </main>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Nova Instância WhatsApp</h2>
            <form onSubmit={async e => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const name = formData.get('name');
              // API call would go here
              setShowModal(false);
              loadInstances();
            }}>
              <div className="form-group">
                <label>Nome da instância *</label>
                <input type="text" name="name" required placeholder="my-whatsapp-instance" />
              </div>
              <div className="form-group">
                <label>Token da Evolution API *</label>
                <input type="password" name="token" required placeholder="Seu token" />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Criar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .whatsapp-container {
          display: flex;
          height: calc(100vh - 60px);
          background: #1a1a2e;
        }

        .instances-sidebar {
          width: 280px;
          background: #16213e;
          border-right: 1px solid #0f3460;
          display: flex;
          flex-direction: column;
        }

        .sidebar-header {
          padding: 16px;
          border-bottom: 1px solid #0f3460;
        }

        .sidebar-header h2 {
          color: #e0e0e0;
          font-size: 18px;
        }

        .add-instance-btn {
          margin: 12px;
          padding: 10px;
          background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
          border: none;
          border-radius: 8px;
          color: white;
          cursor: pointer;
          font-weight: 500;
        }

        .instances-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
        }

        .instance-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 8px;
          cursor: pointer;
          margin-bottom: 4px;
          transition: background 0.2s;
        }

        .instance-item:hover {
          background: rgba(37, 211, 102, 0.1);
        }

        .instance-item.active {
          background: rgba(37, 211, 102, 0.2);
        }

        .instance-avatar {
          width: 40px;
          height: 40px;
          background: #128C7E;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
        }

        .instance-info {
          display: flex;
          flex-direction: column;
        }

        .instance-name {
          color: #e0e0e0;
          font-size: 14px;
          font-weight: 500;
        }

        .instance-status {
          font-size: 11px;
          text-transform: uppercase;
        }

        .instance-status.connected { color: #25D366; }
        .instance-status.disconnected { color: #f85149; }
        .instance-status.connecting { color: #fbbf24; }

        .empty-instances {
          text-align: center;
          padding: 20px;
          color: #888;
        }

        .btn-link {
          background: none;
          border: none;
          color: #25D366;
          cursor: pointer;
          text-decoration: underline;
        }

        .conversations-main {
          flex: 1;
          display: flex;
        }

        .conversations-list {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .search-bar {
          padding: 12px;
          border-bottom: 1px solid #0f3460;
        }

        .search-bar input {
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid #0f3460;
          border-radius: 8px;
          padding: 10px 12px;
          color: #e0e0e0;
        }

        .conversations {
          flex: 1;
          overflow-y: auto;
        }

        .conversation-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-bottom: 1px solid #0f3460;
          cursor: pointer;
          transition: background 0.2s;
        }

        .conversation-item:hover {
          background: rgba(255, 255, 255, 0.03);
        }

        .conv-avatar {
          width: 48px;
          height: 48px;
          background: #0f3460;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #e0e0e0;
          font-weight: 600;
          overflow: hidden;
        }

        .conv-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .conv-content {
          flex: 1;
          min-width: 0;
        }

        .conv-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
        }

        .conv-name {
          color: #e0e0e0;
          font-weight: 500;
        }

        .conv-time {
          color: #888;
          font-size: 12px;
        }

        .conv-preview {
          color: #888;
          font-size: 13px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .conv-preview .sent { color: #25D366; }
        .conv-preview .no-messages { color: #666; }

        .unread-badge {
          background: #25D366;
          color: white;
          font-size: 11px;
          font-weight: bold;
          padding: 2px 8px;
          border-radius: 10px;
        }

        .chat-view {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: #0d1117;
        }

        .chat-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: #16213e;
          border-bottom: 1px solid #0f3460;
        }

        .back-btn {
          width: 36px;
          height: 36px;
          background: rgba(255, 255, 255, 0.05);
          border: none;
          border-radius: 8px;
          color: #e0e0e0;
          cursor: pointer;
          font-size: 18px;
        }

        .chat-contact-info {
          flex: 1;
        }

        .chat-name {
          color: #e0e0e0;
          font-weight: 500;
        }

        .messages-container {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .message {
          max-width: 70%;
          padding: 10px 14px;
          border-radius: 12px;
        }

        .message.sent {
          align-self: flex-end;
          background: #25D366;
          color: white;
        }

        .message.received {
          align-self: flex-start;
          background: #16213e;
          color: #e0e0e0;
        }

        .message-time {
          font-size: 10px;
          opacity: 0.7;
          margin-top: 4px;
          text-align: right;
        }

        .chat-input {
          display: flex;
          gap: 12px;
          padding: 12px 16px;
          background: #16213e;
          border-top: 1px solid #0f3460;
        }

        .chat-input input {
          flex: 1;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid #0f3460;
          border-radius: 20px;
          padding: 12px 16px;
          color: #e0e0e0;
        }

        .send-btn {
          width: 44px;
          height: 44px;
          background: #25D366;
          border: none;
          border-radius: 50%;
          color: white;
          cursor: pointer;
          font-size: 18px;
        }

        .send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .loading, .empty-state, .empty-messages {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #888;
          text-align: center;
          padding: 40px;
        }

        .empty-messages .hint {
          font-size: 12px;
          color: #666;
          margin-top: 8px;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal {
          background: #1a1a2e;
          border: 1px solid #0f3460;
          border-radius: 16px;
          padding: 24px;
          width: 90%;
          max-width: 400px;
        }

        .modal h2 {
          color: #e0e0e0;
          margin-bottom: 20px;
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-group label {
          display: block;
          color: #888;
          font-size: 13px;
          margin-bottom: 6px;
        }

        .form-group input {
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid #0f3460;
          border-radius: 8px;
          padding: 10px 12px;
          color: #e0e0e0;
        }

        .modal-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          margin-top: 24px;
        }

        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
        }

        .btn-primary {
          background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
          color: white;
        }

        .btn-secondary {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #e0e0e0;
        }
      `}</style>
    </div>
  );
}

function useMemo<T>(fn: () => T, deps: unknown[]): T {
  return (() => {
    const [state] = useState<T>(fn);
    return state;
  })();
}
