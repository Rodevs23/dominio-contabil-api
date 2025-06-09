# 📚 API Reference - Domínio Contábil

## 🏗️ Arquitetura

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   ERP Cliente   │───▶│ Cloudflare API   │───▶│ Thomson Reuters │
│                 │    │     Gateway      │    │   Onvio API     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────┐
                       │ Cache & Logs │
                       │  (KV + D1)   │
                       └──────────────┘
```

## 🔐 Autenticação

### OAuth 2.0 Flow

```http
# 1. Iniciar autenticação
GET /auth/login

# Response: Redirect para Thomson Reuters
HTTP/1.1 302 Found
Location: https://auth.thomsonreuters.com/authorize?client_id=...&response_type=code&...
```

```http
# 2. Callback (automático)
GET /auth/callback?code=AUTH_CODE&state=STATE_VALUE

# Response: Token de acesso
{
  "success": true,
  "tokenKey": "uuid-token-key",
  "expiresIn": 3600,
  "message": "Autenticação realizada com sucesso"
}
```

```http
# 3. Usar token nas requisições
Authorization: Bearer {tokenKey}
```

### API Key (Alternativa)

```http
X-API-Key: your_api_key_here
```

## 📋 Endpoints

### 🏥 Health & Info

#### GET /health
Verifica saúde da API.

```http
GET /health

# Response
HTTP/1.1 200 OK
OK
```

#### GET /docs
Documentação interativa da API.

```http
GET /docs

# Response: HTML da documentação
```

#### GET /api/integration
Informações da integração.

```http
GET /api/integration
Authorization: Bearer {token}

# Response
{
  "apiVersion": "1.0.0",
  "provider": "Thomson Reuters Onvio",
  "supportedDocuments": [
    "NFe v4.0",
    "NFCe v4.0",
    "CTe v3.0",
    "CFe v0.07/0.08",
    "NFSe v1.00"
  ],
  "processingFrequency": "30 minutos",
  "maxBatchSize": 1000,
  "status": "active",
  "lastSync": "2025-06-08T22:30:00Z"
}
```

### 👥 Clientes

#### GET /api/clients
Lista clientes disponíveis para integração.

```http
GET /api/clients
Authorization: Bearer {token}

# Response
{
  "success": true,
  "data": [
    {
      "id": "123456",
      "name": "Empresa Exemplo LTDA",
      "cnpj": "12345678000195",
      "inscricaoEstadual": "123456789",
      "status": "active",
      "lastSync": "2025-06-08T20:00:00Z",
      "documentsCount": 150,
      "integrationEnabled": true
    }
  ],
  "total": 1,
  "timestamp": "2025-06-08T22:30:00Z"
}
```

#### POST /api/clients
Habilita/desabilita integração para cliente.

```http
POST /api/clients
Authorization: Bearer {token}
Content-Type: application/json

{
  "clientId": "123456",
  "enabled": true
}

# Response
{
  "success": true,
  "clientId": "123456",
  "enabled": true,
  "message": "Integração habilitada com sucesso"
}
```

### 📄 Documentos

#### POST /api/documents/upload
Upload de documento fiscal único.

```http
POST /api/documents/upload
Authorization: Bearer {token}
Content-Type: multipart/form-data

document: [arquivo XML]
clientId: "123456"

# Response
{
  "success": true,
  "protocolId": "prot_abc123def456",
  "documentType": "NFe",
  "fileName": "nfe_123.xml",
  "status": "uploaded",
  "message": "Documento enviado com sucesso"
}
```

#### POST /api/documents/batch
Upload em lote (até 1000 documentos).

```http
POST /api/documents/batch
Authorization: Bearer {token}
Content-Type: application/json

{
  "documents": [
    {
      "clientId": "123456",
      "fileName": "nfe_001.xml",
      "content": "<?xml version=\"1.0\"?>..."
    },
    {
      "clientId": "123456",
      "fileName": "nfe_002.xml", 
      "content": "<?xml version=\"1.0\"?>..."
    }
  ]
}

# Response
{
  "success": true,
  "protocolId": "batch_xyz789abc123",
  "processed": 2,
  "errors": 0,
  "results": [
    {
      "index": 0,
      "fileName": "nfe_001.xml",
      "documentType": "NFe",
      "clientId": "123456",
      "status": "validated"
    }
  ],
  "message": "Processados 2 documentos, 0 erros"
}
```

#### GET /api/documents
Lista documentos processados.

```http
GET /api/documents?clientId=123456&status=completed&limit=50&offset=0
Authorization: Bearer {token}

# Response
{
  "success": true,
  "data": [
    {
      "id": "doc_123",
      "protocolId": "prot_abc123",
      "clientId": "123456",
      "documentType": "NFe",
      "fileName": "nfe_001.xml",
      "status": "completed",
      "uploadedAt": "2025-06-08T20:00:00Z",
      "processedAt": "2025-06-08T20:05:00Z"
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

### 📊 Status

#### GET /api/status/{protocolId}
Consulta status de processamento.

```http
GET /api/status/prot_abc123def456
Authorization: Bearer {token}

# Response
{
  "protocolId": "prot_abc123def456",
  "status": "processing",
  "progress": 75,
  "documentsTotal": 100,
  "documentsProcessed": 75,
  "documentsSuccess": 70,
  "documentsError": 5,
  "startedAt": "2025-06-08T20:00:00Z",
  "updatedAt": "2025-06-08T20:15:00Z",
  "completedAt": null,
  "errors": [
    {
      "fileName": "invalid.xml",
      "error": "XML structure invalid",
      "code": "INVALID_XML"
    }
  ],
  "warnings": [],
  "estimatedTimeRemaining": 300
}
```

## 📝 Status dos Documentos

### Estados Possíveis

| Status | Descrição |
|--------|----------|
| `pending` | Aguardando processamento |
| `processing` | Processando na API |
| `completed` | Processado com sucesso |
| `partial` | Processado parcialmente |
| `failed` | Falha no processamento |
| `cancelled` | Cancelado pelo usuário |

### Códigos de Erro Comuns

| Código | Descrição | Solução |
|--------|-----------|----------|
| `INVALID_XML` | XML mal formado | Validar estrutura XML |
| `UNSUPPORTED_DOCUMENT` | Tipo não suportado | Verificar tipos aceitos |
| `CLIENT_NOT_FOUND` | Cliente não encontrado | Verificar CNPJ/ID cliente |
| `AUTHENTICATION_FAILED` | Falha na autenticação | Renovar token |
| `QUOTA_EXCEEDED` | Cota excedida | Aguardar ou contactar suporte |

## 🔍 Filtros e Consultas

### Parâmetros de Query

| Parâmetro | Tipo | Descrição | Exemplo |
|-----------|------|-----------|----------|
| `clientId` | string | Filtrar por cliente | `?clientId=123456` |
| `status` | string | Filtrar por status | `?status=completed` |
| `documentType` | string | Tipo do documento | `?documentType=NFe` |
| `startDate` | string | Data início (ISO) | `?startDate=2025-06-01T00:00:00Z` |
| `endDate` | string | Data fim (ISO) | `?endDate=2025-06-08T23:59:59Z` |
| `limit` | number | Máx. resultados | `?limit=100` |
| `offset` | number | Pular resultados | `?offset=50` |

### Exemplos de Consultas

```http
# Documentos de um cliente específico
GET /api/documents?clientId=123456&limit=10

# Documentos com erro nos últimos 7 dias  
GET /api/documents?status=failed&startDate=2025-06-01T00:00:00Z

# NFes processadas com sucesso
GET /api/documents?documentType=NFe&status=completed

# Paginação
GET /api/documents?limit=50&offset=100
```

## ⚠️ Limites e Restrições

### Rate Limiting

```http
# Headers de resposta
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

### Limites por Endpoint

| Endpoint | Limite | Janela |
|----------|--------|--------|
| Geral | 100 req/min | Por IP |
| Upload | 10 req/min | Por token |
| Batch | 5 req/min | Por token |
| Status | 60 req/min | Por token |

### Tamanhos Máximos

| Item | Limite |
|------|--------|
| Arquivo individual | 50 MB |
| Lote (batch) | 1000 documentos |
| Requisição total | 100 MB |
| Nome do arquivo | 255 caracteres |

## 🚨 Tratamento de Erros

### Estrutura de Erro

```json
{
  "error": "Validation Error",
  "message": "XML inválido: estrutura de tags desbalanceada",
  "code": "INVALID_XML",
  "details": {
    "fileName": "documento.xml",
    "line": 42,
    "column": 15
  },
  "timestamp": "2025-06-08T22:30:00Z",
  "requestId": "req_abc123def456"
}
```

### Códigos HTTP

| Código | Significado | Ação |
|--------|-------------|-------|
| 200 | Sucesso | - |
| 400 | Erro do cliente | Verificar dados enviados |
| 401 | Não autorizado | Verificar autenticação |
| 403 | Proibido | Verificar permissões |
| 404 | Não encontrado | Verificar URL/ID |
| 429 | Muitas requisições | Aguardar e tentar novamente |
| 500 | Erro interno | Contactar suporte |

## 🔧 Headers Recomendados

### Request Headers

```http
Authorization: Bearer {token}
Content-Type: application/json
User-Agent: MeuERP/1.0.0
X-Request-ID: req_unique_id_123
```

### Response Headers

```http
Content-Type: application/json
X-Request-ID: req_unique_id_123
X-Response-Time: 150ms
X-Cache: HIT
Access-Control-Allow-Origin: *
```

## 🔄 Webhook (Futuro)

*Funcionalidade planejada para notificações automáticas:*

```json
{
  "event": "document.processed",
  "protocolId": "prot_abc123",
  "status": "completed",
  "timestamp": "2025-06-08T22:30:00Z",
  "data": {
    "documentsProcessed": 100,
    "documentsSuccess": 95,
    "documentsError": 5
  }
}
```

---

## 📞 Suporte

- **Email:** api.dominio@tr.com
- **Documentação oficial:** [Thomson Reuters Developer Portal](https://developerportal.thomsonreuters.com/onvio-br-accounting-api)
- **Status:** `GET /health`
- **Versão:** 1.0.0

*Documentação atualizada em: 08/06/2025*