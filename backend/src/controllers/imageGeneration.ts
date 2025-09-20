import { Request, Response } from 'express';
import { ImageGenerationOrchestrator } from '../services/imageGenerationOrchestrator';
import { logger } from '../utils/logger';
import { SubscriptionTier } from '../types';
import fs from 'fs';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    subscriptionStatus?: string;
  };
}

export class ImageGenerationController {
  private orchestrator: ImageGenerationOrchestrator;

  constructor() {
    this.orchestrator = new ImageGenerationOrchestrator();
  }

  private createPermissions(subscriptionTier: SubscriptionTier) {
    return {
      maxImageGenerations: subscriptionTier === 'free' ? 10 : subscriptionTier === 'plus' ? 100 : 1000,
      allowsHighResolution: subscriptionTier !== 'free',
      allowsAdvancedFeatures: subscriptionTier === 'pro',
      allowsCommercialUse: subscriptionTier === 'pro',
      allowsAPIAccess: true,
      allowsPriorityProcessing: subscriptionTier === 'pro',
      maxConcurrentGenerations: subscriptionTier === 'free' ? 1 : subscriptionTier === 'plus' ? 3 : 5,
      allowsCustomModels: subscriptionTier === 'pro',
      allowsBatchProcessing: subscriptionTier !== 'free',
      allowsImageUpscaling: subscriptionTier !== 'free'
    };
  }

  private createContext(userId: string, subscriptionTier: SubscriptionTier, request: any, quotaInfo?: any) {
    return {
      userId,
      subscriptionTier,
      quotaInfo: quotaInfo || { remaining: 10, resetDate: new Date() },
      subscriptionInfo: {
        userId,
        tier: subscriptionTier,
        status: 'active' as any,
        isActive: true,
        isInTrial: false,
        hasExpired: false,
        features: [],
        permissions: this.createPermissions(subscriptionTier)
      },
      request: {
        ...request,
        subscriptionTier,
        userId
      }
    };
  }

  /**
   * Generate image from text prompt
   */
  async textToImage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { prompt, aspectRatio, style, quality } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ 
          success: false, 
          message: 'Authentication required' 
        });
        return;
      }

      const subscriptionTier = (req.user?.subscriptionStatus || 'free') as SubscriptionTier;

      logger.info('Text-to-image generation request', {
        userId,
        prompt: prompt.substring(0, 100),
        aspectRatio,
        style,
        quality
      });

      const context = this.createContext(userId, subscriptionTier, {
        prompt,
        aspectRatio,
        style,
        quality
      }, (req as any).quotaInfo);

      const result = await this.orchestrator.generateTextToImage(context);

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: result.error?.message || 'Image generation failed'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          images: result.data?.images || [],
          metadata: result.data?.metadata,
          usage: result.data?.usage
        }
      });

    } catch (error) {
      logger.error('Text-to-image generation error', error as Error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during image generation'
      });
    }
  }

  /**
   * Transform existing image with text prompt
   */
  async imageToImage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { prompt, transformationType, strength } = req.body;
      const userId = req.user?.id;
      const sourceImage = req.file;

      if (!userId) {
        res.status(401).json({ 
          success: false, 
          message: 'Authentication required' 
        });
        return;
      }

      if (!sourceImage) {
        res.status(400).json({
          success: false,
          message: 'Source image is required'
        });
        return;
      }

      const subscriptionTier = (req.user?.subscriptionStatus || 'free') as SubscriptionTier;

      logger.info('Image-to-image generation request', {
        userId,
        prompt: prompt.substring(0, 100),
        transformationType,
        strength,
        sourceImageSize: sourceImage.size
      });

      const context = this.createContext(userId, subscriptionTier, {
        prompt,
        transformationType,
        strength
      }, (req as any).quotaInfo);

      // Read the uploaded image file
      const imageBuffer = fs.readFileSync(sourceImage.path);
      const inputImageType = sourceImage.mimetype;

      const result = await this.orchestrator.generateImageToImage(context, imageBuffer, inputImageType);

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: result.error?.message || 'Image generation failed'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          images: result.data?.images || [],
          metadata: result.data?.metadata,
          usage: result.data?.usage
        }
      });

    } catch (error) {
      logger.error('Image-to-image generation error', error as Error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during image generation'
      });
    }
  }

  /**
   * Compose multiple images into single output
   */
  async multiImageComposition(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { prompt, compositionType, layout } = req.body;
      const userId = req.user?.id;
      const sourceImages = req.files as Express.Multer.File[];

      if (!userId) {
        res.status(401).json({ 
          success: false, 
          message: 'Authentication required' 
        });
        return;
      }

      if (!sourceImages || sourceImages.length === 0) {
        res.status(400).json({
          success: false,
          message: 'At least one source image is required'
        });
        return;
      }

      const subscriptionTier = (req.user?.subscriptionStatus || 'free') as SubscriptionTier;

      logger.info('Multi-image composition request', {
        userId,
        prompt: prompt.substring(0, 100),
        compositionType,
        layout,
        imageCount: sourceImages.length
      });

      const context = this.createContext(userId, subscriptionTier, {
        prompt,
        compositionType,
        layout
      }, (req as any).quotaInfo);

      // Read all uploaded image files
      const inputImages = sourceImages.map(file => ({
        data: fs.readFileSync(file.path),
        type: file.mimetype,
        description: file.originalname
      }));

      const result = await this.orchestrator.generateMultiImageComposition(context, inputImages);

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: result.error?.message || 'Image generation failed'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          images: result.data?.images || [],
          metadata: result.data?.metadata,
          usage: result.data?.usage
        }
      });

    } catch (error) {
      logger.error('Multi-image composition error', error as Error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during image generation'
      });
    }
  }

  /**
   * Refine existing image with detailed adjustments
   */
  async refineImage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { 
        prompt, 
        refinementType, 
        adjustments, 
        preserveAspectRatio 
      } = req.body;
      const userId = req.user?.id;
      const sourceImage = req.file;

      if (!userId) {
        res.status(401).json({ 
          success: false, 
          message: 'Authentication required' 
        });
        return;
      }

      if (!sourceImage) {
        res.status(400).json({
          success: false,
          message: 'Source image is required'
        });
        return;
      }

      const subscriptionTier = (req.user?.subscriptionStatus || 'free') as SubscriptionTier;

      logger.info('Image refinement request', {
        userId,
        prompt: prompt?.substring(0, 100),
        refinementType,
        adjustments,
        preserveAspectRatio,
        sourceImageSize: sourceImage.size
      });

      const context = this.createContext(userId, subscriptionTier, {
        prompt,
        refinementType,
        adjustments,
        preserveAspectRatio
      }, (req as any).quotaInfo);

      // Read the uploaded image file
      const imageBuffer = fs.readFileSync(sourceImage.path);
      const inputImageType = sourceImage.mimetype;

      const result = await this.orchestrator.refineImage(
        context, 
        imageBuffer, 
        inputImageType, 
        refinementType || 'enhance'
      );

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: result.error?.message || 'Image refinement failed'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          images: result.data?.images || [],
          metadata: result.data?.metadata,
          usage: result.data?.usage
        }
      });

    } catch (error) {
      logger.error('Image refinement error', error as Error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during image refinement'
      });
    }
  }

  /**
   * Get generation history for user
   */
  async getGenerationHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { page = 1, limit = 20, type } = req.query;

      if (!userId) {
        res.status(401).json({ 
          success: false, 
          message: 'Authentication required' 
        });
        return;
      }

      logger.info('Generation history request', {
        userId,
        page,
        limit,
        type
      });

      // For now, return a placeholder response since we don't have this method in orchestrator
      res.status(200).json({
        success: true,
        data: {
          generations: [],
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: 0,
            totalPages: 0
          }
        }
      });

    } catch (error) {
      logger.error('Get generation history error', error as Error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while retrieving history'
      });
    }
  }

  /**
   * Get user's current generation quota and usage
   */
  async getQuotaStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ 
          success: false, 
          message: 'Authentication required' 
        });
        return;
      }

      logger.info('Quota status request', { userId });

      const subscriptionTier = (req.user?.subscriptionStatus || 'free') as SubscriptionTier;

      // For now, return a placeholder response
      res.status(200).json({
        success: true,
        data: {
          subscription: subscriptionTier,
          current: {
            images: 0,
            credits: 10
          },
          limits: {
            images: subscriptionTier === 'free' ? 10 : subscriptionTier === 'plus' ? 100 : 1000,
            credits: subscriptionTier === 'free' ? 50 : subscriptionTier === 'plus' ? 500 : 5000,
            fileSize: subscriptionTier === 'free' ? 10485760 : subscriptionTier === 'plus' ? 20971520 : 52428800,
            maxDimensions: subscriptionTier === 'free' ? 1024 : subscriptionTier === 'plus' ? 2048 : 4096,
            multiImageCount: subscriptionTier === 'free' ? 3 : subscriptionTier === 'plus' ? 5 : 10
          },
          resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          usage: {
            daily: 0,
            weekly: 0,
            monthly: 0
          }
        }
      });

    } catch (error) {
      logger.error('Get quota status error', error as Error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while retrieving quota'
      });
    }
  }
}

// Export singleton instance
export const imageGenerationController = new ImageGenerationController();