-- ==================== SUATEC DATABASE INIT ====================
-- Este script é executado automaticamente quando o container inicia
-- Versão: 2.0 - Compatível com módulo User refatorado

-- Extensões úteis
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==================== TABELAS DE USUÁRIOS ====================

-- Usando VARCHAR para IDs para compatibilidade com IDs gerados pelo backend
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('master', 'admin', 'user')),
    access_level_id VARCHAR(64),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(64),
    last_login_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS access_levels (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(64),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Adicionar FK após criar ambas tabelas
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_access_level'
    ) THEN
        ALTER TABLE users 
        ADD CONSTRAINT fk_access_level 
        FOREIGN KEY (access_level_id) REFERENCES access_levels(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_created_by'
    ) THEN
        ALTER TABLE users 
        ADD CONSTRAINT fk_created_by 
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_al_created_by'
    ) THEN
        ALTER TABLE access_levels 
        ADD CONSTRAINT fk_al_created_by 
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ==================== TABELA DE SETTINGS DO USUÁRIO ====================

CREATE TABLE IF NOT EXISTS user_settings (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    theme VARCHAR(50) DEFAULT 'default',
    color_scheme VARCHAR(20) DEFAULT 'system',
    sidebar_width INTEGER DEFAULT 280,
    settings JSONB DEFAULT '{
        "interfaceMode": "standard",
        "showTerminalByDefault": false,
        "showTechnicalDetails": false,
        "showDebugLogs": false
    }',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==================== TABELAS DE SESSÕES DE CHAT ====================

CREATE TABLE IF NOT EXISTS chat_sessions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    directory TEXT,
    parent_id VARCHAR(64) REFERENCES chat_sessions(id) ON DELETE CASCADE,
    is_archived BOOLEAN DEFAULT FALSE,
    share_url TEXT,
    summary JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    archived_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS message_parts (
    id VARCHAR(64) PRIMARY KEY,
    message_id VARCHAR(64) NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    part_type VARCHAR(50) NOT NULL,
    content TEXT,
    metadata JSONB,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==================== TABELAS DE CONFIGURAÇÃO ====================

CREATE TABLE IF NOT EXISTS provider_configs (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    provider_id VARCHAR(100) NOT NULL,
    api_key_encrypted TEXT,
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, provider_id)
);

-- ==================== TABELAS DE PROJETOS ====================

CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255),
    worktree TEXT NOT NULL,
    icon_url TEXT,
    icon_color VARCHAR(50),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, worktree)
);

-- ==================== TABELAS DE AUDITORIA ====================

CREATE TABLE IF NOT EXISTS audit_log (
    id VARCHAR(64) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id VARCHAR(64),
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==================== TABELA DE SESSÕES DE AUTH (opcional, usando Redis em prod) ====================

CREATE TABLE IF NOT EXISTS auth_sessions (
    token VARCHAR(128) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- ==================== ÍNDICES ====================

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_directory ON chat_sessions(directory);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at ON chat_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_message_parts_message_id ON message_parts(message_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);

-- ==================== FUNÇÕES E TRIGGERS ====================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_access_levels_updated_at ON access_levels;
CREATE TRIGGER update_access_levels_updated_at BEFORE UPDATE ON access_levels
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_chat_sessions_updated_at ON chat_sessions;
CREATE TRIGGER update_chat_sessions_updated_at BEFORE UPDATE ON chat_sessions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_provider_configs_updated_at ON provider_configs;
CREATE TRIGGER update_provider_configs_updated_at BEFORE UPDATE ON provider_configs
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Função para limpar sessões expiradas
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM auth_sessions WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ language 'plpgsql';

-- ==================== DADOS INICIAIS (APENAS NÍVEIS DE ACESSO) ====================
-- O primeiro usuário a se registrar será automaticamente Master

-- Nível de acesso básico para novos usuários
INSERT INTO access_levels (id, name, description, permissions)
VALUES (
    'default_basic',
    'Basico',
    'Acesso basico para novos usuarios',
    '{
        "providers": [],
        "models": [],
        "agents": [],
        "tools": [],
        "canCreateSessions": true,
        "canArchiveSessions": false,
        "canShareSessions": false,
        "canAccessTerminal": false,
        "canAccessFiles": false,
        "canExecuteCommands": false,
        "maxSessionsPerDay": 10,
        "maxMessagesPerSession": 100
    }'::jsonb
) ON CONFLICT (name) DO NOTHING;

-- Nível de acesso completo
INSERT INTO access_levels (id, name, description, permissions)
VALUES (
    'default_complete',
    'Completo',
    'Acesso completo a todos os recursos',
    '{
        "providers": ["*"],
        "models": ["*"],
        "agents": ["*"],
        "tools": ["*"],
        "canCreateSessions": true,
        "canArchiveSessions": true,
        "canShareSessions": true,
        "canAccessTerminal": true,
        "canAccessFiles": true,
        "canExecuteCommands": true,
        "maxSessionsPerDay": 0,
        "maxMessagesPerSession": 0
    }'::jsonb
) ON CONFLICT (name) DO NOTHING;

-- ==================== VIEWS ÚTEIS ====================

CREATE OR REPLACE VIEW v_user_sessions AS
SELECT 
    s.id,
    s.user_id,
    u.username,
    s.title,
    s.directory,
    s.is_archived,
    s.created_at,
    s.updated_at,
    COUNT(m.id) as message_count
FROM chat_sessions s
JOIN users u ON s.user_id = u.id
LEFT JOIN messages m ON s.id = m.session_id
GROUP BY s.id, u.username;

CREATE OR REPLACE VIEW v_user_stats AS
SELECT 
    u.id as user_id,
    u.username,
    u.role,
    COUNT(DISTINCT s.id) as total_sessions,
    COUNT(DISTINCT m.id) as total_messages,
    MAX(s.created_at) as last_session_at
FROM users u
LEFT JOIN chat_sessions s ON u.id = s.user_id
LEFT JOIN messages m ON s.id = m.session_id
GROUP BY u.id, u.username, u.role;

CREATE OR REPLACE VIEW v_active_users AS
SELECT 
    u.id,
    u.username,
    u.role,
    u.is_active,
    u.last_login_at,
    us.settings as user_settings,
    al.name as access_level_name,
    al.permissions
FROM users u
LEFT JOIN user_settings us ON u.id = us.user_id
LEFT JOIN access_levels al ON u.access_level_id = al.id
WHERE u.is_active = TRUE;

-- ==================== COMENTÁRIOS ====================

COMMENT ON TABLE users IS 'Usuarios do sistema Suatec';
COMMENT ON TABLE chat_sessions IS 'Sessoes de chat dos usuarios';
COMMENT ON TABLE access_levels IS 'Niveis de acesso com permissoes configuraveis';
COMMENT ON TABLE user_settings IS 'Configuracoes de interface do usuario';
COMMENT ON TABLE auth_sessions IS 'Sessoes de autenticacao (tokens)';
COMMENT ON TABLE audit_log IS 'Log de auditoria de acoes do sistema';
