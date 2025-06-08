/**
 * Setup para testes Jest
 */

// Polyfills para ambiente de teste
import { TextEncoder, TextDecoder } from 'util';
import { ReadableStream, WritableStream, TransformStream } from 'stream/web';

// Globals necessários para Cloudflare Workers
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
global.ReadableStream = ReadableStream;
global.WritableStream = WritableStream;
global.TransformStream = TransformStream;

// Mock do crypto.subtle para testes
global.crypto = {
  subtle: {
    digest: jest.fn().mockResolvedValue(new ArrayBuffer(32))
  },
  randomUUID: jest.fn(() => 'test-uuid-1234-5678-9012-123456789012')
};

// Mock do FormData
global.FormData = class FormData {
  constructor() {
    this.data = new Map();
  }
  
  append(key, value, filename) {
    if (!this.data.has(key)) {
      this.data.set(key, []);
    }
    this.data.get(key).push({ value, filename });
  }
  
  get(key) {
    const values = this.data.get(key);
    return values ? values[0].value : null;
  }
  
  getAll(key) {
    const values = this.data.get(key);
    return values ? values.map(v => v.value) : [];
  }
  
  has(key) {
    return this.data.has(key);
  }
  
  entries() {
    const entries = [];
    for (const [key, values] of this.data) {
      for (const { value } of values) {
        entries.push([key, value]);
      }
    }
    return entries[Symbol.iterator]();
  }
};

// Mock do Blob
global.Blob = class Blob {
  constructor(parts = [], options = {}) {
    this.parts = parts;
    this.type = options.type || '';
    this.size = parts.reduce((size, part) => {
      if (typeof part === 'string') {
        return size + part.length;
      }
      return size + (part.byteLength || part.length || 0);
    }, 0);
  }
  
  async text() {
    return this.parts.join('');
  }
  
  async arrayBuffer() {
    const text = await this.text();
    const encoder = new TextEncoder();
    return encoder.encode(text).buffer;
  }
};

// Mock do Request
global.Request = class Request {
  constructor(url, options = {}) {
    this.url = url;
    this.method = options.method || 'GET';
    this.headers = new Map();
    this.body = options.body;
    
    // Processar headers
    if (options.headers) {
      if (options.headers instanceof Map) {
        this.headers = new Map(options.headers);
      } else if (typeof options.headers === 'object') {
        for (const [key, value] of Object.entries(options.headers)) {
          this.headers.set(key.toLowerCase(), value);
        }
      }
    }
  }
  
  get(header) {
    return this.headers.get(header.toLowerCase());
  }
  
  async json() {
    if (typeof this.body === 'string') {
      return JSON.parse(this.body);
    }
    return this.body;
  }
  
  async formData() {
    return this.body;
  }
  
  async text() {
    if (typeof this.body === 'string') {
      return this.body;
    }
    return JSON.stringify(this.body);
  }
};

// Mock do Response
global.Response = class Response {
  constructor(body, options = {}) {
    this.body = body;
    this.status = options.status || 200;
    this.statusText = options.statusText || 'OK';
    this.headers = new Map();
    this.ok = this.status >= 200 && this.status < 300;
    
    // Processar headers
    if (options.headers) {
      if (options.headers instanceof Map) {
        this.headers = new Map(options.headers);
      } else if (typeof options.headers === 'object') {
        for (const [key, value] of Object.entries(options.headers)) {
          this.headers.set(key.toLowerCase(), value);
        }
      }
    }
  }
  
  async json() {
    if (typeof this.body === 'string') {
      return JSON.parse(this.body);
    }
    return this.body;
  }
  
  async text() {
    if (typeof this.body === 'string') {
      return this.body;
    }
    return JSON.stringify(this.body);
  }
  
  get(header) {
    return this.headers.get(header.toLowerCase());
  }
  
  static redirect(url, status = 302) {
    return new Response(null, {
      status,
      headers: { Location: url }
    });
  }
  
  static json(data, options = {}) {
    return new Response(JSON.stringify(data), {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
  }
};

// Mock console para testes mais limpos
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};

// Cleanup após cada teste
afterEach(() => {
  jest.clearAllMocks();
});