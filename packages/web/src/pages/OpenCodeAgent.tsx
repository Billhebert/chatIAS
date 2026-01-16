import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

interface Tool {
  name: string;
  description: string;
  category: 'search' | 'file' | 'system' | 'ai' | 'custom';
  params: Record<string, { type: string; description: string; required: boolean }>;
}

interface ToolResult {
  tool: string;
  result?: unknown;
  error?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tools?: ToolResult[];
  createdAt: string;
}

const AVAILABLE_TOOLS: Tool[] = [
  {
    name: 'codesearch',
    description: 'Search code examples and patterns using Exa AI',
    category: 'search',
    params: {
      query: { type: 'string', description: 'Code search query', required: true },
      tokensNum: { type: 'number', description: 'Max tokens', required: false },
      include: { type: 'string', description: 'Fields to include', required: false }
    }
  },
  {
    name: 'websearch',
    description: 'Search the web for information using Exa AI',
    category: 'search',
    params: {
      query: { type: 'string', description: 'Search query', required: true },
      numResults: { type: 'number', description: 'Number of results', required: false },
      type: { type: 'string', description: 'Search type (auto/fast/deep)', required: false }
    }
  },
  {
    name: 'webfetch',
    description: 'Fetch content from a URL',
    category: 'search',
    params: {
      url: { type: 'string', description: 'URL to fetch', required: true },
      format: { type: 'string', description: 'Format (text/markdown/html/json)', required: false }
    }
  },
  {
    name: 'task',
    description: 'Execute complex multi-step tasks with an agent',
    category: 'ai',
    params: {
      command: { type: 'string', description: 'Task command', required: true },
      description: { type: 'string', description: 'Task description', required: true },
      subagent_type: { type: 'string', description: 'Agent type (general/explore)', required: false }
    }
  },
  {
    name: 'skill',
    description: 'Load and execute a skill',
    category: 'ai',
    params: {
      name: { type: 'string', description: 'Skill name', required: true }
    }
  },
  {
    name: 'bash',
    description: 'Execute bash commands',
    category: 'system',
    params: {
      command: { type: 'string', description: 'Command to execute', required: true },
      description: { type: 'string', description: 'Command description', required: false },
      timeout: { type: 'number', description: 'Timeout in ms', required: false }
    }
  },
  {
    name: 'grep',
    description: 'Search file contents using regex',
    category: 'file',
    params: {
      pattern: { type: 'string', description: 'Regex pattern', required: true },
      path: { type: 'string', description: 'Search path', required: false },
      include: { type: 'string', description: 'File patterns', required: false }
    }
  },
  {
    name: 'glob',
    description: 'Find files by pattern',
    category: 'file',
    params: {
      pattern: { type: 'string', description: 'Glob pattern', required: true },
      path: { type: 'string', description: 'Search path', required: false }
    }
  },
  {
    name: 'read',
    description: 'Read a file from the filesystem',
    category: 'file',
    params: {
      filePath: { type: 'string', description: 'Absolute file path', required: true },
      limit: { type: 'number', description: 'Max lines', required: false },
      offset: { type: 'number', description: 'Start line', required: false }
    }
  },
  {
    name: 'write',
    description: 'Write content to a file',
    category: 'file',
    params: {
      filePath: { type: 'string', description: 'Absolute file path', required: true },
      content: { type: 'string', description: 'Content to write', required: true }
    }
  },
  {
    name: 'edit',
    description: 'Edit a file using string replacement',
    category: 'file',
    params: {
      filePath: { type: 'string', description: 'File path', required: true },
      oldString: { type: 'string', description: 'Text to replace', required: true },
      newString: { type: 'string', description: 'Replacement text', required: true }
    }
  },
  {
    name: 'todowrite',
    description: 'Create and manage todo lists',
    category: 'custom',
    params: {
      todos: { type: 'string', description: 'JSON array of todos', required: true }
    }
  },
  {
    name: 'question',
    description: 'Ask user questions during execution',
    category: 'custom',
    params: {
      questions: { type: 'string', description: 'JSON array of questions', required: true }
    }
  }
];

export default function OpenCodeAgent() {
  const { token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [selectedTool, setSelectedTool] = useState<string>('task');
  const [toolArgs, setToolArgs] = useState('{\n  \n}');
  const [loading, setLoading] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = (role: Message['role'], content: string, tools?: ToolResult[]) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role,
      content,
      tools,
      createdAt: new Date().toISOString()
    }]);
  };

  const handleSend = async () => {
    if (!input.trim() && selectedTool === 'task') {
      setInput('Execute a task');
      return;
    }

    const userInput = selectedTool === 'task' ? input : 
      `Using ${selectedTool} tool with args: ${toolArgs}`;

    addMessage('user', userInput);
    setLoading(true);

    try {
      if (selectedTool === 'task') {
        const response = await fetch('/api/opencode/task', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            command: input,
            description: input.substring(0, 50),
            subagent_type: 'general'
          })
        });
        const data = await response.json();
        addMessage('assistant', `Task created: ${data.description}\n\nStatus: ${data.status}\n\nSub-agent type: ${data.subagent_type}`, [{
          tool: 'task',
          result: data
        }]);
      } else {
        let args;
        try {
          args = JSON.parse(toolArgs);
        } catch {
          args = {};
        }

        const response = await fetch(`/api/opencode/${selectedTool}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(args)
        });
        const data = await response.json();

        if (data.error) {
          addMessage('assistant', `Error using ${selectedTool}:\n\n${data.error}`, [{
            tool: selectedTool,
            error: data.error
          }]);
        } else {
          const resultStr = typeof data.result === 'object' 
            ? JSON.stringify(data.result, null, 2)
            : String(data.result);
          addMessage('assistant', `${selectedTool} executed successfully.\n\n${data.message || ''}`, [{
            tool: selectedTool,
            result: data
          }]);
        }
      }
    } catch (error) {
      addMessage('assistant', `Error: ${error}`, [{
        tool: selectedTool,
        error: String(error)
      }]);
    } finally {
      setLoading(false);
      setInput('');
    }
  };

  const quickActions = [
    { label: '🔍 Search Code', tool: 'codesearch', args: '{\n  "query": "React useState hook example",\n  "tokensNum": 5000\n}' },
    { label: '🌐 Web Search', tool: 'websearch', args: '{\n  "query": "latest React 19 features",\n  "numResults": 5\n}' },
    { label: '📄 Fetch URL', tool: 'webfetch', args: '{\n  "url": "https://react.dev",\n  "format": "text"\n}' },
    { label: '⚡ Execute Task', tool: 'task', args: '{\n  "command": "Research and implement a new feature",\n  "description": "Implement new feature",\n  "subagent_type": "general"\n}' },
    { label: '📝 Read File', tool: 'read', args: '{\n  "filePath": "/path/to/file",\n  "limit": 100\n}' },
    { label: '🔧 Edit File', tool: 'edit', args: '{\n  "filePath": "/path/to/file",\n  "oldString": "old text",\n  "newString": "new text"\n}' },
    { label: '📋 Todo List', tool: 'todowrite', args: '{\n  "todos": [\n    {"id": "1", "content": "Task 1", "status": "pending"},\n    {"id": "2", "content": "Task 2", "status": "in_progress"}\n  ]\n}' },
  ];

  const selectedToolInfo = AVAILABLE_TOOLS.find(t => t.name === selectedTool);

  return (
    <div className="opencode-agent">
      <aside className="agent-sidebar">
        <div className="sidebar-header">
          <h2>🧠 OpenCode Agent</h2>
          <p>Execute tasks with AI tools</p>
        </div>

        <div className="quick-actions">
          <h3>Quick Actions</h3>
          {quickActions.map(action => (
            <button
              key={action.tool}
              className={`quick-btn ${selectedTool === action.tool ? 'active' : ''}`}
              onClick={() => {
                setSelectedTool(action.tool);
                setToolArgs(action.args);
              }}
            >
              {action.label}
            </button>
          ))}
        </div>

        <div className="tools-section">
          <h3>All Tools</h3>
          <button className="toggle-tools" onClick={() => setShowTools(!showTools)}>
            {showTools ? '▼ Hide' : '▶ Show'} Tools ({AVAILABLE_TOOLS.length})
          </button>
          {showTools && (
            <div className="tools-list">
              {AVAILABLE_TOOLS.map(tool => (
                <div
                  key={tool.name}
                  className={`tool-item ${selectedTool === tool.name ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedTool(tool.name);
                    setToolArgs('{\n  \n}');
                  }}
                >
                  <span className="tool-category">{getCategoryIcon(tool.category)}</span>
                  <span className="tool-name">{tool.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      <main className="agent-main">
        <div className="messages-container">
          {messages.length === 0 && (
            <div className="welcome-message">
              <h1>🤖 OpenCode Agent</h1>
              <p>Execute tarefas complexas usando as ferramentas do OpenCode</p>
              <div className="capabilities">
                <h3>Capabilities:</h3>
                <ul>
                  <li>🔍 Search code and web with Exa AI</li>
                  <li>📝 Read, write, and edit files</li>
                  <li>⚡ Execute multi-step tasks with agents</li>
                  <li>📋 Manage todo lists</li>
                  <li>💬 Ask questions during execution</li>
                </ul>
              </div>
            </div>
          )}
          {messages.map(msg => (
            <div key={msg.id} className={`message ${msg.role}`}>
              <div className="message-avatar">
                {msg.role === 'user' ? '👤' : msg.role === 'assistant' ? '🤖' : '⚙️'}
              </div>
              <div className="message-content">
                <pre>{msg.content}</pre>
                {msg.tools && msg.tools.length > 0 && (
                  <div className="tools-results">
                    {msg.tools.map((tool, i) => (
                      <div key={i} className={`tool-result ${tool.error ? 'error' : 'success'}`}>
                        <span className="tool-name">[{tool.tool}]</span>
                        {tool.error && <span className="error-text">{tool.error}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="message assistant loading">
              <div className="message-avatar">🤖</div>
              <div className="message-content">
                <div className="typing-indicator">
                  <span></span><span></span><span></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="input-section">
          <div className="selected-tool">
            <label>Tool:</label>
            <select value={selectedTool} onChange={e => setSelectedTool(e.target.value)}>
              {AVAILABLE_TOOLS.map(tool => (
                <option key={tool.name} value={tool.name}>{tool.name}</option>
              ))}
            </select>
            <span className="tool-description">{selectedToolInfo?.description}</span>
          </div>

          {selectedTool !== 'task' && (
            <div className="tool-args">
              <label>Arguments (JSON):</label>
              <textarea
                value={toolArgs}
                onChange={e => setToolArgs(e.target.value)}
                rows={4}
                className="args-input"
              />
            </div>
          )}

          <div className="input-row">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={selectedTool === 'task' ? 'Describe the task you want to execute...' : 'Enter your request...'}
              rows={1}
              disabled={loading}
            />
            <button onClick={handleSend} disabled={loading} className="send-btn">
              {loading ? '⏳' : '▶'}
            </button>
          </div>
        </div>
      </main>

      <style>{`
        .opencode-agent {
          display: flex;
          height: calc(100vh - 60px);
          background: #0d1117;
        }

        .agent-sidebar {
          width: 280px;
          background: #161b22;
          border-right: 1px solid #30363d;
          padding: 20px;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
        }

        .sidebar-header h2 {
          color: #e0e0e0;
          font-size: 18px;
          margin-bottom: 4px;
        }

        .sidebar-header p {
          color: #8b949e;
          font-size: 12px;
          margin-bottom: 20px;
        }

        .quick-actions h3, .tools-section h3 {
          color: #8b949e;
          font-size: 11px;
          text-transform: uppercase;
          margin-bottom: 10px;
        }

        .quick-btn {
          width: 100%;
          padding: 10px 12px;
          background: rgba(56, 139, 253, 0.1);
          border: 1px solid rgba(56, 139, 253, 0.3);
          border-radius: 6px;
          color: #c9d1d9;
          text-align: left;
          cursor: pointer;
          margin-bottom: 6px;
          font-size: 13px;
          transition: all 0.2s;
        }

        .quick-btn:hover, .quick-btn.active {
          background: rgba(56, 139, 253, 0.2);
          border-color: #388bfd;
        }

        .toggle-tools {
          width: 100%;
          padding: 8px;
          background: transparent;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #8b949e;
          cursor: pointer;
          font-size: 12px;
        }

        .tools-list {
          margin-top: 10px;
          max-height: 300px;
          overflow-y: auto;
        }

        .tool-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          border-radius: 4px;
          cursor: pointer;
          margin-bottom: 2px;
        }

        .tool-item:hover, .tool-item.active {
          background: rgba(56, 139, 253, 0.1);
        }

        .tool-item.active {
          border: 1px solid #388bfd;
        }

        .tool-category {
          font-size: 14px;
        }

        .tool-name {
          color: #c9d1d9;
          font-size: 12px;
        }

        .agent-main {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .messages-container {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
        }

        .welcome-message {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          text-align: center;
          color: #c9d1d9;
        }

        .welcome-message h1 {
          font-size: 32px;
          margin-bottom: 12px;
          background: linear-gradient(135deg, #388bfd, #7c3aed);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .capabilities {
          margin-top: 30px;
          text-align: left;
          max-width: 400px;
        }

        .capabilities h3 {
          color: #8b949e;
          font-size: 14px;
          margin-bottom: 12px;
        }

        .capabilities ul {
          list-style: none;
          padding: 0;
        }

        .capabilities li {
          padding: 8px 0;
          color: #8b949e;
          font-size: 14px;
        }

        .message {
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
          padding: 16px;
          border-radius: 12px;
          max-width: 90%;
        }

        .message.user {
          background: rgba(56, 139, 253, 0.1);
          margin-left: auto;
          flex-direction: row-reverse;
        }

        .message.assistant {
          background: rgba(124, 58, 237, 0.1);
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
          max-width: 80%;
        }

        .message.user .message-content {
          text-align: right;
        }

        .message-content pre {
          margin: 0;
          white-space: pre-wrap;
          word-wrap: break-word;
          color: #e0e0e0;
          font-family: 'Monaco', 'Consolas', monospace;
          font-size: 13px;
          line-height: 1.5;
        }

        .tools-results {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .tool-result {
          padding: 6px 10px;
          border-radius: 4px;
          font-size: 12px;
          font-family: monospace;
          margin-bottom: 4px;
        }

        .tool-result.success {
          background: rgba(46, 160, 67, 0.1);
          border-left: 3px solid #2ea043;
        }

        .tool-result.error {
          background: rgba(248, 81, 73, 0.1);
          border-left: 3px solid #f85149;
        }

        .error-text {
          color: #f85149;
        }

        .typing-indicator {
          display: flex;
          gap: 4px;
        }

        .typing-indicator span {
          width: 8px;
          height: 8px;
          background: #388bfd;
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

        .input-section {
          padding: 16px 20px;
          background: #161b22;
          border-top: 1px solid #30363d;
        }

        .selected-tool {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }

        .selected-tool label {
          color: #8b949e;
          font-size: 12px;
        }

        .selected-tool select {
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 6px;
          padding: 6px 10px;
          color: #c9d1d9;
          font-size: 13px;
        }

        .tool-description {
          color: #8b949e;
          font-size: 12px;
        }

        .tool-args {
          margin-bottom: 10px;
        }

        .tool-args label {
          display: block;
          color: #8b949e;
          font-size: 12px;
          margin-bottom: 6px;
        }

        .args-input {
          width: 100%;
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 6px;
          padding: 10px;
          color: #c9d1d9;
          font-family: monospace;
          font-size: 12px;
          resize: none;
        }

        .input-row {
          display: flex;
          gap: 10px;
        }

        .input-row textarea {
          flex: 1;
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 8px;
          padding: 12px 16px;
          color: #e0e0e0;
          font-size: 14px;
          resize: none;
          outline: none;
        }

        .input-row textarea:focus {
          border-color: #388bfd;
        }

        .send-btn {
          width: 44px;
          height: 44px;
          background: linear-gradient(135deg, #388bfd, #7c3aed);
          border: none;
          border-radius: 8px;
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

function getCategoryIcon(category: string): string {
  switch (category) {
    case 'search': return '🔍';
    case 'file': return '📄';
    case 'system': return '💻';
    case 'ai': return '🤖';
    case 'custom': return '⚙️';
    default: return '🔧';
  }
}
