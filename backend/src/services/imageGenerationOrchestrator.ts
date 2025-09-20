import { 
  GenerationContext,
  GenerationResult,
  GeminiGenerationRequest,
  GeminiGenerationResponse,
  ImageGeneration,
  ImageGenerationType,
  ImageGenerationStatus,
  QuotaInfo,
  SubscriptionInfo
} from '../types';
import { GeminiImageService } from './geminiService';
import { ImageProcessingService } from './imageProcessingService';
import { ImageGenerationModel, UserModel } from '../models';
import { Document } from 'mongoose';
import { QuotaUtils } from '../utils/quota';
import { 
  AppError, 
  QuotaExceededError, 
  SubscriptionError,
  ValidationError,
  RetryHandler
} from '../utils/imageGenerationErrors';

/**
 * Image Generation Orchestrator Service
 * Coordinates the complete workflow from request validation to response delivery
 */
export class ImageGenerationOrchestrator {
  private geminiService: GeminiImageService;
  private imageProcessingService: ImageProcessingService;
  
  constructor() {
    this.geminiService = new GeminiImageService();
    this.imageProcessingService = new ImageProcessingService();
  }

  /**
   * Orchestrate text-to-image generation
   */
  async generateTextToImage(context: GenerationContext): Promise<GenerationResult> {
    const startTime = Date.now();
    let generationRecord: any = null;

    try {
      // 1. Validate generation context
      await this.validateGenerationContext(context);

      // 2. Create generation record
      generationRecord = await this.createGenerationRecord(context, 'text-to-image');

      // 3. Validate and consume quota
      const quotaResult = await this.validateAndConsumeQuota(context, generationRecord);
      if (!quotaResult.success) {
        throw new QuotaExceededError(
          quotaResult.message || 'Quota exceeded',
          quotaResult.remaining || 0,
          quotaResult.resetDate || new Date()
        );
      }

      // 4. Generate image with Gemini
      const geminiResponse = await this.executeWithRetry(() =>
        this.geminiService.textToImage(context.request)
      );

      // 5. Process generated images
      const processedImages = await this.processGeneratedImages(
        geminiResponse.images,
        context.subscriptionTier
      );

      // 6. Update generation record with results
      await this.updateGenerationRecord(generationRecord, {
        status: 'completed',
        outputImages: processedImages.map(img => ({
          url: img.url,
          width: img.width,
          height: img.height,
          format: img.format,
          fileSize: img.size,
          storageKey: img.id,
          thumbnailUrl: img.thumbnailUrl
        })),
        processingTimeMs: Date.now() - startTime,
        metadata: {
          ...generationRecord.metadata,
          ...geminiResponse.metadata,
          processedImages: processedImages.length,
          totalProcessingTime: Date.now() - startTime
        }
      });

      // 7. Return success result
      return {
        success: true,
        data: {
          images: processedImages,
          metadata: geminiResponse.metadata,
          usage: geminiResponse.usage,
          generationRecord
        }
      };

    } catch (error) {
      console.error('Text-to-image generation failed:', error);
      
      // Update generation record with error
      if (generationRecord) {
        await this.updateGenerationRecord(generationRecord, {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      return {
        success: false,
        error: {
          code: error instanceof AppError ? error.errorCode : 'GENERATION_FAILED',
          message: error instanceof Error ? error.message : 'Generation failed',
          details: error instanceof AppError ? { statusCode: error.statusCode } : undefined
        }
      };
    }
  }

  /**
   * Orchestrate image-to-image generation
   */
  async generateImageToImage(
    context: GenerationContext,
    inputImage: Buffer,
    inputImageType: string
  ): Promise<GenerationResult> {
    const startTime = Date.now();
    let generationRecord: any = null;

    try {
      // 1. Validate input image
      const validationResult = await this.imageProcessingService.validateImage(
        inputImage,
        'input_image',
        context.subscriptionTier
      );

      if (!validationResult.valid) {
        throw new ValidationError(
          `Input image validation failed: ${validationResult.errors.join(', ')}`,
          'inputImage',
          'invalid',
          validationResult.errors
        );
      }

      // 2. Validate generation context
      await this.validateGenerationContext(context);

      // 3. Create generation record
      generationRecord = await this.createGenerationRecord(context, 'image-to-image');

      // 4. Validate and consume quota
      const quotaResult = await this.validateAndConsumeQuota(context, generationRecord);
      if (!quotaResult.success) {
        throw new QuotaExceededError(
          quotaResult.message || 'Quota exceeded',
          quotaResult.remaining || 0,
          quotaResult.resetDate || new Date()
        );
      }

      // 5. Generate image with Gemini
      const geminiResponse = await this.executeWithRetry(() =>
        this.geminiService.imageToImage({
          ...context.request,
          inputImage,
          inputImageType
        })
      );

      // 6. Process generated images
      const processedImages = await this.processGeneratedImages(
        geminiResponse.images,
        context.subscriptionTier
      );

      // 7. Update generation record
      await this.updateGenerationRecord(generationRecord, {
        status: 'completed',
        inputImages: ['input_image'], // Store reference
        outputImages: processedImages.map(img => ({
          url: img.url,
          width: img.width,
          height: img.height,
          format: img.format,
          fileSize: img.size,
          storageKey: img.id,
          thumbnailUrl: img.thumbnailUrl
        })),
        processingTimeMs: Date.now() - startTime,
        metadata: {
          ...generationRecord.metadata,
          ...geminiResponse.metadata,
          inputImageAnalysis: typeof geminiResponse.metadata.inputImageAnalysis === 'string' 
            ? { analysis: geminiResponse.metadata.inputImageAnalysis }
            : geminiResponse.metadata.inputImageAnalysis,
          processedImages: processedImages.length
        }
      });

      return {
        success: true,
        data: {
          images: processedImages,
          metadata: geminiResponse.metadata,
          usage: geminiResponse.usage,
          generationRecord
        }
      };

    } catch (error) {
      console.error('Image-to-image generation failed:', error);
      
      if (generationRecord) {
        await this.updateGenerationRecord(generationRecord, {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      return {
        success: false,
        error: {
          code: error instanceof AppError ? error.errorCode : 'GENERATION_FAILED',
          message: error instanceof Error ? error.message : 'Generation failed',
          details: error instanceof AppError ? { statusCode: error.statusCode } : undefined
        }
      };
    }
  }

  /**
   * Orchestrate multi-image composition
   */
  async generateMultiImageComposition(
    context: GenerationContext,
    inputImages: Array<{ data: Buffer; type: string; description?: string }>
  ): Promise<GenerationResult> {
    const startTime = Date.now();
    let generationRecord: any = null;

    try {
      // 1. Validate subscription tier allows multi-image
      if (context.subscriptionTier === 'free') {
        throw new SubscriptionError(
          'Multi-image composition requires Plus or Pro subscription',
          'plus',
          context.subscriptionTier
        );
      }

      // 2. Validate all input images
      for (const [index, image] of inputImages.entries()) {
        const validationResult = await this.imageProcessingService.validateImage(
          image.data,
          `input_image_${index}`,
          context.subscriptionTier
        );

        if (!validationResult.valid) {
          throw new ValidationError(
            `Input image ${index + 1} validation failed: ${validationResult.errors.join(', ')}`,
            `inputImage${index}`,
            'invalid',
            validationResult.errors
          );
        }
      }

      // 3. Validate generation context
      await this.validateGenerationContext(context);

      // 4. Create generation record
      generationRecord = await this.createGenerationRecord(context, 'multi-image');

      // 5. Validate and consume quota (higher cost for multi-image)
      const enhancedContext = {
        ...context,
        request: {
          ...context.request,
          batchSize: inputImages.length // Treat as batch for quota calculation
        }
      };

      const quotaResult = await this.validateAndConsumeQuota(enhancedContext, generationRecord);
      if (!quotaResult.success) {
        throw new QuotaExceededError(
          quotaResult.message || 'Quota exceeded',
          quotaResult.remaining || 0,
          quotaResult.resetDate || new Date()
        );
      }

      // 6. Generate composition with Gemini
      const geminiResponse = await this.executeWithRetry(() =>
        this.geminiService.multiImageComposition({
          ...context.request,
          inputImages
        })
      );

      // 7. Process generated images
      const processedImages = await this.processGeneratedImages(
        geminiResponse.images,
        context.subscriptionTier
      );

      // 8. Update generation record
      await this.updateGenerationRecord(generationRecord, {
        status: 'completed',
        inputImages: inputImages.map((_, index) => `input_image_${index}`),
        outputImages: processedImages.map(img => ({
          url: img.url,
          width: img.width,
          height: img.height,
          format: img.format,
          fileSize: img.size,
          storageKey: img.id,
          thumbnailUrl: img.thumbnailUrl
        })),
        processingTimeMs: Date.now() - startTime,
        metadata: {
          ...generationRecord.metadata,
          ...geminiResponse.metadata,
          inputImageCount: inputImages.length,
          compositionAnalysis: typeof geminiResponse.metadata.compositionAnalysis === 'string'
            ? { analysis: geminiResponse.metadata.compositionAnalysis }
            : geminiResponse.metadata.compositionAnalysis
        }
      });

      return {
        success: true,
        data: {
          images: processedImages,
          metadata: geminiResponse.metadata,
          usage: geminiResponse.usage,
          generationRecord
        }
      };

    } catch (error) {
      console.error('Multi-image composition failed:', error);
      
      if (generationRecord) {
        await this.updateGenerationRecord(generationRecord, {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      return {
        success: false,
        error: {
          code: error instanceof AppError ? error.errorCode : 'GENERATION_FAILED',
          message: error instanceof Error ? error.message : 'Generation failed',
          details: error instanceof AppError ? { statusCode: error.statusCode } : undefined
        }
      };
    }
  }

  /**
   * Orchestrate image refinement
   */
  async refineImage(
    context: GenerationContext,
    inputImage: Buffer,
    inputImageType: string,
    refinementType: 'enhance' | 'upscale' | 'style-transfer' | 'color-correction'
  ): Promise<GenerationResult> {
    const startTime = Date.now();
    let generationRecord: any = null;

    try {
      // 1. Validate input image
      const validationResult = await this.imageProcessingService.validateImage(
        inputImage,
        'input_image',
        context.subscriptionTier
      );

      if (!validationResult.valid) {
        throw new ValidationError(
          `Input image validation failed: ${validationResult.errors.join(', ')}`,
          'inputImage',
          'invalid',
          validationResult.errors
        );
      }

      // 2. Validate generation context
      await this.validateGenerationContext(context);

      // 3. Create generation record
      generationRecord = await this.createGenerationRecord(context, 'refine');

      // 4. Validate and consume quota
      const quotaResult = await this.validateAndConsumeQuota(context, generationRecord);
      if (!quotaResult.success) {
        throw new QuotaExceededError(
          quotaResult.message || 'Quota exceeded',
          quotaResult.remaining || 0,
          quotaResult.resetDate || new Date()
        );
      }

      // 5. Refine image with Gemini
      const geminiResponse = await this.executeWithRetry(() =>
        this.geminiService.refineImage({
          ...context.request,
          inputImage,
          inputImageType,
          refinementType
        })
      );

      // 6. Process refined images
      const processedImages = await this.processGeneratedImages(
        geminiResponse.images,
        context.subscriptionTier
      );

      // 7. Update generation record
      await this.updateGenerationRecord(generationRecord, {
        status: 'completed',
        inputImages: ['input_image'],
        outputImages: processedImages.map(img => ({
          url: img.url,
          width: img.width,
          height: img.height,
          format: img.format,
          fileSize: img.size,
          storageKey: img.id,
          thumbnailUrl: img.thumbnailUrl
        })),
        processingTimeMs: Date.now() - startTime,
        metadata: {
          ...generationRecord.metadata,
          ...geminiResponse.metadata,
          refinementType,
          refinementAnalysis: typeof geminiResponse.metadata.refinementAnalysis === 'string'
            ? { analysis: geminiResponse.metadata.refinementAnalysis }
            : geminiResponse.metadata.refinementAnalysis
        }
      });

      return {
        success: true,
        data: {
          images: processedImages,
          metadata: geminiResponse.metadata,
          usage: geminiResponse.usage,
          generationRecord
        }
      };

    } catch (error) {
      console.error('Image refinement failed:', error);
      
      if (generationRecord) {
        await this.updateGenerationRecord(generationRecord, {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      return {
        success: false,
        error: {
          code: error instanceof AppError ? error.errorCode : 'GENERATION_FAILED',
          message: error instanceof Error ? error.message : 'Generation failed',
          details: error instanceof AppError ? { statusCode: error.statusCode } : undefined
        }
      };
    }
  }

  /**
   * Validate generation context
   */
  private async validateGenerationContext(context: GenerationContext): Promise<void> {
    // Validate user exists and is active
    const user = await UserModel.findById(context.userId);
    if (!user || !user.isActive) {
      throw new ValidationError(
        'User not found or inactive',
        'userId',
        context.userId
      );
    }

    // Validate subscription info
    if (!context.subscriptionInfo.isActive && context.subscriptionTier !== 'free') {
      throw new SubscriptionError(
        'Subscription is not active',
        context.subscriptionTier,
        'inactive'
      );
    }

    // Validate request parameters
    if (!context.request.prompt || context.request.prompt.trim().length === 0) {
      throw new ValidationError(
        'Prompt is required and cannot be empty',
        'prompt',
        context.request.prompt
      );
    }

    if (context.request.prompt.length > 2000) {
      throw new ValidationError(
        'Prompt exceeds maximum length of 2000 characters',
        'prompt',
        context.request.prompt.length,
        ['<= 2000']
      );
    }

    // Validate quality settings for tier
    const capabilities = this.geminiService.getModelCapabilities(context.subscriptionTier);
    if (!capabilities.availableQualities.includes(context.request.quality)) {
      throw new ValidationError(
        `Quality '${context.request.quality}' not available for ${context.subscriptionTier} tier`,
        'quality',
        context.request.quality,
        capabilities.availableQualities
      );
    }

    // Validate batch size
    if (context.request.batchSize && context.request.batchSize > capabilities.maxBatchSize) {
      throw new ValidationError(
        `Batch size ${context.request.batchSize} exceeds limit of ${capabilities.maxBatchSize} for ${context.subscriptionTier} tier`,
        'batchSize',
        context.request.batchSize,
        [`<= ${capabilities.maxBatchSize}`]
      );
    }
  }

  /**
   * Create generation record in database
   */
  private async createGenerationRecord(
    context: GenerationContext,
    type: ImageGenerationType
  ): Promise<any> {
    const cost = QuotaUtils.calculateGenerationCost(type, {
      quality: context.request.quality === 'ultra' ? 'hd' : context.request.quality as 'standard' | 'hd',
      batchSize: context.request.batchSize || 1,
      aspectRatio: context.request.aspectRatio,
      style: context.request.style
    });

    const generation = new ImageGenerationModel({
      userId: context.userId,
      type,
      status: 'pending' as ImageGenerationStatus,
      prompt: context.request.prompt,
      negativePrompt: context.request.negativePrompt,
      style: context.request.style,
      aspectRatio: context.request.aspectRatio,
      quality: context.request.quality === 'ultra' ? 'hd' : context.request.quality, // Map ultra to hd for mongoose schema
      modelName: 'gemini-2.0-flash-exp',
      seed: context.request.seed,
      steps: context.request.steps,
      guidance: context.request.guidance,
      outputImages: [],
      cost,
      credits: cost,
      metadata: {
        model: 'gemini-2.0-flash-exp',
        version: '2.0',
        parameters: {
          subscriptionTier: context.subscriptionTier,
          batchSize: context.request.batchSize || 1,
          customModel: context.request.customModel
        }
      }
    });

    return await generation.save();
  }

  /**
   * Validate and consume quota
   */
  private async validateAndConsumeQuota(
    context: GenerationContext,
    generationRecord: any
  ): Promise<{
    success: boolean;
    message?: string;
    remaining?: number;
    resetDate?: Date;
  }> {
    try {
      // Calculate credits needed
      const creditsNeeded = generationRecord.credits;

      // Check if user has enough quota using the convenience alias
      if (context.quotaInfo.remaining < creditsNeeded) {
        return {
          success: false,
          message: `Insufficient quota. Need ${creditsNeeded} credits, have ${context.quotaInfo.remaining}`,
          remaining: context.quotaInfo.remaining,
          resetDate: context.quotaInfo.resetDate
        };
      }

      // Consume quota
      const user = await UserModel.findById(context.userId);
      if (!user) {
        return {
          success: false,
          message: 'User not found'
        };
      }

      user.monthlyUsage += creditsNeeded;
      await user.save();

      // Update generation record status
      generationRecord.status = 'processing';
      await generationRecord.save();

      return { success: true };

    } catch (error) {
      console.error('Quota validation/consumption failed:', error);
      return {
        success: false,
        message: 'Failed to validate/consume quota'
      };
    }
  }

  /**
   * Process generated images (optimization, thumbnails, etc.)
   */
  private async processGeneratedImages(
    images: any[],
    subscriptionTier: string
  ): Promise<any[]> {
    const processedImages = [];

    for (const image of images) {
      try {
        // For now, return the mock images as-is
        // In a real implementation, you would:
        // 1. Download the image from the URL
        // 2. Process it with imageProcessingService
        // 3. Upload to storage
        // 4. Generate thumbnails
        // 5. Return processed URLs

        processedImages.push({
          ...image,
          // Add any processing metadata
          processedAt: new Date().toISOString(),
          tier: subscriptionTier
        });

      } catch (error) {
        console.error(`Failed to process image ${image.id}:`, error);
        // Include unprocessed image with error flag
        processedImages.push({
          ...image,
          processingError: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return processedImages;
  }

  /**
   * Update generation record with results
   */
  private async updateGenerationRecord(
    generationRecord: any,
    updates: Partial<any>
  ): Promise<void> {
    try {
      Object.assign(generationRecord, updates);
      await generationRecord.save();
    } catch (error) {
      console.error('Failed to update generation record:', error);
      // Don't throw here as the generation might have succeeded
    }
  }

  /**
   * Execute operation with retry logic
   */
  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    return RetryHandler.withRetry(operation, 3, 1000);
  }

  /**
   * Health check for orchestrator
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      geminiService: any;
      imageProcessingService: any;
      databaseConnected: boolean;
    };
  }> {
    try {
      // Check Gemini service
      const geminiHealth = await this.geminiService.testConnection();
      
      // Check image processing service
      const processingHealth = await this.imageProcessingService.healthCheck();
      
      // Check database connection
      const databaseConnected = await this.checkDatabaseConnection();
      
      const allHealthy = geminiHealth.success && 
                        processingHealth.status === 'healthy' && 
                        databaseConnected;
      
      return {
        status: allHealthy ? 'healthy' : 'degraded',
        details: {
          geminiService: geminiHealth,
          imageProcessingService: processingHealth,
          databaseConnected
        }
      };
      
    } catch (error) {
      console.error('Orchestrator health check failed:', error);
      
      return {
        status: 'unhealthy',
        details: {
          geminiService: { success: false, error: 'Health check failed' },
          imageProcessingService: { status: 'unhealthy' },
          databaseConnected: false
        }
      };
    }
  }

  /**
   * Check database connection
   */
  private async checkDatabaseConnection(): Promise<boolean> {
    try {
      await UserModel.findOne().limit(1);
      return true;
    } catch (error) {
      console.error('Database connection check failed:', error);
      return false;
    }
  }
}

export default ImageGenerationOrchestrator;