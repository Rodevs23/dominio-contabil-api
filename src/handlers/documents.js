/**
 * Documents Handler
 * Gerencia upload e processamento de documentos fiscais
 */

import { corsHeaders } from '../utils/security.js';
import { makeOnvioRequest } from '../utils/onvio-client.js';
import { validateXML, getDocumentType } from '../utils/document-validator.js';

export async function handleDocuments(request, env, token) {
  const url = new URL(request.url);
  const method = request.method;
  const path = url.pathname;
  
  try {
    if (path.endsWith('/upload')) {
      return handleUpload(request, env, token);
    }
    
    if (path.endsWith('/batch')) {
      return handleBatchUpload(request, env, token);
    }
    
    if (method === 'GET') {
      return getDocuments(request, env, token);
    }
    
    return new Response(JSON.stringify({
      error: 'Endpoint not found',
      availableEndpoints: [
        '/api/documents (GET)',
        '/api/documents/upload (POST)',
        '/api/documents/batch (POST)'
      ]
    }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
    
  } catch (error) {
    console.error('Error in documents handler:', error);
    
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

// Upload de documento único
async function handleUpload(request, env, token) {
  try {
    const formData = await request.formData();
    const file = formData.get('document');
    const clientId = formData.get('clientId');
    
    if (!file || !clientId) {
      return new Response(JSON.stringify({
        error: 'Missing required fields',
        required: ['document', 'clientId']
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    // Validar arquivo
    const fileContent = await file.text();
    const validation = validateXML(fileContent);
    
    if (!validation.valid) {
      return new Response(JSON.stringify({
        error: 'Invalid document',
        message: validation.error
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    const documentType = getDocumentType(fileContent);
    
    // Preparar payload para Onvio
    const payload = {
      clientId: clientId,
      documentType: documentType,
      fileName: file.name,
      content: btoa(fileContent), // Base64 encode
      contentType: 'application/xml'
    };
    
    // Enviar para Onvio
    const response = await makeOnvioRequest('/invoice-integration', {
      method: 'POST',
      token: token.accessToken,
      env,
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`Onvio upload failed: ${response.status}`);
    }
    
    const result = await response.json();
    
    // Log do upload
    await logUpload(env, {
      clientId,
      documentType,
      fileName: file.name,
      size: file.size,
      protocolId: result.protocolId,
      userId: token.userId,
      timestamp: new Date().toISOString()
    });
    
    return new Response(JSON.stringify({
      success: true,
      protocolId: result.protocolId,
      documentType: documentType,
      fileName: file.name,
      status: 'uploaded',
      message: 'Documento enviado com sucesso'
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
    
  } catch (error) {
    console.error('Error uploading document:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Upload failed',
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

// Upload em lote
async function handleBatchUpload(request, env, token) {
  try {
    const { documents } = await request.json();
    
    if (!Array.isArray(documents) || documents.length === 0) {
      return new Response(JSON.stringify({
        error: 'Invalid batch',
        message: 'documents deve ser um array não vazio'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    if (documents.length > 1000) {
      return new Response(JSON.stringify({
        error: 'Batch too large',
        message: 'Máximo 1000 documentos por lote',
        limit: 1000,
        received: documents.length
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    // Processar lote
    const results = [];
    const errors = [];
    
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      
      try {
        // Validar documento
        const validation = validateXML(doc.content);
        if (!validation.valid) {
          errors.push({
            index: i,
            fileName: doc.fileName,
            error: validation.error
          });
          continue;
        }
        
        const documentType = getDocumentType(doc.content);
        
        results.push({
          index: i,
          fileName: doc.fileName,
          documentType: documentType,
          clientId: doc.clientId,
          status: 'validated'
        });
        
      } catch (error) {
        errors.push({
          index: i,
          fileName: doc.fileName,
          error: error.message
        });
      }
    }
    
    // Se há documentos válidos, enviar para Onvio
    let protocolId = null;
    if (results.length > 0) {
      const batchPayload = {
        documents: results.map(doc => ({
          clientId: doc.clientId,
          documentType: doc.documentType,
          fileName: doc.fileName,
          content: btoa(documents[doc.index].content)
        }))
      };
      
      const response = await makeOnvioRequest('/invoice-integration/batch', {
        method: 'POST',
        token: token.accessToken,
        env,
        body: JSON.stringify(batchPayload)
      });
      
      if (response.ok) {
        const batchResult = await response.json();
        protocolId = batchResult.protocolId;
      }
    }
    
    return new Response(JSON.stringify({
      success: true,
      protocolId: protocolId,
      processed: results.length,
      errors: errors.length,
      results: results,
      errors: errors,
      message: `Processados ${results.length} documentos, ${errors.length} erros`
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
    
  } catch (error) {
    console.error('Error in batch upload:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Batch upload failed',
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

// Listar documentos processados
async function getDocuments(request, env, token) {
  const url = new URL(request.url);
  const clientId = url.searchParams.get('clientId');
  const status = url.searchParams.get('status');
  const limit = parseInt(url.searchParams.get('limit')) || 50;
  const offset = parseInt(url.searchParams.get('offset')) || 0;
  
  try {
    // Buscar do banco D1
    const query = `
      SELECT * FROM document_uploads 
      WHERE user_id = ? 
      ${clientId ? 'AND client_id = ?' : ''}
      ${status ? 'AND status = ?' : ''}
      ORDER BY timestamp DESC 
      LIMIT ? OFFSET ?
    `;
    
    const params = [token.userId];
    if (clientId) params.push(clientId);
    if (status) params.push(status);
    params.push(limit, offset);
    
    const results = await env.DB.prepare(query).bind(...params).all();
    
    return new Response(JSON.stringify({
      success: true,
      data: results.results,
      total: results.results.length,
      limit: limit,
      offset: offset
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
    
  } catch (error) {
    console.error('Error fetching documents:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch documents',
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

// Log de upload no banco D1
async function logUpload(env, data) {
  try {
    await env.DB.prepare(`
      INSERT INTO document_uploads (
        client_id, document_type, file_name, file_size, 
        protocol_id, user_id, timestamp, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      data.clientId,
      data.documentType,
      data.fileName,
      data.size,
      data.protocolId,
      data.userId,
      data.timestamp,
      'uploaded'
    ).run();
  } catch (error) {
    console.error('Error logging upload:', error);
  }
}