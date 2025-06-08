/**
 * Teste Simples - Cloudflare Workers API Gateway
 * Integração com Thomson Reuters Domínio Contábil
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Rota de teste básico
      if (path === '/') {
        return new Response(JSON.stringify({
          message: '🏢 Domínio Contábil API - Teste Inicial',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          status: 'online'
        }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      // Health check
      if (path === '/health') {
        return new Response(JSON.stringify({
          status: 'healthy',
          uptime: Date.now(),
          service: 'dominio-contabil-api'
        }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      // Teste de integração Thomson Reuters
      if (path === '/test/onvio') {
        return new Response(JSON.stringify({
          provider: 'Thomson Reuters Onvio',
          endpoints: {
            auth: 'https://auth.thomsonreuters.com',
            api: 'https://api.onvio.com.br',
            audience: '409f91f6-dc17-44c8-a5d8-e0a1bafd8b67'
          },
          supportedDocuments: [
            'NFe v4.0 (XML)',
            'NFCe v4.0 (XML)',
            'CTe v3.0 (XML)',
            'CFe v0.07/0.08 (XML)',
            'NFSe v1.00 (XML)'
          ],
          features: [
            'OAuth 2.0 Authentication',
            'Batch processing (up to 1000 docs)',
            'Real-time status tracking',
            'Edge caching',
            'Global deployment'
          ]
        }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      // Teste de validação de XML simples
      if (path === '/test/validate' && request.method === 'POST') {
        const body = await request.text();
        
        const isValidXML = body.trim().startsWith('<?xml') || body.trim().startsWith('<');
        const hasNFePattern = /<nfeProc|<NFe|<infNFe/.test(body);
        const hasCTePattern = /<cteProc|<CTe|<infCte/.test(body);
        
        let documentType = 'UNKNOWN';
        if (hasNFePattern) documentType = 'NFe';
        if (hasCTePattern) documentType = 'CTe';

        return new Response(JSON.stringify({
          valid: isValidXML,
          documentType: documentType,
          size: body.length,
          hasValidStructure: hasNFePattern || hasCTePattern,
          timestamp: new Date().toISOString()
        }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      // Documentação simples
      if (path === '/docs') {
        const docs = `
<!DOCTYPE html>
<html>
<head>
    <title>Domínio Contábil API - Teste</title>
    <style>
        body { font-family: Arial; margin: 40px; background: #f5f5f5; }
        .container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .endpoint { background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #007bff; }
        .method { background: #007bff; color: white; padding: 3px 8px; border-radius: 3px; font-size: 12px; }
        code { background: #f1f1f1; padding: 2px 6px; border-radius: 3px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🏢 Domínio Contábil API - Teste</h1>
        <p>Gateway para integração com Thomson Reuters Onvio BR Accounting API</p>
        
        <h2>📋 Endpoints de Teste</h2>
        
        <div class="endpoint">
            <span class="method">GET</span> <strong>/</strong>
            <p>Informações básicas da API</p>
        </div>
        
        <div class="endpoint">
            <span class="method">GET</span> <strong>/health</strong>
            <p>Status de saúde do serviço</p>
        </div>
        
        <div class="endpoint">
            <span class="method">GET</span> <strong>/test/onvio</strong>
            <p>Informações sobre integração Thomson Reuters</p>
        </div>
        
        <div class="endpoint">
            <span class="method">POST</span> <strong>/test/validate</strong>
            <p>Teste de validação de XML fiscal<br>
            <small>Envie XML no body da requisição</small></p>
        </div>

        <h2>🧪 Como Testar</h2>
        
        <h3>1. Teste Básico</h3>
        <code>curl https://your-worker.your-subdomain.workers.dev/</code>
        
        <h3>2. Health Check</h3>
        <code>curl https://your-worker.your-subdomain.workers.dev/health</code>
        
        <h3>3. Validar XML</h3>
        <code>curl -X POST https://your-worker.your-subdomain.workers.dev/test/validate -d '&lt;?xml version="1.0"?&gt;&lt;NFe&gt;&lt;/NFe&gt;'</code>

        <h2>📄 Próximos Passos</h2>
        <ul>
            <li>✅ Configurar credenciais OAuth Thomson Reuters</li>
            <li>✅ Implementar autenticação completa</li>
            <li>✅ Adicionar upload de documentos</li>
            <li>✅ Configurar banco D1 e KV</li>
            <li>✅ Implementar cache e logs</li>
        </ul>

        <p><em>Powered by Cloudflare Workers ⚡</em></p>
    </div>
</body>
</html>`;

        return new Response(docs, {
          headers: {
            'Content-Type': 'text/html',
            ...corsHeaders
          }
        });
      }

      // 404 para rotas não encontradas
      return new Response(JSON.stringify({
        error: 'Not Found',
        message: 'Endpoint não encontrado',
        path: path,
        availableEndpoints: [
          '/',
          '/health', 
          '/test/onvio',
          '/test/validate (POST)',
          '/docs'
        ]
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });

    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: error.message,
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
