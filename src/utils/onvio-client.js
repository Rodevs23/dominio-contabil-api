/**
 * Onvio API Client
 * Cliente para comunicação com Thomson Reuters Onvio API
 */

// Fazer requisição para API Onvio
export async function makeOnvioRequest(endpoint, options = {}) {
  const {
    method = 'GET',
    token,
    env,
    body,
    headers = {},
    timeout = 30000
  } = options;
  
  const url = `${env.DOMINIO_BASE_URL}${endpoint}`;
  
  const requestHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'User-Agent': 'DominioAPI/1.0.0',
    ...headers
  };
  
  const requestOptions = {
    method,
    headers: requestHeaders,
    ...(body && { body })
  };
  
  try {
    // Timeout controller
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    requestOptions.signal = controller.signal;
    
    const response = await fetch(url, requestOptions);
    
    clearTimeout(timeoutId);
    
    // Log da requisição
    console.log(`Onvio API: ${method} ${endpoint} - ${response.status}`);
    
    return response;
    
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    
    console.error(`Onvio API Error: ${method} ${endpoint}`, error);
    throw error;
  }
}

// Retry automático para requisições que falharam
export async function makeOnvioRequestWithRetry(endpoint, options = {}, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await makeOnvioRequest(endpoint, options);
      
      // Se sucesso ou erro cliente (4xx), não retry
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }
      
      // Para erros 5xx, fazer retry
      if (attempt === maxRetries) {
        return response;
      }
      
      // Esperar antes do próximo retry (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
      
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Esperar antes do próximo retry
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// Upload de arquivo para Onvio
export async function uploadFileToOnvio(fileData, options = {}) {
  const {
    token,
    env,
    clientId,
    documentType,
    fileName,
    contentType = 'application/xml'
  } = options;
  
  const formData = new FormData();
  formData.append('file', new Blob([fileData], { type: contentType }), fileName);
  formData.append('clientId', clientId);
  formData.append('documentType', documentType);
  
  return makeOnvioRequest('/files/upload', {
    method: 'POST',
    token,
    env,
    body: formData,
    headers: {
      // Não definir Content-Type para FormData (browser define automaticamente)
    }
  });
}

// Buscar informações do cliente
export async function getClientInfo(clientId, token, env) {
  try {
    const response = await makeOnvioRequest(`/clients/${clientId}`, {
      method: 'GET',
      token,
      env
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch client info: ${response.status}`);
    }
    
    return await response.json();
    
  } catch (error) {
    console.error('Error fetching client info:', error);
    throw error;
  }
}

// Verificar saúde da API Onvio
export async function checkOnvioHealth(env) {
  try {
    const response = await fetch(`${env.DOMINIO_BASE_URL}/health`, {
      method: 'GET',
      headers: {
        'User-Agent': 'DominioAPI/1.0.0'
      },
      signal: AbortSignal.timeout(5000)
    });
    
    return {
      healthy: response.ok,
      status: response.status,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    return {
      healthy: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// Obter estatísticas de uso
export async function getUsageStats(token, env, period = '24h') {
  try {
    const response = await makeOnvioRequest(`/stats/usage?period=${period}`, {
      method: 'GET',
      token,
      env
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch usage stats: ${response.status}`);
    }
    
    return await response.json();
    
  } catch (error) {
    console.error('Error fetching usage stats:', error);
    throw error;
  }
}