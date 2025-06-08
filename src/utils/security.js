/**
 * Security Utilities
 * Autenticação, CORS e validações de segurança
 */

// Headers CORS
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
  'Access-Control-Max-Age': '86400'
};

// Autenticar requisição
export async function authenticateRequest(request, env) {
  const authHeader = request.headers.get('Authorization');
  const apiKeyHeader = request.headers.get('X-API-Key');
  
  // Verificar API Key (para integrações diretas)
  if (apiKeyHeader) {
    return authenticateWithApiKey(apiKeyHeader, env);
  }
  
  // Verificar Bearer Token (OAuth)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const tokenKey = authHeader.substring(7);
    return authenticateWithBearer(tokenKey, env);
  }
  
  return {
    success: false,
    message: 'Missing authentication. Use Authorization header or X-API-Key.'
  };
}

// Autenticação via API Key
async function authenticateWithApiKey(apiKey, env) {
  try {
    // Hash da API key para comparação segura
    const hashedKey = await hashApiKey(apiKey);
    const storedHash = await env.CACHE.get(`api_key_${hashedKey}`);
    
    if (!storedHash) {
      return {
        success: false,
        message: 'Invalid API key'
      };
    }
    
    const keyData = JSON.parse(storedHash);
    
    // Verificar se a key não expirou
    if (keyData.expiresAt && Date.now() > keyData.expiresAt) {
      await env.CACHE.delete(`api_key_${hashedKey}`);
      return {
        success: false,
        message: 'API key expired'
      };
    }
    
    return {
      success: true,
      token: {
        type: 'api_key',
        userId: keyData.userId,
        permissions: keyData.permissions || ['read', 'write']
      }
    };
    
  } catch (error) {
    console.error('Error authenticating API key:', error);
    return {
      success: false,
      message: 'Authentication error'
    };
  }
}

// Autenticação via Bearer Token (OAuth)
async function authenticateWithBearer(tokenKey, env) {
  try {
    const tokenData = await env.CACHE.get(`access_token_${tokenKey}`);
    
    if (!tokenData) {
      return {
        success: false,
        message: 'Invalid or expired token'
      };
    }
    
    const token = JSON.parse(tokenData);
    
    // Verificar se o token não expirou
    if (token.expiresAt && Date.now() > token.expiresAt) {
      await env.CACHE.delete(`access_token_${tokenKey}`);
      return {
        success: false,
        message: 'Token expired'
      };
    }
    
    return {
      success: true,
      token: {
        type: 'oauth',
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        tokenType: token.tokenType,
        userId: token.userId || 'default'
      }
    };
    
  } catch (error) {
    console.error('Error authenticating bearer token:', error);
    return {
      success: false,
      message: 'Authentication error'
    };
  }
}

// Hash seguro para API keys
async function hashApiKey(apiKey) {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hash));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Validar origem da requisição
export function validateOrigin(request, allowedOrigins = []) {
  const origin = request.headers.get('Origin');
  
  if (!origin) {
    return true; // Permitir requisições sem origem (ex: Postman)
  }
  
  if (allowedOrigins.length === 0) {
    return true; // Se não há restrições, permitir tudo
  }
  
  return allowedOrigins.includes(origin);
}

// Rate limiting simples
export async function checkRateLimit(request, env, limit = 100, window = 3600) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const key = `rate_limit_${ip}`;
  
  try {
    const current = await env.CACHE.get(key);
    const count = current ? parseInt(current) : 0;
    
    if (count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: window
      };
    }
    
    // Incrementar contador
    await env.CACHE.put(key, (count + 1).toString(), {
      expirationTtl: window
    });
    
    return {
      allowed: true,
      remaining: limit - count - 1,
      resetTime: window
    };
    
  } catch (error) {
    console.error('Error checking rate limit:', error);
    // Em caso de erro, permitir a requisição
    return {
      allowed: true,
      remaining: limit - 1,
      resetTime: window
    };
  }
}

// Sanitizar entrada de dados
export function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return input;
  }
  
  return input
    .replace(/[<>"'&]/g, '') // Remove caracteres perigosos
    .trim()
    .substring(0, 1000); // Limita tamanho
}

// Validar CNPJ
export function validateCNPJ(cnpj) {
  if (!cnpj) return false;
  
  // Remove formatação
  cnpj = cnpj.replace(/[^\d]/g, '');
  
  // Verifica se tem 14 dígitos
  if (cnpj.length !== 14) return false;
  
  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  
  // Validação dos dígitos verificadores
  let sum = 0;
  let weight = 2;
  
  for (let i = 11; i >= 0; i--) {
    sum += parseInt(cnpj.charAt(i)) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  
  let digit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (parseInt(cnpj.charAt(12)) !== digit) return false;
  
  sum = 0;
  weight = 2;
  
  for (let i = 12; i >= 0; i--) {
    sum += parseInt(cnpj.charAt(i)) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  
  digit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  return parseInt(cnpj.charAt(13)) === digit;
}