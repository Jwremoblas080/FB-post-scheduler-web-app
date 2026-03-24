import { Configuration } from '../types';
import * as fs from 'fs';

export type Result<T, E> = { success: true; value: T } | { success: false; error: E };

export class ConfigParser {
  /**
   * Parse a configuration file into a Configuration object
   * @param configFile Path to the configuration file or JSON string
   * @returns Result containing Configuration object or Error
   */
  parse(configFile: string): Result<Configuration, Error> {
    try {
      let configContent: string;

      // Check if input is a file path or JSON string
      if (this.isFilePath(configFile)) {
        if (!fs.existsSync(configFile)) {
          return {
            success: false,
            error: new Error(`Configuration file not found: ${configFile}`)
          };
        }
        configContent = fs.readFileSync(configFile, 'utf-8');
      } else {
        configContent = configFile;
      }

      // Parse JSON
      const parsed = JSON.parse(configContent);

      // Validate the parsed configuration
      const validationResult = this.validate(parsed);
      if (!validationResult.success) {
        return validationResult;
      }

      return { success: true, value: parsed as Configuration };
    } catch (error) {
      if (error instanceof SyntaxError) {
        return {
          success: false,
          error: new Error(`Invalid JSON syntax: ${error.message}`)
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Validate that a configuration object has all required fields
   * @param config Configuration object to validate
   * @returns Result indicating success or error with missing fields
   */
  validate(config: any): Result<void, Error> {
    const requiredFields = [
      'databasePath',
      'uploadDirectory',
      'facebookAppId',
      'facebookAppSecret'
    ];

    const missingFields: string[] = [];

    for (const field of requiredFields) {
      if (!(field in config) || config[field] === undefined || config[field] === null || config[field] === '') {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      return {
        success: false,
        error: new Error(`Missing required configuration fields: ${missingFields.join(', ')}`)
      };
    }

    // Validate types
    if (typeof config.databasePath !== 'string') {
      return { success: false, error: new Error('databasePath must be a string') };
    }
    if (typeof config.uploadDirectory !== 'string') {
      return { success: false, error: new Error('uploadDirectory must be a string') };
    }
    if (typeof config.facebookAppId !== 'string') {
      return { success: false, error: new Error('facebookAppId must be a string') };
    }
    if (typeof config.facebookAppSecret !== 'string') {
      return { success: false, error: new Error('facebookAppSecret must be a string') };
    }

    // Validate optional fields if present
    if (config.schedulerInterval !== undefined && typeof config.schedulerInterval !== 'number') {
      return { success: false, error: new Error('schedulerInterval must be a number') };
    }
    if (config.maxFileSize !== undefined && typeof config.maxFileSize !== 'number') {
      return { success: false, error: new Error('maxFileSize must be a number') };
    }

    return { success: true, value: undefined };
  }

  /**
   * Format a Configuration object into a pretty-printed JSON string
   * @param config Configuration object to format
   * @returns Formatted JSON string
   */
  prettyPrint(config: Configuration): string {
    return JSON.stringify(config, null, 2);
  }

  /**
   * Helper method to determine if input is a file path
   */
  private isFilePath(input: string): boolean {
    // Check if it looks like a file path (has extension or path separators)
    // and doesn't start with { (JSON object)
    return !input.trim().startsWith('{') && 
           (input.includes('/') || input.includes('\\') || input.endsWith('.json'));
  }
}

// Export singleton instance
export const configParser = new ConfigParser();
