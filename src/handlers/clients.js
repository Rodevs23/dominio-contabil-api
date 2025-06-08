/**
 * Clients Handler
 * Gerencia clientes disponíveis para integração
 */

import { corsHeaders } from '../utils/security.js';
import { makeOnvioRequest } from '../utils/onvio-client.js';

export async function handleClients(request, env, token) {
  const url = new URL(request.url);
  const method = request.method;
  
  try {
    switch (method) {
      case 'GET':
        return getClients(request, env, token);
      
      case 'POST':
        return enableClient(request, env, token);
      
      default:
        return new Response(JSON.stringify({
          error: 'Method Not Allowed',
          allowed: ['GET', 'POST']
        }), {
          status: 405,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
    }
  } catch (error) {
    console.error('Error in clients handler:', error);
    
    return new Response(JSON.stringify({
      error: 'Internal Server Error',
      message: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

// Lista clientes disponíveis
async function getClients(request, env, token) {
  try {
    // Buscar da cache primeiro
    const cacheKey = `clients_${token.userId || 'default'}`;
    const cachedClients = await env.CACHE.get(cacheKey);
    
    if (cachedClients) {
      return new Response(cachedClients, {
        headers: {
          'Content-Type': 'application/json',
          'X-Cache': 'HIT',
          ...corsHeaders
        }
      });
    }
    
    // Buscar da API Onvio
    const response = await makeOnvioRequest('/clients', {
      method: 'GET',
      token: token.accessToken,
      env
    });
    
    if (!response.ok) {
      throw new Error(`Onvio API error: ${response.status}`);
    }
    
    const clients = await response.json();
    
    // Processar e filtrar dados
    const processedClients = clients.map(client => ({
      id: client.id,
      name: client.name || client.companyName,
      cnpj: client.cnpj,
      inscricaoEstadual: client.inscricaoEstadual,
      status: client.status || 'active',
      lastSync: client.lastSync,
      documentsCount: client.documentsCount || 0,
      integrationEnabled: client.integrationEnabled || false
    }));
    
    const result = {
      success: true,
      data: processedClients,
      total: processedClients.length,
      timestamp: new Date().toISOString()
    };
    
    // Cache por 15 minutos
    await env.CACHE.put(cacheKey, JSON.stringify(result), {
      expirationTtl: 900
    });
    
    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': 'MISS',
        ...corsHeaders
      }
    });
    
  } catch (error) {
    console.error('Error fetching clients:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch clients',
      message: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

// Habilita integração para cliente
async function enableClient(request, env, token) {
  try {
    const { clientId, enabled = true } = await request.json();
    
    if (!clientId) {
      return new Response(JSON.stringify({
        error: 'Missing client ID'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    // Atualizar via API Onvio
    const response = await makeOnvioRequest(`/clients/${clientId}/integration`, {
      method: 'PUT',
      token: token.accessToken,
      env,
      body: JSON.stringify({
        enabled: enabled
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update client: ${response.status}`);
    }
    
    const result = await response.json();
    
    // Invalidar cache
    const cacheKey = `clients_${token.userId || 'default'}`;
    await env.CACHE.delete(cacheKey);
    
    return new Response(JSON.stringify({
      success: true,
      clientId: clientId,
      enabled: enabled,
      message: `Integração ${enabled ? 'habilitada' : 'desabilitada'} com sucesso`,
      data: result
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
    
  } catch (error) {
    console.error('Error enabling client:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to enable client integration',
      message: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}