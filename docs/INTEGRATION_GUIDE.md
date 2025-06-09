# 📋 Guia de Integração - Domínio Contábil API

## 🎯 Visão Geral

Este guia demonstra como integrar com a API do Sistema Domínio de Contabilidade da Thomson Reuters, baseado na análise do fluxo de integração real.

## 🔧 Configuração Inicial

### 1. Configuração no ERP Cliente

```javascript
// Configurações por empresa
const configuracao = {
  integracaoAtiva: true,
  tokenContador: "sua_chave_token_aqui", // Fornecida pelo contador
  enviarNotasEntrada: false, // Recomendado false inicialmente
  tiposDocumento: ['NFe', 'NFCe', 'CTe', 'NFSe']
};
```

### 2. Obter Chave de Acesso

```javascript
// Primeira execução - obter chave de acesso
const response = await fetch('/api/auth/obter-chave', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    tokenIntegracao: configuracao.tokenContador
  })
});

const { chaveAcesso } = await response.json();
console.log('✅ Token obtido com sucesso');
```

## 📤 Fluxo de Envio de Documentos

### 1. Emissão Automática

```javascript
// Após autorização da nota fiscal
async function enviarDocumentoAutomatico(documentoFiscal) {
  try {
    // Verificar se integração está ativa
    if (!configuracao.integracaoAtiva) return;
    
    // Enviar para API Domínio
    const resultado = await fetch('/api/documents/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${chaveAcesso}`,
        'Content-Type': 'multipart/form-data'
      },
      body: criarFormData(documentoFiscal)
    });
    
    if (resultado.ok) {
      const { protocolId } = await resultado.json();
      // Salvar protocolo para consulta posterior
      salvarProtocolo(documentoFiscal.id, protocolId);
      console.log('📤 Documento enviado automaticamente');
    }
    
  } catch (error) {
    console.error('❌ Erro no envio automático:', error);
    // Marcar para reenvio manual
    marcarParaReenvio(documentoFiscal.id);
  }
}
```

### 2. Envio Manual em Lote

```javascript
// Interface para reenvio manual
async function enviarLoteManual(filtros) {
  // 1. Filtrar documentos na tela
  const documentos = await filtrarDocumentos({
    dataInicio: filtros.dataInicio,
    dataFim: filtros.dataFim,
    situacao: 'nao_enviadas',
    tipo: 'NFe' // NFe, NFCe, CTe, etc.
  });
  
  // 2. Marcar documentos selecionados
  const selecionados = documentos.filter(doc => doc.marcado);
  
  // 3. Enviar em lote
  const resultado = await fetch('/api/documents/batch', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${chaveAcesso}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      documents: selecionados.map(doc => ({
        clientId: doc.cnpjEmitente,
        fileName: `${doc.tipo}_${doc.numero}.xml`,
        content: doc.xmlContent
      }))
    })
  });
  
  const { protocolId, processed, errors } = await resultado.json();
  console.log(`📦 Lote enviado: ${processed} processados, ${errors} erros`);
  
  return { protocolId, processed, errors };
}
```

## 📥 Consulta de Status

### 1. Buscar Retorno dos Documentos

```javascript
// Consultar status dos documentos enviados
async function buscarRetornoDocumentos(filtros) {
  // 1. Filtrar documentos enviados
  const documentosEnviados = await filtrarDocumentos({
    ...filtros,
    situacao: 'enviadas'
  });
  
  // 2. Consultar status de cada protocolo
  const resultados = [];
  
  for (const doc of documentosEnviados) {
    try {
      const response = await fetch(`/api/status/${doc.protocolId}`, {
        headers: {
          'Authorization': `Bearer ${chaveAcesso}`
        }
      });
      
      const status = await response.json();
      resultados.push({
        documento: doc,
        status: status.status,
        mensagem: status.message || status.errors?.[0]
      });
      
    } catch (error) {
      resultados.push({
        documento: doc,
        status: 'erro_consulta',
        mensagem: error.message
      });
    }
  }
  
  return processarResultados(resultados);
}

// Processar resultados da consulta
function processarResultados(resultados) {
  const processadosComSucesso = resultados.filter(r => 
    r.status === 'completed' || r.mensagem?.includes('SA2')
  );
  
  const processadosComErro = resultados.filter(r => 
    r.status === 'failed' || r.mensagem?.includes('erro')
  );
  
  console.log(`✅ Processados com sucesso: ${processadosComSucesso.length}`);
  console.log(`❌ Processados com erro: ${processadosComErro.length}`);
  
  return {
    sucesso: processadosComSucesso,
    erro: processadosComErro,
    total: resultados.length
  };
}
```

## 🔄 Estados dos Documentos

### Estados Possíveis

```javascript
const ESTADOS_DOCUMENTO = {
  // Estados de envio
  'nao_enviadas': 'Aguardando envio',
  'enviadas': 'Enviado para API',
  
  // Estados de processamento
  'processando': 'Processando na API',
  'processado_sucesso': 'Arquivado na API (SA2)',
  'processado_erro': 'Erro no processamento',
  
  // Estados de erro
  'empresa_nao_encontrada': 'CNPJ não vinculado à chave',
  'xml_invalido': 'XML com formato inválido',
  'conexao_erro': 'Erro de conexão'
};
```

### Fluxo de Estados

```
Emissão → Autorizada → Enviada → Processando → [Sucesso|Erro]
                   ↓
              (automático)
                   ↓
            nao_enviadas → enviadas → processado_sucesso
                   ↓              ↓
              (manual)        processado_erro
```

## 📊 Interface de Usuário

### 1. Tela de Eventos da API

```javascript
// Componente para mostrar eventos da API
function TelaEventosAPI({ documentosFiltrados }) {
  const [eventos, setEventos] = useState([]);
  const [selecionados, setSelecionados] = useState([]);
  
  // Carregar eventos baseado na filtragem da tela anterior
  useEffect(() => {
    carregarEventos(documentosFiltrados);
  }, [documentosFiltrados]);
  
  const handleEnviar = async () => {
    if (selecionados.length === 0) return;
    
    const resultado = await enviarLoteManual({
      documentos: selecionados
    });
    
    // Atualizar lista após envio
    await carregarEventos(documentosFiltrados);
  };
  
  const handleBuscarRetorno = async () => {
    const resultado = await buscarRetornoDocumentos({
      situacao: 'enviadas'
    });
    
    // Mostrar resultado
    mostrarResultado(resultado);
  };
  
  return (
    <div className="eventos-api">
      <h2>Eventos da API</h2>
      
      {/* Filtros herdados da tela anterior */}
      <div className="filtros-info">
        Filtragem: {documentosFiltrados.descricao}
      </div>
      
      {/* Lista de documentos */}
      <table>
        <thead>
          <tr>
            <th>Seleção</th>
            <th>Data Emissão/Entrada</th>
            <th>Número</th>
            <th>Série</th>
            <th>Tipo</th>
            <th>Situação</th>
            <th>Última Resposta API</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>
          {eventos.map(evento => (
            <EventoRow 
              key={evento.id}
              evento={evento}
              onSelect={handleSelectEvento}
            />
          ))}
        </tbody>
      </table>
      
      {/* Ações */}
      <div className="acoes">
        <button 
          onClick={handleEnviar}
          disabled={selecionados.length === 0}
        >
          Enviar Selecionados
        </button>
        
        <button onClick={handleBuscarRetorno}>
          Buscar Retorno
        </button>
        
        <button onClick={handleImprimirRelatorio}>
          Imprimir Relatório
        </button>
      </div>
    </div>
  );
}
```

## ⚠️ Considerações Importantes

### 1. Notas de Entrada

```javascript
// ATENÇÃO: Notas de entrada requerem tratamento especial
const configNotasEntrada = {
  // Inicialmente deixar desabilitado
  enviarAutomaticamente: false,
  
  // Motivo: XML original tem:
  problemas: [
    'Tributação de saída do fornecedor',
    'Data de emissão (não data de entrada)', 
    'Falta informações do bloco 0570/0190 do SPED'
  ],
  
  // Solução: Tratamento antes do envio
  tratamentoNecessario: [
    'Converter tributação para entrada',
    'Ajustar data de entrada',
    'Regenerar XML com dados corretos'
  ]
};
```

### 2. Ambientes

```javascript
const AMBIENTES = {
  homologacao: {
    baseURL: 'https://api-homolog.onvio.com.br',
    observacao: 'Para testes - pode dar erro de empresa não encontrada'
  },
  producao: {
    baseURL: 'https://api.onvio.com.br',
    observacao: 'Ambiente real com dados de produção'
  }
};
```

### 3. Boas Práticas

```javascript
const BOAS_PRATICAS = {
  // Frequência de consulta
  consultarStatus: 'Periodicamente (semanal/mensal)',
  
  // Reenvio
  reenvioDocs: 'Apenas documentos com erro de conexão',
  
  // Monitoramento
  logs: 'Manter histórico de envios e erros',
  
  // Validação
  validarAntes: 'Verificar CNPJ vinculado à chave'
};
```

## 🚀 Exemplo Completo de Integração

```javascript
class IntegracaoDominioAPI {
  constructor(config) {
    this.config = config;
    this.chaveAcesso = null;
  }
  
  async inicializar() {
    // Obter chave de acesso
    this.chaveAcesso = await this.obterChaveAcesso();
    console.log('✅ Integração inicializada');
  }
  
  async processarDocumento(documento) {
    try {
      // Envio automático após autorização
      if (documento.situacao === 'autorizada') {
        await this.enviarAutomatico(documento);
      }
    } catch (error) {
      // Log e marcar para reenvio manual
      console.error('Erro no envio automático:', error);
      await this.marcarParaReenvio(documento);
    }
  }
  
  async gerenciarEventos(filtros) {
    // Interface para gestão manual
    const eventos = await this.carregarEventos(filtros);
    return {
      enviar: (selecionados) => this.enviarLote(selecionados),
      buscarRetorno: () => this.consultarStatus(filtros),
      imprimir: () => this.gerarRelatorio(eventos)
    };
  }
}

// Uso
const integracao = new IntegracaoDominioAPI({
  tokenContador: 'sua_chave_aqui',
  enviarNotasEntrada: false
});

await integracao.inicializar();
```

## 📞 Suporte

- **Email:** api.dominio@tr.com  
- **Documentação:** [Thomson Reuters Developer Portal](https://developerportal.thomsonreuters.com/onvio-br-accounting-api)
- **Status da API:** Verificar em `/health`

---

*Este guia foi baseado na análise do fluxo real de integração demonstrado no vídeo de treinamento.*