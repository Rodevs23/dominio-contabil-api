#!/bin/bash

# Script para testar a API após deploy

API_URL="${1:-https://dominio-contabil-api.your-subdomain.workers.dev}"

echo "🧪 TESTANDO API DOMÍNIO CONTÁBIL"
echo "=============================="
echo "🔗 URL: $API_URL"
echo ""

# Teste 1: Health Check
echo "1. 🏥 Testando Health Check..."
response=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health")
if [ "$response" = "200" ]; then
    echo "   ✅ Health Check: OK"
else
    echo "   ❌ Health Check: FALHOU ($response)"
fi

# Teste 2: Documentação
echo "2. 📚 Testando Documentação..."
response=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/docs")
if [ "$response" = "200" ]; then
    echo "   ✅ Documentação: OK"
else
    echo "   ❌ Documentação: FALHOU ($response)"
fi

# Teste 3: CORS
echo "3. 🌐 Testando CORS..."
response=$(curl -s -X OPTIONS -H "Origin: https://example.com" -I "$API_URL/health" | grep -i "access-control-allow-origin")
if [ ! -z "$response" ]; then
    echo "   ✅ CORS: OK"
else
    echo "   ❌ CORS: FALHOU"
fi

# Teste 4: Autenticação (deve retornar 401)
echo "4. 🔐 Testando Autenticação..."
response=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/clients")
if [ "$response" = "401" ]; then
    echo "   ✅ Autenticação: OK (401 esperado)"
else
    echo "   ❌ Autenticação: Resposta inesperada ($response)"
fi

# Teste 5: OAuth Login
echo "5. 🔑 Testando OAuth Login..."
response=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/auth/login")
if [ "$response" = "302" ]; then
    echo "   ✅ OAuth Login: OK (redirect 302)"
else
    echo "   ❌ OAuth Login: FALHOU ($response)"
fi

# Teste 6: Endpoint não existente
echo "6. 🚫 Testando endpoint inexistente..."
response=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/inexistente")
if [ "$response" = "404" ]; then
    echo "   ✅ 404: OK (404 esperado)"
else
    echo "   ❌ 404: Resposta inesperada ($response)"
fi

echo ""
echo "🎯 RESUMO DOS TESTES"
echo "=================="
echo "✅ = Passou   ❌ = Falhou"
echo ""
echo "💡 Para testar com autenticação:"
echo "   1. Configure as credenciais OAuth"
echo "   2. Obtenha um access token"
echo "   3. Use: curl -H 'Authorization: Bearer TOKEN' $API_URL/api/clients"
echo ""
echo "📖 Documentação completa: $API_URL/docs"