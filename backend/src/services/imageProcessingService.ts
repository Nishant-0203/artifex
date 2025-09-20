import sharp from 'sharp';
import { 
  ImageProcessingOptions, 
  ProcessedImage, 
  FileValidationResult,
  SubscriptionTier,
  ImageQuality
} from '../types';
import { ImageProcessingError, ValidationError } from '../utils/imageGenerationErrors';

/**
 * Comprehensive image processing service using Sharp
 * Handles image validation, conversion, resizing, compression, and metadata extraction
 */
export class ImageProcessingService {
  private readonly maxFileSizes: Record<SubscriptionTier, number> = {
    free: 2 * 1024 * 1024, // 2MB
    plus: 10 * 1024 * 1024, // 10MB
    pro: 50 * 1024 * 1024 // 50MB
  };

  private readonly supportedFormats: Record<SubscriptionTier, string[]> = {
    free: ['jpeg', 'jpg', 'png', 'webp'],
    plus: ['jpeg', 'jpg', 'png', 'webp', 'gif', 'bmp'],
    pro: ['jpeg', 'jpg', 'png', 'webp', 'gif', 'bmp', 'tiff', 'avif', 'heif']
  };

  private readonly maxDimensions: Record<SubscriptionTier, { width: number; height: number }> = {
    free: { width: 1024, height: 1024 },
    plus: { width: 2048, height: 2048 },
    pro: { width: 4096, height: 4096 }
  };

  /**
   * Validate uploaded image file
   */
  async validateImage(
    buffer: Buffer, 
    originalName: string, 
    subscriptionTier: SubscriptionTier
  ): Promise<FileValidationResult> {
    const result: FileValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      metadata: {}
    };

    try {
      // Get image metadata using Sharp
      const metadata = await sharp(buffer).metadata();
      
      result.metadata = {
        dimensions: { 
          width: metadata.width || 0, 
          height: metadata.height || 0 
        },
        format: metadata.format || 'unknown',
        colorSpace: metadata.space || 'unknown',
        channels: metadata.channels || 0
      };

      // Validate file size
      const maxSize = this.maxFileSizes[subscriptionTier];
      if (buffer.length > maxSize) {
        result.errors.push(
          `File size ${this.formatBytes(buffer.length)} exceeds limit of ${this.formatBytes(maxSize)} for ${subscriptionTier} tier`
        );
        result.valid = false;
      }

      // Validate format
      const supportedFormats = this.supportedFormats[subscriptionTier];
      const format = metadata.format?.toLowerCase();
      if (format && !supportedFormats.includes(format)) {
        result.errors.push(
          `Format '${format}' not supported for ${subscriptionTier} tier. Supported formats: ${supportedFormats.join(', ')}`
        );
        result.valid = false;
      }

      // Validate dimensions
      const maxDim = this.maxDimensions[subscriptionTier];
      if (metadata.width && metadata.height) {
        if (metadata.width > maxDim.width || metadata.height > maxDim.height) {
          result.errors.push(
            `Image dimensions ${metadata.width}x${metadata.height} exceed maximum ${maxDim.width}x${maxDim.height} for ${subscriptionTier} tier`
          );
          result.valid = false;
        }

        // Warning for very small images
        if (metadata.width < 256 || metadata.height < 256) {
          result.warnings.push('Image dimensions are quite small. Consider using larger images for better quality.');
        }

        // Warning for unusual aspect ratios
        const aspectRatio = metadata.width / metadata.height;
        if (aspectRatio > 5 || aspectRatio < 0.2) {
          result.warnings.push('Unusual aspect ratio detected. This may affect generation quality.');
        }
      }

      // Validate color depth
      if (metadata.density && metadata.density < 72) {
        result.warnings.push('Image has low resolution (DPI). This may affect output quality.');
      }

      // Check for transparency
      if (metadata.hasAlpha) {
        result.warnings.push('Image has transparency channel. This will be flattened for processing.');
      }

      return result;

    } catch (error) {
      console.error('Image validation error:', error);
      result.valid = false;
      result.errors.push(
        error instanceof Error ? error.message : 'Failed to validate image'
      );
      return result;
    }
  }

  /**
   * Process image with specified options
   */
  async processImage(
    buffer: Buffer,
    options: ImageProcessingOptions = {}
  ): Promise<ProcessedImage> {
    const startTime = Date.now();
    const originalSize = buffer.length;

    try {
      let pipeline = sharp(buffer);
      
      // Handle rotation and orientation
      pipeline = pipeline.rotate();

      // Resize if requested
      if (options.resize) {
        pipeline = pipeline.resize({
          width: options.resize.width,
          height: options.resize.height,
          fit: options.resize.fit || 'inside',
          withoutEnlargement: true
        });
      }

      // Set quality and format
      const format = options.format || 'webp';
      const quality = options.quality || 85;

      switch (format) {
        case 'jpeg':
          pipeline = pipeline.jpeg({ 
            quality, 
            progressive: true,
            mozjpeg: true 
          });
          break;
        case 'png':
          pipeline = pipeline.png({ 
            compressionLevel: 9,
            adaptiveFiltering: true 
          });
          break;
        case 'webp':
          pipeline = pipeline.webp({ 
            quality,
            effort: 6,
            smartSubsample: true 
          });
          break;
        case 'avif':
          pipeline = pipeline.avif({ 
            quality,
            effort: 4 
          });
          break;
        default:
          pipeline = pipeline.webp({ quality: 85 });
      }

      // Add watermark if specified
      if (options.watermark) {
        const watermarkBuffer = await this.createWatermark(
          options.watermark.text,
          options.watermark.opacity || 0.3
        );
        
        pipeline = pipeline.composite([{
          input: watermarkBuffer,
          gravity: this.getGravityFromPosition(options.watermark.position || 'bottomRight')
        }]);
      }

      // Execute processing
      const processedBuffer = await pipeline.toBuffer({ resolveWithObject: true });
      const processingTime = Date.now() - startTime;

      return {
        buffer: processedBuffer.data,
        format: format,
        width: processedBuffer.info.width,
        height: processedBuffer.info.height,
        size: processedBuffer.data.length,
        metadata: {
          originalSize,
          compressionRatio: originalSize / processedBuffer.data.length,
          processingTime
        }
      };

    } catch (error) {
      console.error('Image processing error:', error);
      throw new ImageProcessingError(
        `Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'PROCESSING_FAILED'
      );
    }
  }

  /**
   * Generate thumbnail for image
   */
  async generateThumbnail(
    buffer: Buffer,
    size: number = 256,
    format: 'jpeg' | 'png' | 'webp' = 'webp'
  ): Promise<Buffer> {
    try {
      let pipeline = sharp(buffer)
        .resize(size, size, {
          fit: 'inside',
          withoutEnlargement: false
        })
        .rotate();

      switch (format) {
        case 'jpeg':
          pipeline = pipeline.jpeg({ quality: 80 });
          break;
        case 'png':
          pipeline = pipeline.png({ compressionLevel: 6 });
          break;
        case 'webp':
          pipeline = pipeline.webp({ quality: 80 });
          break;
      }

      return await pipeline.toBuffer();

    } catch (error) {
      throw new ImageProcessingError(
        `Failed to generate thumbnail: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'THUMBNAIL_GENERATION_FAILED'
      );
    }
  }

  /**
   * Extract dominant colors from image
   */
  async extractColors(buffer: Buffer, count: number = 5): Promise<string[]> {
    try {
      const { data, info } = await sharp(buffer)
        .resize(100, 100, { fit: 'inside' })
        .raw()
        .toBuffer({ resolveWithObject: true });

      const colors = new Map<string, number>();
      const step = 4; // Skip some pixels for performance
      
      for (let i = 0; i < data.length; i += info.channels * step) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Skip very dark or very light colors
        if ((r + g + b) < 30 || (r + g + b) > 720) continue;
        
        const hex = this.rgbToHex(r, g, b);
        colors.set(hex, (colors.get(hex) || 0) + 1);
      }

      // Sort by frequency and return top colors
      return Array.from(colors.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, count)
        .map(([color]) => color);

    } catch (error) {
      console.error('Color extraction error:', error);
      return [];
    }
  }

  /**
   * Optimize image for web delivery
   */
  async optimizeForWeb(
    buffer: Buffer,
    quality: ImageQuality = 'standard'
  ): Promise<{
    webp: Buffer;
    jpeg: Buffer;
    avif?: Buffer;
    metadata: {
      originalSize: number;
      webpSize: number;
      jpegSize: number;
      avifSize?: number;
      compressionStats: Record<string, number>;
    };
  }> {
    const originalSize = buffer.length;
    
    try {
      const qualitySettings = {
        standard: { webp: 85, jpeg: 85, avif: 60 },
        hd: { webp: 90, jpeg: 90, avif: 70 },
        ultra: { webp: 95, jpeg: 95, avif: 80 }
      };

      const settings = qualitySettings[quality];
      
      // Generate WebP
      const webpBuffer = await sharp(buffer)
        .webp({ 
          quality: settings.webp, 
          effort: 6,
          smartSubsample: true 
        })
        .toBuffer();

      // Generate JPEG
      const jpegBuffer = await sharp(buffer)
        .jpeg({ 
          quality: settings.jpeg, 
          progressive: true,
          mozjpeg: true 
        })
        .toBuffer();

      let avifBuffer: Buffer | undefined;
      let avifSize = 0;

      // Generate AVIF for premium users (optional)
      if (quality === 'ultra') {
        try {
          avifBuffer = await sharp(buffer)
            .avif({ 
              quality: settings.avif, 
              effort: 4 
            })
            .toBuffer();
          avifSize = avifBuffer.length;
        } catch (error) {
          console.warn('AVIF generation failed, skipping:', error);
        }
      }

      return {
        webp: webpBuffer,
        jpeg: jpegBuffer,
        avif: avifBuffer,
        metadata: {
          originalSize,
          webpSize: webpBuffer.length,
          jpegSize: jpegBuffer.length,
          avifSize,
          compressionStats: {
            webpCompression: originalSize / webpBuffer.length,
            jpegCompression: originalSize / jpegBuffer.length,
            avifCompression: avifSize > 0 ? originalSize / avifSize : 0
          }
        }
      };

    } catch (error) {
      throw new ImageProcessingError(
        `Failed to optimize image: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'OPTIMIZATION_FAILED'
      );
    }
  }

  /**
   * Convert image to base64 data URL
   */
  async toBase64(buffer: Buffer, format: string = 'webp'): Promise<string> {
    try {
      let processedBuffer: Buffer;
      let mimeType: string;

      switch (format.toLowerCase()) {
        case 'jpeg':
        case 'jpg':
          processedBuffer = await sharp(buffer).jpeg({ quality: 85 }).toBuffer();
          mimeType = 'image/jpeg';
          break;
        case 'png':
          processedBuffer = await sharp(buffer).png().toBuffer();
          mimeType = 'image/png';
          break;
        case 'webp':
          processedBuffer = await sharp(buffer).webp({ quality: 85 }).toBuffer();
          mimeType = 'image/webp';
          break;
        default:
          processedBuffer = buffer;
          mimeType = 'image/jpeg';
      }

      const base64 = processedBuffer.toString('base64');
      return `data:${mimeType};base64,${base64}`;

    } catch (error) {
      throw new ImageProcessingError(
        `Failed to convert to base64: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'BASE64_CONVERSION_FAILED'
      );
    }
  }

  /**
   * Create watermark text overlay
   */
  private async createWatermark(text: string, opacity: number = 0.3): Promise<Buffer> {
    const svg = `
      <svg width="200" height="50">
        <text x="10" y="30" font-family="Arial" font-size="16" 
              fill="white" fill-opacity="${opacity}" stroke="black" 
              stroke-width="0.5" stroke-opacity="${opacity * 0.5}">
          ${text}
        </text>
      </svg>
    `;

    return Buffer.from(svg);
  }

  /**
   * Convert position string to Sharp gravity
   */
  private getGravityFromPosition(position: string): string {
    const gravityMap: Record<string, string> = {
      topLeft: 'northwest',
      topRight: 'northeast',
      bottomLeft: 'southwest',
      bottomRight: 'southeast',
      center: 'center'
    };

    return gravityMap[position] || 'southeast';
  }

  /**
   * Convert RGB values to hex color
   */
  private rgbToHex(r: number, g: number, b: number): string {
    return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`;
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get processing capabilities for subscription tier
   */
  getProcessingCapabilities(tier: SubscriptionTier): {
    maxFileSize: number;
    supportedFormats: string[];
    maxDimensions: { width: number; height: number };
    features: {
      watermarking: boolean;
      advancedOptimization: boolean;
      avifSupport: boolean;
      batchProcessing: boolean;
      colorExtraction: boolean;
    };
  } {
    const capabilities = {
      free: {
        maxFileSize: this.maxFileSizes.free,
        supportedFormats: this.supportedFormats.free,
        maxDimensions: this.maxDimensions.free,
        features: {
          watermarking: false,
          advancedOptimization: false,
          avifSupport: false,
          batchProcessing: false,
          colorExtraction: true
        }
      },
      plus: {
        maxFileSize: this.maxFileSizes.plus,
        supportedFormats: this.supportedFormats.plus,
        maxDimensions: this.maxDimensions.plus,
        features: {
          watermarking: true,
          advancedOptimization: true,
          avifSupport: false,
          batchProcessing: true,
          colorExtraction: true
        }
      },
      pro: {
        maxFileSize: this.maxFileSizes.pro,
        supportedFormats: this.supportedFormats.pro,
        maxDimensions: this.maxDimensions.pro,
        features: {
          watermarking: true,
          advancedOptimization: true,
          avifSupport: true,
          batchProcessing: true,
          colorExtraction: true
        }
      }
    };

    return capabilities[tier];
  }

  /**
   * Health check for image processing service
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      sharpVersion: string;
      supportedFormats: string[];
      memoryUsage: NodeJS.MemoryUsage;
      processingCapable: boolean;
    };
  }> {
    try {
      // Test basic Sharp functionality
      const testBuffer = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      await sharp(testBuffer).resize(10, 10).toBuffer();

      const formats = ['jpeg', 'png', 'webp', 'avif', 'tiff', 'gif'];
      const supportedFormats = [];

      for (const format of formats) {
        try {
          // @ts-ignore
          await sharp(testBuffer)[format]().toBuffer();
          supportedFormats.push(format);
        } catch {
          // Format not supported
        }
      }

      return {
        status: 'healthy',
        details: {
          sharpVersion: sharp.versions?.sharp || 'unknown',
          supportedFormats,
          memoryUsage: process.memoryUsage(),
          processingCapable: true
        }
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          sharpVersion: 'unknown',
          supportedFormats: [],
          memoryUsage: process.memoryUsage(),
          processingCapable: false
        }
      };
    }
  }
}

export default ImageProcessingService;