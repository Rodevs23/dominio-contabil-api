/**
 * Document Validator
 * Validação e identificação de documentos fiscais
 */

// Validar XML
export function validateXML(xmlContent) {
  try {
    // Verificar se é um XML válido
    if (!xmlContent || typeof xmlContent !== 'string') {
      return {
        valid: false,
        error: 'Conteúdo XML inválido ou vazio'
      };
    }
    
    // Verificar se começa com declaração XML ou elemento raiz
    const trimmedContent = xmlContent.trim();
    if (!trimmedContent.startsWith('<?xml') && !trimmedContent.startsWith('<')) {
      return {
        valid: false,
        error: 'Arquivo não é um XML válido'
      };
    }
    
    // Verificar se tem elementos básicos de documento fiscal
    const documentPatterns = [
      /<nfeProc/,           // NFe processada
      /<NFe/,               // NFe
      /<infNFe/,            // Informações NFe
      /<cteProc/,           // CTe processada  
      /<CTe/,               // CTe
      /<infCte/,            // Informações CTe
      /<CFe/,               // CFe
      /<infCFe/,            // Informações CFe
      /<RPS/,               // RPS
      /<CompNfse/,          // NFSe
      /<ListaNfse/          // Lista NFSe
    ];
    
    const hasValidPattern = documentPatterns.some(pattern => pattern.test(xmlContent));
    
    if (!hasValidPattern) {
      return {
        valid: false,
        error: 'XML não contém estrutura de documento fiscal reconhecida'
      };
    }
    
    // Validar estrutura básica do XML
    const openTags = (xmlContent.match(/<[^/][^>]*>/g) || []).length;
    const closeTags = (xmlContent.match(/<\/[^>]*>/g) || []).length;
    const selfClosingTags = (xmlContent.match(/<[^/][^>]*\/>/g) || []).length;
    
    // Número de tags de abertura deve ser igual ao de fechamento + self-closing
    if (openTags !== closeTags + selfClosingTags) {
      return {
        valid: false,
        error: 'XML com estrutura de tags desbalanceada'
      };
    }
    
    return {
      valid: true,
      documentType: getDocumentType(xmlContent)
    };
    
  } catch (error) {
    return {
      valid: false,
      error: `Erro ao validar XML: ${error.message}`
    };
  }
}

// Identificar tipo de documento
export function getDocumentType(xmlContent) {
  const typePatterns = {
    'NFe': [/<nfeProc/, /<NFe/, /<infNFe/],
    'NFCe': [/<nfceProc/, /<NFCe/, /<infNFe[^>]*mod="65"/],
    'CTe': [/<cteProc/, /<CTe/, /<infCte/],
    'CFe': [/<CFe/, /<infCFe/],
    'NFSe': [/<CompNfse/, /<ListaNfse/, /<RPS/],
    'MDFe': [/<mdfeProc/, /<MDFe/, /<infMDFe/]
  };
  
  for (const [type, patterns] of Object.entries(typePatterns)) {
    if (patterns.some(pattern => pattern.test(xmlContent))) {
      return type;
    }
  }
  
  return 'UNKNOWN';
}

// Extrair informações básicas do documento
export function extractDocumentInfo(xmlContent) {
  const docType = getDocumentType(xmlContent);
  const info = {
    type: docType,
    number: null,
    series: null,
    key: null,
    issueDate: null,
    value: null,
    issuer: {
      cnpj: null,
      name: null
    },
    recipient: {
      cnpj: null,
      name: null
    }
  };
  
  try {
    switch (docType) {
      case 'NFe':
      case 'NFCe':
        extractNFeInfo(xmlContent, info);
        break;
        
      case 'CTe':
        extractCTeInfo(xmlContent, info);
        break;
        
      case 'CFe':
        extractCFeInfo(xmlContent, info);
        break;
        
      case 'NFSe':
        extractNFSeInfo(xmlContent, info);
        break;
    }
  } catch (error) {
    console.error('Error extracting document info:', error);
  }
  
  return info;
}

// Extrair informações de NFe/NFCe
function extractNFeInfo(xmlContent, info) {
  // Número da nota
  const nNFMatch = xmlContent.match(/<nNF>(\d+)<\/nNF>/);
  if (nNFMatch) info.number = nNFMatch[1];
  
  // Série
  const serieMatch = xmlContent.match(/<serie>(\d+)<\/serie>/);
  if (serieMatch) info.series = serieMatch[1];
  
  // Chave de acesso
  const chaveMatch = xmlContent.match(/<chNFe>([\d]{44})<\/chNFe>/);
  if (chaveMatch) info.key = chaveMatch[1];
  
  // Data de emissão
  const dateMatch = xmlContent.match(/<dhEmi>([^<]+)<\/dhEmi>/);
  if (dateMatch) info.issueDate = dateMatch[1];
  
  // Valor total
  const valueMatch = xmlContent.match(/<vNF>([\d,\.]+)<\/vNF>/);
  if (valueMatch) info.value = parseFloat(valueMatch[1].replace(',', '.'));
  
  // CNPJ do emitente
  const emitCNPJMatch = xmlContent.match(/<emit[^>]*>[\s\S]*?<CNPJ>([\d]{14})<\/CNPJ>/);
  if (emitCNPJMatch) info.issuer.cnpj = emitCNPJMatch[1];
  
  // Nome do emitente
  const emitNameMatch = xmlContent.match(/<emit[^>]*>[\s\S]*?<xNome>([^<]+)<\/xNome>/);
  if (emitNameMatch) info.issuer.name = emitNameMatch[1];
  
  // CNPJ do destinatário
  const destCNPJMatch = xmlContent.match(/<dest[^>]*>[\s\S]*?<CNPJ>([\d]{14})<\/CNPJ>/);
  if (destCNPJMatch) info.recipient.cnpj = destCNPJMatch[1];
  
  // Nome do destinatário
  const destNameMatch = xmlContent.match(/<dest[^>]*>[\s\S]*?<xNome>([^<]+)<\/xNome>/);
  if (destNameMatch) info.recipient.name = destNameMatch[1];
}

// Extrair informações de CTe
function extractCTeInfo(xmlContent, info) {
  // Número do CTe
  const nCTMatch = xmlContent.match(/<nCT>(\d+)<\/nCT>/);
  if (nCTMatch) info.number = nCTMatch[1];
  
  // Série
  const serieMatch = xmlContent.match(/<serie>(\d+)<\/serie>/);
  if (serieMatch) info.series = serieMatch[1];
  
  // Chave de acesso
  const chaveMatch = xmlContent.match(/<chCTe>([\d]{44})<\/chCTe>/);
  if (chaveMatch) info.key = chaveMatch[1];
  
  // Data de emissão
  const dateMatch = xmlContent.match(/<dhEmi>([^<]+)<\/dhEmi>/);
  if (dateMatch) info.issueDate = dateMatch[1];
  
  // Valor total
  const valueMatch = xmlContent.match(/<vTPrest>([\d,\.]+)<\/vTPrest>/);
  if (valueMatch) info.value = parseFloat(valueMatch[1].replace(',', '.'));
}

// Extrair informações de CFe
function extractCFeInfo(xmlContent, info) {
  // Número do CFe
  const nCFeMatch = xmlContent.match(/<nCFe>(\d+)<\/nCFe>/);
  if (nCFeMatch) info.number = nCFeMatch[1];
  
  // Chave de acesso
  const chaveMatch = xmlContent.match(/<chCanc>([\d]{44})<\/chCanc>/);
  if (chaveMatch) info.key = chaveMatch[1];
  
  // Data de emissão
  const dateMatch = xmlContent.match(/<dEmi>(\d{8})<\/dEmi>/);
  if (dateMatch) {
    const date = dateMatch[1];
    info.issueDate = `${date.substr(0,4)}-${date.substr(4,2)}-${date.substr(6,2)}`;
  }
  
  // Valor total
  const valueMatch = xmlContent.match(/<vCFe>([\d]+)<\/vCFe>/);
  if (valueMatch) info.value = parseInt(valueMatch[1]) / 100; // CFe em centavos
}

// Extrair informações de NFSe
function extractNFSeInfo(xmlContent, info) {
  // Número da NFSe
  const nNFSeMatch = xmlContent.match(/<Numero>(\d+)<\/Numero>/);
  if (nNFSeMatch) info.number = nNFSeMatch[1];
  
  // Data de emissão
  const dateMatch = xmlContent.match(/<DataEmissao>([^<]+)<\/DataEmissao>/);
  if (dateMatch) info.issueDate = dateMatch[1];
  
  // Valor total
  const valueMatch = xmlContent.match(/<ValorServicos>([\d,\.]+)<\/ValorServicos>/);
  if (valueMatch) info.value = parseFloat(valueMatch[1].replace(',', '.'));
}

// Validar tamanho do arquivo
export function validateFileSize(content, maxSizeMB = 50) {
  const sizeInBytes = new Blob([content]).size;
  const sizeInMB = sizeInBytes / (1024 * 1024);
  
  if (sizeInMB > maxSizeMB) {
    return {
      valid: false,
      error: `Arquivo muito grande. Máximo ${maxSizeMB}MB, recebido ${sizeInMB.toFixed(2)}MB`
    };
  }
  
  return { valid: true };
}

// Validar encoding do arquivo
export function validateEncoding(content) {
  try {
    // Verificar se contém caracteres válidos XML
    const hasValidChars = /^[\x09\x0A\x0D\x20-\uD7FF\uE000-\uFFFD\u10000-\u10FFFF]*$/.test(content);
    
    if (!hasValidChars) {
      return {
        valid: false,
        error: 'Arquivo contém caracteres inválidos para XML'
      };
    }
    
    return { valid: true };
    
  } catch (error) {
    return {
      valid: false,
      error: `Erro na validação de encoding: ${error.message}`
    };
  }
}