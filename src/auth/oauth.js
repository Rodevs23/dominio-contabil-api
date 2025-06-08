/**
 * OAuth 2.0 Authentication Handler
 * Thomson Reuters Onvio Authentication
 */

import { corsHeaders } from '../utils/security.js';

export async function handleAuth(request, env, path) {
  const url = new URL(request.url);
  
  switch (path) {
    case '/auth/login':
      return handleLogin(request, env);
    
    case '/auth/callback':
      return handleCallback(request, env);
    
    case '/auth/refresh':
      return handleRefresh(request, env);
    
    default:
      return new Response('Auth endpoint not found', { 
        status: 404,
        headers: corsHeaders
      });
  }
}

// Inicia o fluxo OAuth
async function handleLogin(request, env) {
  const clientId = env.THOMSON_CLIENT_ID;
  const redirectUri = `${new URL(request.url).origin}/auth/callback`;
  
  const authUrl = new URL(`${env.THOMSON_AUTH_URL}/authorize`);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('audience', env.THOMSON_AUDIENCE);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', 'openid profile email offline_access');
  
  // Gerar state para segurança
  const state = crypto.randomUUID();
  authUrl.searchParams.set('state', state);
  
  // Armazenar state no KV por 10 minutos
  await env.CACHE.put(`oauth_state_${state}`, 'valid', { expirationTtl: 600 });
  
  return Response.redirect(authUrl.toString(), 302);
}

// Callback do OAuth
async function handleCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  
  if (error) {
    return new Response(JSON.stringify({
      error: 'OAuth Error',
      description: url.searchParams.get('error_description') || error
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
  
  if (!code || !state) {
    return new Response(JSON.stringify({
      error: 'Missing Parameters',
      message: 'Code ou state ausente'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
  
  // Verificar state
  const storedState = await env.CACHE.get(`oauth_state_${state}`);
  if (!storedState) {
    return new Response(JSON.stringify({
      error: 'Invalid State',
      message: 'State inválido ou expirado'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
  
  // Trocar code por access token
  try {
    const tokenResponse = await fetch(`${env.THOMSON_AUTH_URL}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: env.THOMSON_CLIENT_ID,
        client_secret: env.THOMSON_CLIENT_SECRET,
        code: code,
        redirect_uri: `${url.origin}/auth/callback`
      })
    });
    
    if (!tokenResponse.ok) {
      throw new Error(`Token exchange failed: ${tokenResponse.status}`);
    }
    
    const tokens = await tokenResponse.json();
    
    // Armazenar tokens no KV
    const tokenKey = crypto.randomUUID();
    await env.CACHE.put(`access_token_${tokenKey}`, JSON.stringify({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + (tokens.expires_in * 1000),
      tokenType: tokens.token_type || 'Bearer'
    }), {
      expirationTtl: tokens.expires_in || 3600
    });
    
    // Remover state usado
    await env.CACHE.delete(`oauth_state_${state}`);
    
    return new Response(JSON.stringify({
      success: true,
      tokenKey: tokenKey,
      expiresIn: tokens.expires_in,
      message: 'Autenticação realizada com sucesso'
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
    
  } catch (error) {
    console.error('Token exchange error:', error);
    
    return new Response(JSON.stringify({
      error: 'Token Exchange Failed',
      message: 'Falha na troca do código por token'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

// Refresh token
async function handleRefresh(request, env) {
  const { refreshToken } = await request.json();
  
  if (!refreshToken) {
    return new Response(JSON.stringify({
      error: 'Missing Refresh Token'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
  
  try {
    const tokenResponse = await fetch(`${env.THOMSON_AUTH_URL}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: env.THOMSON_CLIENT_ID,
        client_secret: env.THOMSON_CLIENT_SECRET,
        refresh_token: refreshToken
      })
    });
    
    if (!tokenResponse.ok) {
      throw new Error(`Refresh failed: ${tokenResponse.status}`);
    }
    
    const tokens = await tokenResponse.json();
    
    return new Response(JSON.stringify({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || refreshToken,
      expiresIn: tokens.expires_in
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Refresh Failed',
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