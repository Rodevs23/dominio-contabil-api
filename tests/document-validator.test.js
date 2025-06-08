/**
 * Testes para Document Validator
 */

import { validateXML, getDocumentType, extractDocumentInfo } from '../src/utils/document-validator.js';

// Mock de NFe válida
const validNFe = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe>
    <infNFe Id="NFe35200214200166000187550010000000046501234567">
      <ide>
        <cUF>35</cUF>
        <cNF>50123456</cNF>
        <natOp>Venda de Mercadoria</natOp>
        <mod>55</mod>
        <serie>1</serie>
        <nNF>46</nNF>
        <dhEmi>2025-06-08T10:00:00-03:00</dhEmi>
        <tpNF>1</tpNF>
      </ide>
      <emit>
        <CNPJ>14200166000187</CNPJ>
        <xNome>Empresa Teste LTDA</xNome>
      </emit>
      <dest>
        <CNPJ>12345678000195</CNPJ>
        <xNome>Cliente Teste</xNome>
      </dest>
      <total>
        <ICMSTot>
          <vNF>1000.00</vNF>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
</nfeProc>`;

// Mock de CTe válido
const validCTe = `<?xml version="1.0" encoding="UTF-8"?>
<cteProc xmlns="http://www.portalfiscal.inf.br/cte">
  <CTe>
    <infCte Id="CTe35200214200166000187570010000000012345678901">
      <ide>
        <cUF>35</cUF>
        <cCT>12345678</cCT>
        <CFOP>5353</CFOP>
        <natOp>Prestacao de servico de transporte</natOp>
        <mod>57</mod>
        <serie>1</serie>
        <nCT>1</nCT>
        <dhEmi>2025-06-08T10:00:00-03:00</dhEmi>
        <tpImp>1</tpImp>
        <tpEmis>1</tpEmis>
        <tpAmb>2</tpAmb>
      </ide>
      <emit>
        <CNPJ>14200166000187</CNPJ>
        <IE>123456789</IE>
        <xNome>Transportadora Teste</xNome>
      </emit>
      <vPrest>
        <vTPrest>150.00</vTPrest>
      </vPrest>
    </infCte>
  </CTe>
</cteProc>`;

// XML inválido
const invalidXML = `<invalid><unclosed>test</invalid>`;

// Não é um documento fiscal
const notFiscalDoc = `<?xml version="1.0"?><root><data>test</data></root>`;

describe('Document Validator', () => {
  
  describe('validateXML', () => {
    test('deve validar NFe corretamente', () => {
      const result = validateXML(validNFe);
      expect(result.valid).toBe(true);
      expect(result.documentType).toBe('NFe');
    });
    
    test('deve validar CTe corretamente', () => {
      const result = validateXML(validCTe);
      expect(result.valid).toBe(true);
      expect(result.documentType).toBe('CTe');
    });
    
    test('deve rejeitar XML inválido', () => {
      const result = validateXML(invalidXML);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('tags desbalanceada');
    });
    
    test('deve rejeitar documento não fiscal', () => {
      const result = validateXML(notFiscalDoc);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('estrutura de documento fiscal');
    });
    
    test('deve rejeitar conteúdo vazio', () => {
      const result = validateXML('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('vazio');
    });
    
    test('deve rejeitar conteúdo null', () => {
      const result = validateXML(null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('inválido');
    });
  });
  
  describe('getDocumentType', () => {
    test('deve identificar NFe', () => {
      expect(getDocumentType(validNFe)).toBe('NFe');
    });
    
    test('deve identificar CTe', () => {
      expect(getDocumentType(validCTe)).toBe('CTe');
    });
    
    test('deve retornar UNKNOWN para tipo não reconhecido', () => {
      expect(getDocumentType('<unknown></unknown>')).toBe('UNKNOWN');
    });
  });
  
  describe('extractDocumentInfo', () => {
    test('deve extrair informações da NFe', () => {
      const info = extractDocumentInfo(validNFe);
      
      expect(info.type).toBe('NFe');
      expect(info.number).toBe('46');
      expect(info.series).toBe('1');
      expect(info.value).toBe(1000.00);
      expect(info.issuer.cnpj).toBe('14200166000187');
      expect(info.issuer.name).toBe('Empresa Teste LTDA');
      expect(info.recipient.cnpj).toBe('12345678000195');
      expect(info.recipient.name).toBe('Cliente Teste');
    });
    
    test('deve extrair informações do CTe', () => {
      const info = extractDocumentInfo(validCTe);
      
      expect(info.type).toBe('CTe');
      expect(info.number).toBe('1');
      expect(info.series).toBe('1');
      expect(info.value).toBe(150.00);
      expect(info.issuer.cnpj).toBe('14200166000187');
      expect(info.issuer.name).toBe('Transportadora Teste');
    });
  });
});