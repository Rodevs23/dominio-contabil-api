/**
 * Configuração Jest para testes
 */

export default {
  // Ambiente de teste
  testEnvironment: 'node',
  
  // Suporte a ES modules
  preset: 'es-modules',
  extensionsToTreatAsEsm: ['.js'],
  
  // Transformações
  transform: {
    '^.+\\.js$': ['babel-jest', { presets: [['@babel/preset-env', { targets: { node: 'current' } }]] }]
  },
  
  // Padrões de arquivos de teste
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.js',
    '**/*.(test|spec).js'
  ],
  
  // Cobertura de código
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  
  // Arquivos para incluir na cobertura
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/__tests__/**'
  ],
  
  // Threshold mínimo de cobertura
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // Mocks
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  
  // Timeout para testes
  testTimeout: 10000,
  
  // Limpar mocks entre testes
  clearMocks: true,
  
  // Verbose output
  verbose: true
};