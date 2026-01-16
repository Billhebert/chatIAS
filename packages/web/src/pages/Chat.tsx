import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export default function Chat() {
  const { token } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadConversations();
  }, [token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async () => {
    try {
      const res = await fetch('/api/chat/conversations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const res = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const createNewChat = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ title: 'Nova conversa' })
      });
      if (res.ok) {
        const conversation = await res.json();
        setCurrentConversation(conversation);
        setMessages([]);
        loadConversations();
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectConversation = (conversation: Conversation) => {
    setCurrentConversation(conversation);
    loadMessages(conversation.id);
  };

  const sendMessage = async () => {
    if (!input.trim() || !currentConversation || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      createdAt: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setIsTyping(true);

    try {
      const res = await fetch(`/api/chat/conversations/${currentConversation.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ content: userMessage.content })
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, data.message]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setLoading(false);
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="chat-container">
      <aside className="chat-sidebar">
        <button className="new-chat-btn" onClick={createNewChat}>
          + Nova Conversa
        </button>
        <div className="conversations-list">
          {conversations.map(conv => (
            <div
              key={conv.id}
              className={`conversation-item ${currentConversation?.id === conv.id ? 'active' : ''}`}
              onClick={() => selectConversation(conv)}
            >
              <span className="conversation-title">{conv.title}</span>
            </div>
          ))}
        </div>
      </aside>

      <main className="chat-main">
        {!currentConversation ? (
          <div className="chat-welcome">
            <h1>ChatIAS</h1>
            <p>Como posso ajudar você hoje?</p>
            <div className="suggestions">
              <button onClick={() => {
                setInput('Crie uma automação para enviar email quando uma nova empresa for cadastrada');
                inputRef.current?.focus();
              }}>
                Criar automação por email
              </button>
              <button onClick={() => {
                setInput('Liste todas as empresas do sistema');
                inputRef.current?.focus();
              }}>
                Listar empresas
              </button>
              <button onClick={() => {
                setInput('Gere um relatório de follow-ups pendentes');
                inputRef.current?.focus();
              }}>
                Gerar relatório
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="messages-container">
              {messages.length === 0 && (
                <div className="chat-welcome">
                  <h2>Nova conversa</h2>
                  <p>Descreva o que você precisa e eu vou ajudá-lo!</p>
                </div>
              )}
              {messages.map(msg => (
                <div key={msg.id} className={`message ${msg.role}`}>
                  <div className="message-avatar">
                    {msg.role === 'user' ? '👤' : '🤖'}
                  </div>
                  <div className="message-content">
                    <pre>{msg.content}</pre>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="message assistant typing">
                  <div className="message-avatar">🤖</div>
                  <div className="message-content typing-indicator">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-container">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua mensagem..."
                rows={1}
                disabled={loading}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="send-btn"
              >
                {loading ? '⏳' : '➤'}
              </button>
            </div>
          </>
        )}
      </main>

      <style>{`
        .chat-container {
          display: flex;
          height: calc(100vh - 60px);
          background: #1a1a2e;
        }

        .chat-sidebar {
          width: 260px;
          background: #16213e;
          border-right: 1px solid #0f3460;
          display: flex;
          flex-direction: column;
        }

        .new-chat-btn {
          margin: 12px;
          padding: 12px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          border-radius: 8px;
          color: white;
          font-size: 14px;
          cursor: pointer;
          transition: transform 0.2s;
        }

        .new-chat-btn:hover {
          transform: scale(1.02);
        }

        .conversations-list {
          flex: 1;
          overflow-y: auto;
          padding: 0 8px;
        }

        .conversation-item {
          padding: 10px 12px;
          border-radius: 6px;
          cursor: pointer;
          margin-bottom: 4px;
          transition: background 0.2s;
        }

        .conversation-item:hover {
          background: rgba(102, 126, 234, 0.2);
        }

        .conversation-item.active {
          background: rgba(102, 126, 234, 0.3);
        }

        .conversation-title {
          color: #e0e0e0;
          font-size: 13px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          display: block;
        }

        .chat-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%);
        }

        .messages-container {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
        }

        .chat-welcome {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          text-align: center;
          color: #e0e0e0;
        }

        .chat-welcome h1 {
          font-size: 32px;
          margin-bottom: 12px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .suggestions {
          display: flex;
          gap: 12px;
          margin-top: 24px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .suggestions button {
          padding: 12px 20px;
          background: rgba(102, 126, 234, 0.15);
          border: 1px solid rgba(102, 126, 234, 0.3);
          border-radius: 8px;
          color: #a0a0a0;
          cursor: pointer;
          transition: all 0.2s;
        }

        .suggestions button:hover {
          background: rgba(102, 126, 234, 0.25);
          color: #e0e0e0;
        }

        .message {
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
          padding: 16px;
          border-radius: 12px;
        }

        .message.user {
          background: rgba(102, 126, 234, 0.1);
          flex-direction: row-reverse;
        }

        .message.assistant {
          background: rgba(118, 75, 162, 0.1);
        }

        .message-avatar {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          flex-shrink: 0;
        }

        .message-content {
          max-width: 70%;
        }

        .message.user .message-content {
          text-align: right;
        }

        .message-content pre {
          margin: 0;
          white-space: pre-wrap;
          word-wrap: break-word;
          color: #e0e0e0;
          font-family: inherit;
          font-size: 14px;
          line-height: 1.6;
        }

        .typing-indicator {
          display: flex;
          gap: 4px;
        }

        .typing-indicator span {
          width: 8px;
          height: 8px;
          background: #667eea;
          border-radius: 50%;
          animation: typing 1.4s infinite;
        }

        .typing-indicator span:nth-child(2) {
          animation-delay: 0.2s;
        }

        .typing-indicator span:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes typing {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }

        .chat-input-container {
          padding: 16px 20px;
          background: rgba(22, 33, 62, 0.8);
          border-top: 1px solid #0f3460;
          display: flex;
          gap: 12px;
          align-items: flex-end;
        }

        .chat-input-container textarea {
          flex: 1;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid #0f3460;
          border-radius: 12px;
          padding: 12px 16px;
          color: #e0e0e0;
          font-size: 14px;
          resize: none;
          outline: none;
          max-height: 120px;
        }

        .chat-input-container textarea:focus {
          border-color: #667eea;
        }

        .chat-input-container textarea::placeholder {
          color: #666;
        }

        .send-btn {
          width: 44px;
          height: 44px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          border-radius: 12px;
          color: white;
          font-size: 18px;
          cursor: pointer;
          transition: transform 0.2s;
        }

        .send-btn:hover:not(:disabled) {
          transform: scale(1.05);
        }

        .send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
