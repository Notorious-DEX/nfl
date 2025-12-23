/**
 * NFLv2 - Data Manager
 * Handles atomic file operations to prevent data corruption
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

class DataManager {
  constructor() {
    this.locks = new Map();
  }

  /**
   * Resolve path relative to project root
   */
  resolvePath(relativePath) {
    return path.resolve(PROJECT_ROOT, relativePath);
  }

  /**
   * Ensure directory exists
   */
  async ensureDir(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Read JSON file
   */
  async readJSON(filePath) {
    const fullPath = this.resolvePath(filePath);

    try {
      const data = await fs.readFile(fullPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.warn('File not found', { filePath });
        return null;
      }
      logger.error('Failed to read JSON file', { filePath, error: error.message });
      throw error;
    }
  }

  /**
   * Write JSON file atomically (write to temp, then rename)
   */
  async writeJSON(filePath, data, pretty = true) {
    const fullPath = this.resolvePath(filePath);
    const tempPath = `${fullPath}.tmp`;
    const dir = path.dirname(fullPath);

    try {
      // Ensure directory exists
      await this.ensureDir(dir);

      // Write to temporary file
      const jsonString = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
      await fs.writeFile(tempPath, jsonString, 'utf-8');

      // Atomic rename (replaces existing file)
      await fs.rename(tempPath, fullPath);

      logger.debug('Successfully wrote JSON file', { filePath, size: jsonString.length });
      return true;
    } catch (error) {
      logger.error('Failed to write JSON file', { filePath, error: error.message });

      // Clean up temp file if it exists
      try {
        await fs.unlink(tempPath);
      } catch (unlinkError) {
        // Ignore unlink errors
      }

      throw error;
    }
  }

  /**
   * Update JSON file with a transformation function
   * Reads existing data, applies transform, writes atomically
   */
  async updateJSON(filePath, transformFn, defaultValue = {}) {
    const existing = await this.readJSON(filePath) || defaultValue;
    const updated = await transformFn(existing);
    await this.writeJSON(filePath, updated);
    return updated;
  }

  /**
   * Backup a file before modifying it
   */
  async backupFile(filePath) {
    const fullPath = this.resolvePath(filePath);
    const backupPath = `${fullPath}.backup`;

    try {
      await fs.copyFile(fullPath, backupPath);
      logger.debug('Created backup', { filePath, backupPath });
      return backupPath;
    } catch (error) {
      if (error.code === 'ENOENT') {
        // No file to backup
        return null;
      }
      logger.error('Failed to create backup', { filePath, error: error.message });
      throw error;
    }
  }

  /**
   * Restore from backup
   */
  async restoreBackup(filePath) {
    const fullPath = this.resolvePath(filePath);
    const backupPath = `${fullPath}.backup`;

    try {
      await fs.copyFile(backupPath, fullPath);
      logger.info('Restored from backup', { filePath });
      return true;
    } catch (error) {
      logger.error('Failed to restore backup', { filePath, error: error.message });
      return false;
    }
  }

  /**
   * Check if file exists
   */
  async exists(filePath) {
    const fullPath = this.resolvePath(filePath);

    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file modification time
   */
  async getModTime(filePath) {
    const fullPath = this.resolvePath(filePath);

    try {
      const stats = await fs.stat(fullPath);
      return stats.mtime;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Check if file is stale (older than maxAge in milliseconds)
   */
  async isStale(filePath, maxAge) {
    const modTime = await this.getModTime(filePath);
    if (!modTime) return true;

    const age = Date.now() - modTime.getTime();
    return age > maxAge;
  }

  /**
   * Safe transaction: backup, modify, commit (or rollback on error)
   */
  async transaction(filePath, modifyFn) {
    let backupPath = null;

    try {
      // Create backup if file exists
      backupPath = await this.backupFile(filePath);

      // Read existing data
      const existing = await this.readJSON(filePath) || {};

      // Apply modification
      const modified = await modifyFn(existing);

      // Write atomically
      await this.writeJSON(filePath, modified);

      // Success - remove backup
      if (backupPath) {
        await fs.unlink(backupPath);
      }

      return modified;
    } catch (error) {
      logger.error('Transaction failed, attempting rollback', { filePath, error: error.message });

      // Attempt to restore backup
      if (backupPath) {
        await this.restoreBackup(filePath);
      }

      throw error;
    }
  }

  /**
   * List all files in directory matching pattern
   */
  async listFiles(dirPath, pattern = null) {
    const fullPath = this.resolvePath(dirPath);

    try {
      const files = await fs.readdir(fullPath);

      if (pattern) {
        const regex = new RegExp(pattern);
        return files.filter(f => regex.test(f));
      }

      return files;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Get file size in bytes
   */
  async getFileSize(filePath) {
    const fullPath = this.resolvePath(filePath);

    try {
      const stats = await fs.stat(fullPath);
      return stats.size;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return 0;
      }
      throw error;
    }
  }

  /**
   * Delete old backup files
   */
  async cleanupBackups(dirPath) {
    const backupFiles = await this.listFiles(dirPath, '\\.backup$');

    for (const file of backupFiles) {
      const filePath = path.join(dirPath, file);
      const fullPath = this.resolvePath(filePath);

      try {
        await fs.unlink(fullPath);
        logger.debug('Deleted old backup', { filePath });
      } catch (error) {
        logger.warn('Failed to delete backup', { filePath, error: error.message });
      }
    }

    return backupFiles.length;
  }
}

// Singleton instance
export const dataManager = new DataManager();
export default dataManager;
