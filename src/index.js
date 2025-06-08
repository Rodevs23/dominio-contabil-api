/**
 * Cloudflare Workers API Gateway
 * Integração com Thomson Reuters Domínio Contábil
 */

import { handleAuth } from './auth/oauth.js';
import { handleDocuments } from './handlers/documents.js';
import { handleClients } from './handlers/clients.js';
import { handleStatus } from './handlers/status.js';
import { corsHeaders, authenticateRequest } from './utils/security.js';
import { logRequest } from './utils/logging.js';

export default {
  async fetch(request, env, ctx) {
    // Log da requisição
    await logRequest(request, env);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Rotas públicas (sem autenticação)
      if (path === '/health') {
        return new Response('OK', { 
          status: 200,
          headers: corsHeaders
        });
      }

      if (path === '/docs') {
        return new Response(getApiDocs(), {
          headers: {
            'Content-Type': 'text/html',
            ...corsHeaders
          }
        });
      }

      // Autenticação OAuth
      if (path.startsWith('/auth/')) {
        return handleAuth(request, env, path);
      }

      // Rotas protegidas - requer autenticação
      const authResult = await authenticateRequest(request, env);
      if (!authResult.success) {
        return new Response(JSON.stringify({ 
          error: 'Unauthorized',
          message: authResult.message 
        }), {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      // Roteamento das APIs
      switch (true) {
        case path.startsWith('/api/clients'):
          return handleClients(request, env, authResult.token);

        case path.startsWith('/api/documents'):
          return handleDocuments(request, env, authResult.token);

        case path.startsWith('/api/status'):
          return handleStatus(request, env, authResult.token);

        case path === '/api/integration':
          return handleIntegrationInfo(request, env, authResult.token);

        default:
          return new Response(JSON.stringify({
            error: 'Not Found',
            message: 'Endpoint não encontrado',
            availableEndpoints: [
              '/health',
              '/docs',
              '/auth/login',
              '/auth/callback',
              '/api/clients',
              '/api/documents',
              '/api/status',
              '/api/integration'
            ]
          }), {
            status: 404,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
      }

    } catch (error) {
      console.error('Error processing request:', error);
      
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: 'Erro interno do servidor',
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  }
};

// Informações da integração
async function handleIntegrationInfo(request, env, token) {
  const integrationInfo = {
    apiVersion: '1.0.0',
    provider: 'Thomson Reuters Onvio',
    supportedDocuments: [
      'NFe v4.0',
      'NFCe v4.0', 
      'CTe v3.0',
      'CFe v0.07/0.08',
      'NFSe v1.00'
    ],
    processingFrequency: '30 minutos',
    maxBatchSize: 1000,
    status: 'active',
    lastSync: new Date().toISOString()
  };

  return new Response(JSON.stringify(integrationInfo), {
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}

// Documentação da API
function getApiDocs() {
  return `<!DOCTYPE html>
<html>
<head>
    <title>Domínio Contábil API - Documentação</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .endpoint { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 5px; }
        .method { color: #fff; padding: 2px 8px; border-radius: 3px; font-size: 12px; }
        .get { background: #61affe; }
        .post { background: #49cc90; }
        .put { background: #fca130; }
        .delete { background: #f93e3e; }
    </style>
</head>
<body>
    <h1>🏢 Domínio Contábil API</h1>
    <p>Gateway para integração com Thomson Reuters Onvio BR Accounting API</p>
    
    <h2>📋 Endpoints Disponíveis</h2>
    
    <div class="endpoint">
        <span class="method get">GET</span> <strong>/health</strong>
        <p>Verificação de saúde da API</p>
    </div>
    
    <div class="endpoint">
        <span class="method get">GET</span> <strong>/auth/login</strong>
        <p>Inicia processo de autenticação OAuth</p>
    </div>
    
    <div class="endpoint">
        <span class="method get">GET</span> <strong>/api/clients</strong>
        <p>Lista clientes disponíveis para integração</p>
    </div>
    
    <div class="endpoint">
        <span class="method post">POST</span> <strong>/api/documents/upload</strong>
        <p>Upload de documentos fiscais (NFe, CTe, etc.)</p>
    </div>
    
    <div class="endpoint">
        <span class="method get">GET</span> <strong>/api/status/{protocolId}</strong>
        <p>Consulta status de processamento</p>
    </div>
    
    <h2>🔐 Autenticação</h2>
    <p>Esta API utiliza OAuth 2.0. Inclua o header:</p>
    <code>Authorization: Bearer {access_token}</code>
    
    <h2>📄 Documentos Suportados</h2>
    <ul>
        <li>NFe (XML v4.0)</li>
        <li>NFCe (XML v4.0)</li>
        <li>CTe (XML v3.0)</li>
        <li>CFe (XML v0.07/0.08)</li>
        <li>NFSe (XML v1.00)</li>
    </ul>
    
    <p><em>Powered by Cloudflare Workers ⚡</em></p>
</body>
</html>`;
}
