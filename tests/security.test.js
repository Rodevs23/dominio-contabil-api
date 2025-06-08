/**
 * Testes para Security Utilities
 */

import { validateCNPJ, sanitizeInput, corsHeaders } from '../src/utils/security.js';

describe('Security Utils', () => {
  
  describe('validateCNPJ', () => {
    test('deve validar CNPJ válido', () => {
      expect(validateCNPJ('11.222.333/0001-81')).toBe(true);
      expect(validateCNPJ('11222333000181')).toBe(true);
    });
    
    test('deve rejeitar CNPJ inválido', () => {
      expect(validateCNPJ('11.222.333/0001-82')).toBe(false);
      expect(validateCNPJ('11111111111111')).toBe(false);
      expect(validateCNPJ('123456789')).toBe(false);
      expect(validateCNPJ('')).toBe(false);
      expect(validateCNPJ(null)).toBe(false);
    });
  });
  
  describe('sanitizeInput', () => {
    test('deve remover caracteres perigosos', () => {
      const malicious = '<script>alert("xss")</script>';
      const result = sanitizeInput(malicious);
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
      expect(result).not.toContain('"');
    });
    
    test('deve limitar tamanho da string', () => {
      const longString = 'a'.repeat(2000);
      const result = sanitizeInput(longString);
      expect(result.length).toBeLessThanOrEqual(1000);
    });
    
    test('deve retornar tipos não-string inalterados', () => {
      expect(sanitizeInput(123)).toBe(123);
      expect(sanitizeInput(null)).toBe(null);
      expect(sanitizeInput(undefined)).toBe(undefined);
    });
  });
  
  describe('corsHeaders', () => {
    test('deve conter headers CORS necessários', () => {
      expect(corsHeaders).toHaveProperty('Access-Control-Allow-Origin');
      expect(corsHeaders).toHaveProperty('Access-Control-Allow-Methods');
      expect(corsHeaders).toHaveProperty('Access-Control-Allow-Headers');
      expect(corsHeaders['Access-Control-Allow-Methods']).toContain('POST');
    });
  });
});