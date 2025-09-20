/**
 * Base64 encoding/decoding utilities for image data handling
 * Provides efficient base64 operations with validation and optimization
 */

export class Base64Utils {
  private static readonly DATA_URL_REGEX = /^data:([a-zA-Z0-9][a-zA-Z0-9\/+]*);base64,(.+)$/;
  private static readonly BASE64_REGEX = /^[A-Za-z0-9+/]*={0,2}$/;
  
  private static readonly SUPPORTED_MIMETYPES = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/webp',
    'image/gif',
    'image/bmp',
    'image/tiff',
    'image/avif',
    'image/heif'
  ];

  private static readonly MAX_BASE64_SIZE = 50 * 1024 * 1024; // 50MB limit

  /**
   * Convert buffer to base64 string
   */
  static bufferToBase64(buffer: Buffer): string {
    if (!Buffer.isBuffer(buffer)) {
      throw new Error('Input must be a Buffer');
    }
    
    if (buffer.length === 0) {
      throw new Error('Buffer cannot be empty');
    }
    
    return buffer.toString('base64');
  }

  /**
   * Convert base64 string to buffer
   */
  static base64ToBuffer(base64String: string): Buffer {
    if (typeof base64String !== 'string') {
      throw new Error('Input must be a string');
    }
    
    const cleanBase64 = this.cleanBase64String(base64String);
    
    if (!this.isValidBase64(cleanBase64)) {
      throw new Error('Invalid base64 string format');
    }
    
    try {
      const buffer = Buffer.from(cleanBase64, 'base64');
      
      if (buffer.length === 0) {
        throw new Error('Decoded buffer is empty');
      }
      
      return buffer;
    } catch (error) {
      throw new Error(`Failed to decode base64: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert buffer to data URL with mimetype
   */
  static bufferToDataUrl(buffer: Buffer, mimetype: string): string {
    if (!Buffer.isBuffer(buffer)) {
      throw new Error('Input must be a Buffer');
    }
    
    if (!mimetype) {
      throw new Error('Mimetype is required');
    }
    
    if (!this.SUPPORTED_MIMETYPES.includes(mimetype)) {
      throw new Error(`Unsupported mimetype: ${mimetype}`);
    }
    
    const base64 = this.bufferToBase64(buffer);
    return `data:${mimetype};base64,${base64}`;
  }

  /**
   * Parse data URL and extract buffer and mimetype
   */
  static parseDataUrl(dataUrl: string): {
    buffer: Buffer;
    mimetype: string;
    size: number;
  } {
    if (typeof dataUrl !== 'string') {
      throw new Error('Input must be a string');
    }
    
    const match = dataUrl.match(this.DATA_URL_REGEX);
    if (!match) {
      throw new Error('Invalid data URL format. Expected format: data:mimetype;base64,data');
    }
    
    const [, mimetype, base64Data] = match;
    
    if (!this.SUPPORTED_MIMETYPES.includes(mimetype)) {
      throw new Error(`Unsupported mimetype in data URL: ${mimetype}`);
    }
    
    // Check base64 size before decoding
    const estimatedSize = this.estimateDecodedSize(base64Data);
    if (estimatedSize > this.MAX_BASE64_SIZE) {
      throw new Error(`Data URL too large. Estimated size: ${this.formatBytes(estimatedSize)}, Max allowed: ${this.formatBytes(this.MAX_BASE64_SIZE)}`);
    }
    
    const buffer = this.base64ToBuffer(base64Data);
    
    return {
      buffer,
      mimetype,
      size: buffer.length
    };
  }

  /**
   * Validate if string is a valid data URL
   */
  static isValidDataUrl(dataUrl: string): boolean {
    if (typeof dataUrl !== 'string') {
      return false;
    }
    
    const match = dataUrl.match(this.DATA_URL_REGEX);
    if (!match) {
      return false;
    }
    
    const [, mimetype, base64Data] = match;
    
    return (
      this.SUPPORTED_MIMETYPES.includes(mimetype) &&
      this.isValidBase64(base64Data)
    );
  }

  /**
   * Validate if string is valid base64
   */
  static isValidBase64(base64String: string): boolean {
    if (typeof base64String !== 'string') {
      return false;
    }
    
    if (base64String.length === 0) {
      return false;
    }
    
    // Check if length is multiple of 4 (base64 requirement)
    if (base64String.length % 4 !== 0) {
      return false;
    }
    
    // Check character set
    return this.BASE64_REGEX.test(base64String);
  }

  /**
   * Clean base64 string (remove whitespace, newlines, etc.)
   */
  static cleanBase64String(base64String: string): string {
    return base64String
      .replace(/\s/g, '') // Remove all whitespace
      .replace(/\n/g, '') // Remove newlines
      .replace(/\r/g, ''); // Remove carriage returns
  }

  /**
   * Compress base64 string by reducing image quality
   * Note: This requires the image to be processed through Sharp
   */
  static async compressBase64Image(
    dataUrl: string, 
    quality: number = 85,
    format: 'jpeg' | 'webp' | 'png' = 'webp'
  ): Promise<string> {
    const sharp = (await import('sharp')).default;
    
    const { buffer, mimetype } = this.parseDataUrl(dataUrl);
    
    let pipeline = sharp(buffer);
    
    // Apply compression based on format
    switch (format) {
      case 'jpeg':
        pipeline = pipeline.jpeg({ quality, progressive: true });
        break;
      case 'webp':
        pipeline = pipeline.webp({ quality, effort: 4 });
        break;
      case 'png':
        pipeline = pipeline.png({ compressionLevel: 9 });
        break;
    }
    
    const compressedBuffer = await pipeline.toBuffer();
    const outputMimetype = `image/${format}`;
    
    return this.bufferToDataUrl(compressedBuffer, outputMimetype);
  }

  /**
   * Resize base64 image to fit within maximum dimensions
   */
  static async resizeBase64Image(
    dataUrl: string,
    maxWidth: number,
    maxHeight: number,
    maintainAspectRatio: boolean = true
  ): Promise<string> {
    const sharp = (await import('sharp')).default;
    
    const { buffer, mimetype } = this.parseDataUrl(dataUrl);
    
    const resizeOptions: any = {
      width: maxWidth,
      height: maxHeight,
      fit: maintainAspectRatio ? 'inside' : 'fill',
      withoutEnlargement: true
    };
    
    const resizedBuffer = await sharp(buffer)
      .resize(resizeOptions)
      .toBuffer();
    
    return this.bufferToDataUrl(resizedBuffer, mimetype);
  }

  /**
   * Convert image format while maintaining base64 encoding
   */
  static async convertBase64Format(
    dataUrl: string,
    targetFormat: 'jpeg' | 'png' | 'webp' | 'avif',
    quality?: number
  ): Promise<string> {
    const sharp = (await import('sharp')).default;
    
    const { buffer } = this.parseDataUrl(dataUrl);
    
    let pipeline = sharp(buffer);
    
    switch (targetFormat) {
      case 'jpeg':
        pipeline = pipeline.jpeg({ quality: quality || 90 });
        break;
      case 'png':
        pipeline = pipeline.png({ compressionLevel: 9 });
        break;
      case 'webp':
        pipeline = pipeline.webp({ quality: quality || 90 });
        break;
      case 'avif':
        pipeline = pipeline.avif({ quality: quality || 80 });
        break;
    }
    
    const convertedBuffer = await pipeline.toBuffer();
    return this.bufferToDataUrl(convertedBuffer, `image/${targetFormat}`);
  }

  /**
   * Get information about base64 encoded image
   */
  static getBase64ImageInfo(dataUrl: string): {
    mimetype: string;
    format: string;
    estimatedSize: number;
    base64Length: number;
    isValid: boolean;
  } {
    try {
      if (!this.isValidDataUrl(dataUrl)) {
        return {
          mimetype: 'unknown',
          format: 'unknown',
          estimatedSize: 0,
          base64Length: 0,
          isValid: false
        };
      }

      const match = dataUrl.match(this.DATA_URL_REGEX);
      if (!match) {
        return {
          mimetype: 'unknown',
          format: 'unknown',
          estimatedSize: 0,
          base64Length: 0,
          isValid: false
        };
      }

      const [, mimetype, base64Data] = match;
      const format = mimetype.split('/')[1] || 'unknown';
      const estimatedSize = this.estimateDecodedSize(base64Data);

      return {
        mimetype,
        format,
        estimatedSize,
        base64Length: base64Data.length,
        isValid: true
      };
    } catch (error) {
      return {
        mimetype: 'unknown',
        format: 'unknown',
        estimatedSize: 0,
        base64Length: 0,
        isValid: false
      };
    }
  }

  /**
   * Batch process multiple base64 images
   */
  static async batchProcessBase64Images(
    dataUrls: string[],
    options: {
      compress?: boolean;
      quality?: number;
      format?: 'jpeg' | 'webp' | 'png';
      resize?: { maxWidth: number; maxHeight: number };
    } = {}
  ): Promise<Array<{
    original: string;
    processed: string;
    savings: number;
    error?: string;
  }>> {
    const results = [];

    for (const dataUrl of dataUrls) {
      try {
        let processed = dataUrl;

        // Resize if requested
        if (options.resize) {
          processed = await this.resizeBase64Image(
            processed,
            options.resize.maxWidth,
            options.resize.maxHeight
          );
        }

        // Compress if requested
        if (options.compress) {
          processed = await this.compressBase64Image(
            processed,
            options.quality || 85,
            options.format || 'webp'
          );
        }

        const originalSize = this.estimateDecodedSize(dataUrl.split(',')[1] || '');
        const processedSize = this.estimateDecodedSize(processed.split(',')[1] || '');
        const savings = Math.max(0, originalSize - processedSize);

        results.push({
          original: dataUrl,
          processed,
          savings
        });

      } catch (error) {
        results.push({
          original: dataUrl,
          processed: dataUrl, // Return original on error
          savings: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  /**
   * Estimate decoded size from base64 string
   */
  private static estimateDecodedSize(base64String: string): number {
    const cleanBase64 = this.cleanBase64String(base64String);
    
    // Each base64 character represents 6 bits
    // 4 base64 characters = 3 bytes
    let estimatedBytes = (cleanBase64.length * 3) / 4;
    
    // Account for padding
    const paddingChars = (cleanBase64.match(/=/g) || []).length;
    estimatedBytes -= paddingChars;
    
    return Math.floor(estimatedBytes);
  }

  /**
   * Format bytes to human readable string
   */
  private static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Validate multiple data URLs
   */
  static validateDataUrls(dataUrls: string[]): {
    valid: string[];
    invalid: Array<{ dataUrl: string; error: string; index: number }>;
  } {
    const valid: string[] = [];
    const invalid: Array<{ dataUrl: string; error: string; index: number }> = [];

    dataUrls.forEach((dataUrl, index) => {
      try {
        if (this.isValidDataUrl(dataUrl)) {
          const info = this.getBase64ImageInfo(dataUrl);
          if (info.estimatedSize > this.MAX_BASE64_SIZE) {
            invalid.push({
              dataUrl,
              error: `Image too large: ${this.formatBytes(info.estimatedSize)}`,
              index
            });
          } else {
            valid.push(dataUrl);
          }
        } else {
          invalid.push({
            dataUrl,
            error: 'Invalid data URL format',
            index
          });
        }
      } catch (error) {
        invalid.push({
          dataUrl,
          error: error instanceof Error ? error.message : 'Unknown validation error',
          index
        });
      }
    });

    return { valid, invalid };
  }

  /**
   * Create thumbnail from base64 image
   */
  static async createBase64Thumbnail(
    dataUrl: string,
    size: number = 150
  ): Promise<string> {
    const sharp = (await import('sharp')).default;
    
    const { buffer } = this.parseDataUrl(dataUrl);
    
    const thumbnailBuffer = await sharp(buffer)
      .resize(size, size, {
        fit: 'cover',
        position: 'centre'
      })
      .jpeg({ quality: 80 })
      .toBuffer();
    
    return this.bufferToDataUrl(thumbnailBuffer, 'image/jpeg');
  }

  /**
   * Health check for base64 utilities
   */
  static healthCheck(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      canEncode: boolean;
      canDecode: boolean;
      canParseDataUrl: boolean;
      canValidate: boolean;
    };
  } {
    try {
      // Test encoding
      const testBuffer = Buffer.from('test data');
      const base64 = this.bufferToBase64(testBuffer);
      
      // Test decoding
      const decodedBuffer = this.base64ToBuffer(base64);
      const canDecode = decodedBuffer.toString() === 'test data';
      
      // Test data URL
      const dataUrl = this.bufferToDataUrl(Buffer.from('test'), 'image/jpeg');
      const canParseDataUrl = this.isValidDataUrl(dataUrl);
      
      // Test validation
      const canValidate = this.isValidBase64(base64);
      
      const allWorking = canDecode && canParseDataUrl && canValidate;
      
      return {
        status: allWorking ? 'healthy' : 'degraded',
        details: {
          canEncode: true,
          canDecode,
          canParseDataUrl,
          canValidate
        }
      };
      
    } catch (error) {
      console.error('Base64Utils health check failed:', error);
      
      return {
        status: 'unhealthy',
        details: {
          canEncode: false,
          canDecode: false,
          canParseDataUrl: false,
          canValidate: false
        }
      };
    }
  }
}

export default Base64Utils;