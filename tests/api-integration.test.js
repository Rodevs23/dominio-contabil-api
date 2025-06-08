/**
 * Testes de Integração da API
 */

// Mock do ambiente Cloudflare Workers
const mockEnv = {
  DOMINIO_BASE_URL: 'https://api.onvio.test.com',
  THOMSON_AUTH_URL: 'https://auth.thomson.test.com',
  THOMSON_CLIENT_ID: 'test_client_id',
  THOMSON_CLIENT_SECRET: 'test_client_secret',
  THOMSON_AUDIENCE: 'test_audience',
  CACHE: {
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn()
  },
  DB: {
    prepare: jest.fn(() => ({
      bind: jest.fn(() => ({
        run: jest.fn(() => Promise.resolve({ success: true })),
        all: jest.fn(() => Promise.resolve({ results: [] }))
      }))
    }))
  }
};

// Mock do fetch global
global.fetch = jest.fn();

describe('API Integration Tests', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('Health Check', () => {
    test('GET /health deve retornar 200', async () => {
      // Importar o handler principal
      const worker = await import('../src/index.js');
      
      const request = new Request('https://api.test.com/health', {
        method: 'GET'
      });
      
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toBe('OK');
    });
  });
  
  describe('Authentication', () => {
    test('deve rejeitar requisições sem autenticação', async () => {
      const worker = await import('../src/index.js');
      
      const request = new Request('https://api.test.com/api/clients', {
        method: 'GET'
      });
      
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });
    
    test('deve aceitar Bearer token válido', async () => {
      // Mock do token no cache
      mockEnv.CACHE.get.mockResolvedValueOnce(JSON.stringify({
        accessToken: 'valid_token',
        expiresAt: Date.now() + 3600000,
        userId: 'test_user'
      }));
      
      // Mock da resposta da API Onvio
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([])
      });
      
      const worker = await import('../src/index.js');
      
      const request = new Request('https://api.test.com/api/clients', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test_token_key'
        }
      });
      
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.status).toBe(200);
    });
  });
  
  describe('Document Upload', () => {
    test('deve aceitar upload de NFe válida', async () => {
      // Setup mocks
      mockEnv.CACHE.get.mockResolvedValueOnce(JSON.stringify({
        accessToken: 'valid_token',
        expiresAt: Date.now() + 3600000,
        userId: 'test_user'
      }));
      
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ protocolId: 'test_protocol_123' })
      });
      
      const nfeXML = `<?xml version="1.0"?>
      <nfeProc>
        <NFe>
          <infNFe>
            <ide><nNF>123</nNF><serie>1</serie></ide>
            <emit><CNPJ>12345678000195</CNPJ></emit>
          </infNFe>
        </NFe>
      </nfeProc>`;
      
      const formData = new FormData();
      formData.append('document', new Blob([nfeXML], { type: 'application/xml' }), 'teste.xml');
      formData.append('clientId', '123456');
      
      const worker = await import('../src/index.js');
      
      const request = new Request('https://api.test.com/api/documents/upload', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test_token_key'
        },
        body: formData
      });
      
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.protocolId).toBe('test_protocol_123');
    });
    
    test('deve rejeitar XML inválido', async () => {
      // Setup mocks
      mockEnv.CACHE.get.mockResolvedValueOnce(JSON.stringify({
        accessToken: 'valid_token',
        expiresAt: Date.now() + 3600000,
        userId: 'test_user'
      }));
      
      const invalidXML = '<invalid><unclosed>test</invalid>';
      
      const formData = new FormData();
      formData.append('document', new Blob([invalidXML], { type: 'application/xml' }), 'invalid.xml');
      formData.append('clientId', '123456');
      
      const worker = await import('../src/index.js');
      
      const request = new Request('https://api.test.com/api/documents/upload', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test_token_key'
        },
        body: formData
      });
      
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid document');
    });
  });
  
  describe('Status Check', () => {
    test('deve retornar status de protocolo existente', async () => {
      // Setup mocks
      mockEnv.CACHE.get.mockResolvedValueOnce(JSON.stringify({
        accessToken: 'valid_token',
        expiresAt: Date.now() + 3600000,
        userId: 'test_user'
      }));
      
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          status: 'COMPLETED',
          progress: 100,
          documentsTotal: 1,
          documentsProcessed: 1,
          documentsSuccess: 1,
          documentsError: 0
        })
      });
      
      const worker = await import('../src/index.js');
      
      const request = new Request('https://api.test.com/api/status/test_protocol_123', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test_token_key'
        }
      });
      
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.protocolId).toBe('test_protocol_123');
      expect(data.status).toBe('completed');
      expect(data.progress).toBe(100);
    });
    
    test('deve retornar 404 para protocolo inexistente', async () => {
      // Setup mocks
      mockEnv.CACHE.get.mockResolvedValueOnce(JSON.stringify({
        accessToken: 'valid_token',
        expiresAt: Date.now() + 3600000,
        userId: 'test_user'
      }));
      
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      });
      
      const worker = await import('../src/index.js');
      
      const request = new Request('https://api.test.com/api/status/invalid_protocol', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test_token_key'
        }
      });
      
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Protocol not found');
    });
  });
  
  describe('CORS', () => {
    test('deve responder corretamente a preflight OPTIONS', async () => {
      const worker = await import('../src/index.js');
      
      const request = new Request('https://api.test.com/api/clients', {
        method: 'OPTIONS'
      });
      
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    });
  });
});