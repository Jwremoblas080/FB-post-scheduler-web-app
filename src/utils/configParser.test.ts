import { ConfigParser } from './configParser';
import { Configuration } from '../types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('ConfigParser', () => {
  let parser: ConfigParser;
  let tempDir: string;

  beforeEach(() => {
    parser = new ConfigParser();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-test-'));
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('parse()', () => {
    it('should parse valid configuration from JSON string', () => {
      const configJson = JSON.stringify({
        databasePath: './data/db.sqlite',
        uploadDirectory: './uploads',
        facebookAppId: 'test-app-id',
        facebookAppSecret: 'test-app-secret'
      });

      const result = parser.parse(configJson);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.databasePath).toBe('./data/db.sqlite');
        expect(result.value.uploadDirectory).toBe('./uploads');
        expect(result.value.facebookAppId).toBe('test-app-id');
        expect(result.value.facebookAppSecret).toBe('test-app-secret');
      }
    });

    it('should parse valid configuration from file', () => {
      const configPath = path.join(tempDir, 'config.json');
      const config = {
        databasePath: './data/db.sqlite',
        uploadDirectory: './uploads',
        facebookAppId: 'test-app-id',
        facebookAppSecret: 'test-app-secret'
      };
      fs.writeFileSync(configPath, JSON.stringify(config));

      const result = parser.parse(configPath);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.databasePath).toBe('./data/db.sqlite');
      }
    });

    it('should parse configuration with optional fields', () => {
      const configJson = JSON.stringify({
        databasePath: './data/db.sqlite',
        uploadDirectory: './uploads',
        facebookAppId: 'test-app-id',
        facebookAppSecret: 'test-app-secret',
        schedulerInterval: 60,
        maxFileSize: 104857600
      });

      const result = parser.parse(configJson);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.schedulerInterval).toBe(60);
        expect(result.value.maxFileSize).toBe(104857600);
      }
    });

    it('should return error for malformed JSON', () => {
      const invalidJson = '{ invalid json }';

      const result = parser.parse(invalidJson);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Invalid JSON syntax');
      }
    });

    it('should return error for non-existent file', () => {
      const nonExistentPath = path.join(tempDir, 'nonexistent.json');

      const result = parser.parse(nonExistentPath);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Configuration file not found');
      }
    });

    it('should return error for missing required field', () => {
      const configJson = JSON.stringify({
        databasePath: './data/db.sqlite',
        uploadDirectory: './uploads',
        facebookAppId: 'test-app-id'
        // Missing facebookAppSecret
      });

      const result = parser.parse(configJson);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Missing required configuration fields');
        expect(result.error.message).toContain('facebookAppSecret');
      }
    });
  });

  describe('validate()', () => {
    it('should validate configuration with all required fields', () => {
      const config = {
        databasePath: './data/db.sqlite',
        uploadDirectory: './uploads',
        facebookAppId: 'test-app-id',
        facebookAppSecret: 'test-app-secret'
      };

      const result = parser.validate(config);

      expect(result.success).toBe(true);
    });

    it('should reject configuration missing databasePath', () => {
      const config = {
        uploadDirectory: './uploads',
        facebookAppId: 'test-app-id',
        facebookAppSecret: 'test-app-secret'
      };

      const result = parser.validate(config);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('databasePath');
      }
    });

    it('should reject configuration with empty required field', () => {
      const config = {
        databasePath: '',
        uploadDirectory: './uploads',
        facebookAppId: 'test-app-id',
        facebookAppSecret: 'test-app-secret'
      };

      const result = parser.validate(config);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('databasePath');
      }
    });

    it('should reject configuration with null required field', () => {
      const config = {
        databasePath: './data/db.sqlite',
        uploadDirectory: null,
        facebookAppId: 'test-app-id',
        facebookAppSecret: 'test-app-secret'
      };

      const result = parser.validate(config);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('uploadDirectory');
      }
    });

    it('should reject configuration with invalid type for schedulerInterval', () => {
      const config = {
        databasePath: './data/db.sqlite',
        uploadDirectory: './uploads',
        facebookAppId: 'test-app-id',
        facebookAppSecret: 'test-app-secret',
        schedulerInterval: 'not-a-number'
      };

      const result = parser.validate(config);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('schedulerInterval must be a number');
      }
    });

    it('should accept configuration with valid optional fields', () => {
      const config = {
        databasePath: './data/db.sqlite',
        uploadDirectory: './uploads',
        facebookAppId: 'test-app-id',
        facebookAppSecret: 'test-app-secret',
        schedulerInterval: 60,
        maxFileSize: 104857600
      };

      const result = parser.validate(config);

      expect(result.success).toBe(true);
    });
  });

  describe('prettyPrint()', () => {
    it('should format configuration as pretty-printed JSON', () => {
      const config: Configuration = {
        databasePath: './data/db.sqlite',
        uploadDirectory: './uploads',
        facebookAppId: 'test-app-id',
        facebookAppSecret: 'test-app-secret'
      };

      const result = parser.prettyPrint(config);

      expect(result).toContain('"databasePath": "./data/db.sqlite"');
      expect(result).toContain('"uploadDirectory": "./uploads"');
      expect(result).toContain('"facebookAppId": "test-app-id"');
      expect(result).toContain('"facebookAppSecret": "test-app-secret"');
      // Check for indentation (pretty printing)
      expect(result).toMatch(/\n\s+"/);
    });

    it('should format configuration with optional fields', () => {
      const config: Configuration = {
        databasePath: './data/db.sqlite',
        uploadDirectory: './uploads',
        facebookAppId: 'test-app-id',
        facebookAppSecret: 'test-app-secret',
        schedulerInterval: 60,
        maxFileSize: 104857600
      };

      const result = parser.prettyPrint(config);

      expect(result).toContain('"schedulerInterval": 60');
      expect(result).toContain('"maxFileSize": 104857600');
    });

    it('should produce valid JSON that can be parsed back', () => {
      const config: Configuration = {
        databasePath: './data/db.sqlite',
        uploadDirectory: './uploads',
        facebookAppId: 'test-app-id',
        facebookAppSecret: 'test-app-secret',
        schedulerInterval: 60
      };

      const printed = parser.prettyPrint(config);
      const parsed = JSON.parse(printed);

      expect(parsed).toEqual(config);
    });
  });

  describe('round-trip', () => {
    it('should preserve configuration through parse -> prettyPrint -> parse', () => {
      const original: Configuration = {
        databasePath: './data/db.sqlite',
        uploadDirectory: './uploads',
        facebookAppId: 'test-app-id',
        facebookAppSecret: 'test-app-secret',
        schedulerInterval: 60,
        maxFileSize: 104857600
      };

      const printed = parser.prettyPrint(original);
      const parseResult = parser.parse(printed);

      expect(parseResult.success).toBe(true);
      if (parseResult.success) {
        expect(parseResult.value).toEqual(original);
      }
    });
  });
});
