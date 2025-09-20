import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import { 
  FileUploadInfo, 
  FileValidationResult, 
  SubscriptionTier 
} from '../types';
import { FileUploadError, ValidationError } from '../utils/imageGenerationErrors';
import { ImageProcessingService } from '../services/imageProcessingService';

/**
 * File handling utilities for image upload, validation, and processing
 * Provides secure file handling with subscription-based limitations
 */
export class FileHandler {
  private static readonly UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
  private static readonly TEMP_DIR = path.join(FileHandler.UPLOAD_DIR, 'temp');
  private static readonly PROCESSED_DIR = path.join(FileHandler.UPLOAD_DIR, 'processed');
  
  private static readonly MAX_FILE_SIZES: Record<SubscriptionTier, number> = {
    free: 2 * 1024 * 1024, // 2MB
    plus: 10 * 1024 * 1024, // 10MB
    pro: 50 * 1024 * 1024 // 50MB
  };

  private static readonly ALLOWED_MIMETYPES: Record<SubscriptionTier, string[]> = {
    free: [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/webp'
    ],
    plus: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/bmp'
    ],
    pro: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/bmp',
      'image/tiff',
      'image/avif',
      'image/heif'
    ]
  };

  private static readonly MAX_FILES_PER_REQUEST: Record<SubscriptionTier, number> = {
    free: 1,
    plus: 4,
    pro: 10
  };

  private static imageProcessingService = new ImageProcessingService();

  /**
   * Initialize upload directories
   */
  static async initializeDirectories(): Promise<void> {
    const directories = [
      FileHandler.UPLOAD_DIR,
      FileHandler.TEMP_DIR,
      FileHandler.PROCESSED_DIR
    ];

    for (const dir of directories) {
      try {
        await fs.access(dir);
      } catch {
        await fs.mkdir(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
      }
    }
  }

  /**
   * Create multer configuration for file uploads
   */
  static createMulterConfig(subscriptionTier: SubscriptionTier): multer.Multer {
    const storage = multer.memoryStorage();
    
    const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
      const allowedTypes = FileHandler.ALLOWED_MIMETYPES[subscriptionTier];
      
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new FileUploadError(
          `File type ${file.mimetype} not allowed for ${subscriptionTier} tier`,
          file.originalname,
          undefined,
          allowedTypes,
          'INVALID_FILE_TYPE'
        ));
      }
    };

    return multer({
      storage,
      fileFilter,
      limits: {
        fileSize: FileHandler.MAX_FILE_SIZES[subscriptionTier],
        files: FileHandler.MAX_FILES_PER_REQUEST[subscriptionTier],
        fields: 10,
        fieldNameSize: 100,
        fieldSize: 1024
      }
    });
  }

  /**
   * Validate uploaded files
   */
  static async validateUploadedFiles(
    files: Express.Multer.File[],
    subscriptionTier: SubscriptionTier
  ): Promise<FileValidationResult[]> {
    const results: FileValidationResult[] = [];
    
    for (const file of files) {
      try {
        const result = await FileHandler.imageProcessingService.validateImage(
          file.buffer,
          file.originalname,
          subscriptionTier
        );
        
        results.push(result);
        
        // Log validation results
        if (!result.valid) {
          console.warn(`File validation failed for ${file.originalname}:`, result.errors);
        } else if (result.warnings.length > 0) {
          console.warn(`File validation warnings for ${file.originalname}:`, result.warnings);
        }
        
      } catch (error) {
        console.error(`Failed to validate file ${file.originalname}:`, error);
        results.push({
          valid: false,
          errors: [error instanceof Error ? error.message : 'Validation failed'],
          warnings: []
        });
      }
    }
    
    return results;
  }

  /**
   * Save file to temporary storage
   */
  static async saveToTemp(
    buffer: Buffer,
    originalName: string,
    mimetype: string
  ): Promise<{
    tempPath: string;
    filename: string;
    cleanupFn: () => Promise<void>;
  }> {
    await FileHandler.initializeDirectories();
    
    const filename = `${uuidv4()}_${Date.now()}_${path.basename(originalName)}`;
    const tempPath = path.join(FileHandler.TEMP_DIR, filename);
    
    try {
      await fs.writeFile(tempPath, buffer);
      
      const cleanupFn = async () => {
        try {
          await fs.unlink(tempPath);
        } catch (error) {
          console.warn(`Failed to cleanup temp file ${tempPath}:`, error);
        }
      };
      
      // Auto-cleanup after 1 hour
      setTimeout(cleanupFn, 60 * 60 * 1000);
      
      return { tempPath, filename, cleanupFn };
      
    } catch (error) {
      throw new FileUploadError(
        `Failed to save file to temp storage: ${error instanceof Error ? error.message : 'Unknown error'}`,
        originalName,
        buffer.length,
        undefined,
        'TEMP_SAVE_FAILED'
      );
    }
  }

  /**
   * Move file from temp to processed storage
   */
  static async moveToProcessed(
    tempPath: string,
    newFilename?: string
  ): Promise<string> {
    await FileHandler.initializeDirectories();
    
    const filename = newFilename || path.basename(tempPath);
    const processedPath = path.join(FileHandler.PROCESSED_DIR, filename);
    
    try {
      await fs.rename(tempPath, processedPath);
      return processedPath;
    } catch (error) {
      throw new FileUploadError(
        `Failed to move file to processed storage: ${error instanceof Error ? error.message : 'Unknown error'}`,
        path.basename(tempPath),
        undefined,
        undefined,
        'MOVE_TO_PROCESSED_FAILED'
      );
    }
  }

  /**
   * Clean up old temporary files
   */
  static async cleanupTempFiles(maxAgeHours: number = 24): Promise<{
    cleaned: number;
    failed: number;
    errors: string[];
  }> {
    const result = {
      cleaned: 0,
      failed: 0,
      errors: [] as string[]
    };

    try {
      await FileHandler.initializeDirectories();
      const files = await fs.readdir(FileHandler.TEMP_DIR);
      const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
      
      for (const filename of files) {
        try {
          const filePath = path.join(FileHandler.TEMP_DIR, filename);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime.getTime() < cutoffTime) {
            await fs.unlink(filePath);
            result.cleaned++;
          }
        } catch (error) {
          result.failed++;
          result.errors.push(
            `Failed to cleanup ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }
      
    } catch (error) {
      result.errors.push(
        `Failed to access temp directory: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    return result;
  }

  /**
   * Get file information
   */
  static async getFileInfo(filePath: string): Promise<{
    exists: boolean;
    size?: number;
    mtime?: Date;
    type?: 'file' | 'directory';
    mimetype?: string;
  }> {
    try {
      const stats = await fs.stat(filePath);
      const mimetype = FileHandler.getMimetypeFromExtension(path.extname(filePath));
      
      return {
        exists: true,
        size: stats.size,
        mtime: stats.mtime,
        type: stats.isDirectory() ? 'directory' : 'file',
        mimetype
      };
    } catch {
      return { exists: false };
    }
  }

  /**
   * Generate secure filename
   */
  static generateSecureFilename(originalName: string, prefix?: string): string {
    const sanitized = originalName
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_')
      .toLowerCase();
    
    const uuid = uuidv4().split('-')[0]; // First part of UUID
    const timestamp = Date.now();
    const extension = path.extname(sanitized);
    const basename = path.basename(sanitized, extension);
    
    const parts = [prefix, basename, uuid, timestamp].filter(Boolean);
    return `${parts.join('_')}${extension}`;
  }

  /**
   * Validate file signature/magic bytes
   */
  static validateFileSignature(buffer: Buffer, expectedMimetype: string): boolean {
    const signatures: Record<string, number[][]> = {
      'image/jpeg': [
        [0xFF, 0xD8, 0xFF],
      ],
      'image/png': [
        [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
      ],
      'image/gif': [
        [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
        [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
      ],
      'image/webp': [
        [0x52, 0x49, 0x46, 0x46], // RIFF header (check WEBP at offset 8)
      ],
      'image/bmp': [
        [0x42, 0x4D], // BM
      ],
      'image/tiff': [
        [0x49, 0x49, 0x2A, 0x00], // Little-endian
        [0x4D, 0x4D, 0x00, 0x2A], // Big-endian
      ]
    };

    const sigs = signatures[expectedMimetype.toLowerCase()];
    if (!sigs) return true; // Unknown type, skip validation

    return sigs.some(signature => {
      if (buffer.length < signature.length) return false;
      
      for (let i = 0; i < signature.length; i++) {
        if (buffer[i] !== signature[i]) return false;
      }
      
      // Special case for WebP: check for 'WEBP' at offset 8
      if (expectedMimetype === 'image/webp') {
        const webpSig = [0x57, 0x45, 0x42, 0x50]; // 'WEBP'
        if (buffer.length < 12) return false;
        
        for (let i = 0; i < webpSig.length; i++) {
          if (buffer[8 + i] !== webpSig[i]) return false;
        }
      }
      
      return true;
    });
  }

  /**
   * Get mimetype from file extension
   */
  private static getMimetypeFromExtension(extension: string): string {
    const mimetypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.tiff': 'image/tiff',
      '.tif': 'image/tiff',
      '.avif': 'image/avif',
      '.heif': 'image/heif'
    };
    
    return mimetypes[extension.toLowerCase()] || 'application/octet-stream';
  }

  /**
   * Get upload capabilities for subscription tier
   */
  static getUploadCapabilities(tier: SubscriptionTier): {
    maxFileSize: number;
    maxFileSizeFormatted: string;
    allowedTypes: string[];
    maxFilesPerRequest: number;
    features: {
      multipleUploads: boolean;
      advancedFormats: boolean;
      largeFiles: boolean;
    };
  } {
    const capabilities = {
      free: {
        maxFileSize: FileHandler.MAX_FILE_SIZES.free,
        maxFileSizeFormatted: '2MB',
        allowedTypes: FileHandler.ALLOWED_MIMETYPES.free,
        maxFilesPerRequest: FileHandler.MAX_FILES_PER_REQUEST.free,
        features: {
          multipleUploads: false,
          advancedFormats: false,
          largeFiles: false
        }
      },
      plus: {
        maxFileSize: FileHandler.MAX_FILE_SIZES.plus,
        maxFileSizeFormatted: '10MB',
        allowedTypes: FileHandler.ALLOWED_MIMETYPES.plus,
        maxFilesPerRequest: FileHandler.MAX_FILES_PER_REQUEST.plus,
        features: {
          multipleUploads: true,
          advancedFormats: true,
          largeFiles: false
        }
      },
      pro: {
        maxFileSize: FileHandler.MAX_FILE_SIZES.pro,
        maxFileSizeFormatted: '50MB',
        allowedTypes: FileHandler.ALLOWED_MIMETYPES.pro,
        maxFilesPerRequest: FileHandler.MAX_FILES_PER_REQUEST.pro,
        features: {
          multipleUploads: true,
          advancedFormats: true,
          largeFiles: true
        }
      }
    };

    return capabilities[tier];
  }

  /**
   * Create middleware for handling file uploads
   */
  static createUploadMiddleware(subscriptionTier: SubscriptionTier, fieldName: string = 'image') {
    const upload = FileHandler.createMulterConfig(subscriptionTier);
    
    return {
      single: upload.single(fieldName),
      multiple: upload.array(fieldName, FileHandler.MAX_FILES_PER_REQUEST[subscriptionTier]),
      fields: upload.fields([
        { name: 'images', maxCount: FileHandler.MAX_FILES_PER_REQUEST[subscriptionTier] },
        { name: 'referenceImage', maxCount: 1 }
      ])
    };
  }

  /**
   * Health check for file handling system
   */
  static async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      directoriesAccessible: boolean;
      tempDirWritable: boolean;
      diskSpace?: {
        available: number;
        used: number;
        total: number;
      };
      tempFileCount: number;
    };
  }> {
    try {
      await FileHandler.initializeDirectories();
      
      // Test directory access
      const tempFiles = await fs.readdir(FileHandler.TEMP_DIR);
      const processedFiles = await fs.readdir(FileHandler.PROCESSED_DIR);
      
      // Test write capability
      const testFile = path.join(FileHandler.TEMP_DIR, `health_check_${Date.now()}.txt`);
      await fs.writeFile(testFile, 'health check');
      await fs.unlink(testFile);
      
      return {
        status: 'healthy',
        details: {
          directoriesAccessible: true,
          tempDirWritable: true,
          tempFileCount: tempFiles.length
        }
      };
      
    } catch (error) {
      console.error('File handler health check failed:', error);
      
      return {
        status: 'unhealthy',
        details: {
          directoriesAccessible: false,
          tempDirWritable: false,
          tempFileCount: 0
        }
      };
    }
  }
}

export default FileHandler;