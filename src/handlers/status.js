/**
 * Status Handler
 * Consulta status de processamento de documentos
 */

import { corsHeaders } from '../utils/security.js';
import { makeOnvioRequest } from '../utils/onvio-client.js';

export async function handleStatus(request, env, token) {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const protocolId = pathParts[pathParts.length - 1];
  
  if (!protocolId || protocolId === 'status') {
    return new Response(JSON.stringify({
      error: 'Missing protocol ID',
      usage: '/api/status/{protocolId}'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
  
  try {
    // Buscar da cache primeiro
    const cacheKey = `status_${protocolId}`;
    const cachedStatus = await env.CACHE.get(cacheKey);
    
    if (cachedStatus) {
      const status = JSON.parse(cachedStatus);
      
      // Se status final, retornar do cache
      if (['completed', 'failed', 'cancelled'].includes(status.status)) {
        return new Response(cachedStatus, {
          headers: {
            'Content-Type': 'application/json',
            'X-Cache': 'HIT',
            ...corsHeaders
          }
        });
      }
    }
    
    // Buscar status atual da API Onvio
    const response = await makeOnvioRequest(`/protocols/${protocolId}`, {
      method: 'GET',
      token: token.accessToken,
      env
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        return new Response(JSON.stringify({
          error: 'Protocol not found',
          protocolId: protocolId
        }), {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
      
      throw new Error(`Onvio API error: ${response.status}`);
    }
    
    const statusData = await response.json();
    
    // Processar e normalizar status
    const normalizedStatus = {
      protocolId: protocolId,
      status: mapOnvioStatus(statusData.status),
      progress: statusData.progress || 0,
      documentsTotal: statusData.documentsTotal || 0,
      documentsProcessed: statusData.documentsProcessed || 0,
      documentsSuccess: statusData.documentsSuccess || 0,
      documentsError: statusData.documentsError || 0,
      startedAt: statusData.startedAt,
      updatedAt: statusData.updatedAt,
      completedAt: statusData.completedAt,
      errors: statusData.errors || [],
      warnings: statusData.warnings || [],
      estimatedTimeRemaining: statusData.estimatedTimeRemaining
    };
    
    // Determinar TTL do cache baseado no status
    let cacheTtl = 30; // 30 segundos para status em progresso
    if (['completed', 'failed', 'cancelled'].includes(normalizedStatus.status)) {
      cacheTtl = 3600; // 1 hora para status finais
    }
    
    // Atualizar cache
    await env.CACHE.put(cacheKey, JSON.stringify(normalizedStatus), {
      expirationTtl: cacheTtl
    });
    
    // Atualizar no banco D1 se existir
    await updateStatusInDB(env, protocolId, normalizedStatus);
    
    return new Response(JSON.stringify(normalizedStatus), {
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': 'MISS',
        ...corsHeaders
      }
    });
    
  } catch (error) {
    console.error('Error fetching status:', error);
    
    return new Response(JSON.stringify({
      error: 'Failed to fetch status',
      protocolId: protocolId,
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

// Mapear status da Onvio para status padronizado
function mapOnvioStatus(onvioStatus) {
  const statusMap = {
    'PENDING': 'pending',
    'PROCESSING': 'processing', 
    'COMPLETED': 'completed',
    'FAILED': 'failed',
    'CANCELLED': 'cancelled',
    'PARTIAL': 'partial'
  };
  
  return statusMap[onvioStatus] || 'unknown';
}

// Atualizar status no banco D1
async function updateStatusInDB(env, protocolId, statusData) {
  try {
    await env.DB.prepare(`
      UPDATE document_uploads 
      SET 
        status = ?,
        progress = ?,
        updated_at = ?,
        completed_at = ?
      WHERE protocol_id = ?
    `).bind(
      statusData.status,
      statusData.progress,
      statusData.updatedAt,
      statusData.completedAt,
      protocolId
    ).run();
  } catch (error) {
    console.error('Error updating status in DB:', error);
  }
}