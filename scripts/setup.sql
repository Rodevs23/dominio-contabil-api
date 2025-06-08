-- Esquema do banco D1 para logs e auditoria
-- Execute: wrangler d1 execute dominio-api-db --file=./scripts/setup.sql

-- Logs de requisições
CREATE TABLE IF NOT EXISTS request_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    query TEXT,
    user_agent TEXT,
    ip TEXT,
    country TEXT,
    referer TEXT,
    content_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Logs de erros
CREATE TABLE IF NOT EXISTS error_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    message TEXT NOT NULL,
    stack TEXT,
    context TEXT,
    level TEXT DEFAULT 'error',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Logs de auditoria
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    action TEXT NOT NULL,
    user_id TEXT NOT NULL,
    details TEXT,
    ip TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Logs de performance
CREATE TABLE IF NOT EXISTS performance_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    duration INTEGER NOT NULL, -- em milissegundos
    status INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Uploads de documentos
CREATE TABLE IF NOT EXISTS document_uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT NOT NULL,
    document_type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER,
    protocol_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    status TEXT DEFAULT 'uploaded',
    progress INTEGER DEFAULT 0,
    updated_at TEXT,
    completed_at TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Logs de sessão
CREATE TABLE IF NOT EXISTS session_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    duration INTEGER NOT NULL,
    log_count INTEGER NOT NULL,
    logs TEXT NOT NULL, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Usuários e API keys
CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_hash TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    description TEXT,
    permissions TEXT, -- JSON array
    expires_at TEXT,
    last_used_at TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1
);

-- Configurações
CREATE TABLE IF NOT EXISTS configurations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Índices para otimização
CREATE INDEX IF NOT EXISTS idx_request_logs_timestamp ON request_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_request_logs_ip ON request_logs(ip);
CREATE INDEX IF NOT EXISTS idx_request_logs_path ON request_logs(path);

CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON error_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_error_logs_level ON error_logs(level);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

CREATE INDEX IF NOT EXISTS idx_performance_logs_timestamp ON performance_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_performance_logs_endpoint ON performance_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_performance_logs_duration ON performance_logs(duration);

CREATE INDEX IF NOT EXISTS idx_document_uploads_client_id ON document_uploads(client_id);
CREATE INDEX IF NOT EXISTS idx_document_uploads_protocol_id ON document_uploads(protocol_id);
CREATE INDEX IF NOT EXISTS idx_document_uploads_user_id ON document_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_document_uploads_status ON document_uploads(status);
CREATE INDEX IF NOT EXISTS idx_document_uploads_timestamp ON document_uploads(timestamp);

CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active);

-- Configurações iniciais
INSERT OR IGNORE INTO configurations (key, value, description) VALUES 
('api_version', '1.0.0', 'Versão atual da API'),
('max_file_size_mb', '50', 'Tamanho máximo de arquivo em MB'),
('max_batch_size', '1000', 'Número máximo de documentos por lote'),
('processing_frequency_minutes', '30', 'Frequência de processamento em minutos'),
('rate_limit_per_minute', '100', 'Limite de requisições por minuto por IP'),
('cache_ttl_seconds', '3600', 'TTL padrão do cache em segundos');