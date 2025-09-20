import { z } from 'zod';

/**
 * Validation schemas for image generation endpoints
 * Comprehensive Zod validation with subscription-tier based constraints
 */

// Base validation for common image generation parameters
const baseGenerationSchema = z.object({
  prompt: z.string()
    .min(1, 'Prompt is required')
    .max(2000, 'Prompt cannot exceed 2000 characters')
    .refine(prompt => prompt.trim().length > 0, 'Prompt cannot be empty'),
  
  negativePrompt: z.string()
    .max(1000, 'Negative prompt cannot exceed 1000 characters')
    .optional(),
  
  quality: z.enum(['standard', 'hd', 'ultra'], {
    errorMap: () => ({ message: 'Quality must be standard, hd, or ultra' })
  }).default('standard'),
  
  aspectRatio: z.enum(['1:1', '16:9', '9:16', '4:3', '3:2', '2:3', '3:4'], {
    errorMap: () => ({ message: 'Invalid aspect ratio. Supported: 1:1, 16:9, 9:16, 4:3, 3:2, 2:3, 3:4' })
  }).default('1:1'),
  
  style: z.enum([
    'photorealistic', 'artistic', 'cartoon', 'anime', 'sketch', 
    'watercolor', 'oil-painting', 'digital-art', 'minimalist', 
    'vintage', 'cyberpunk', 'fantasy'
  ]).optional(),
  
  seed: z.number()
    .int('Seed must be an integer')
    .min(0, 'Seed must be positive')
    .max(2147483647, 'Seed must be within valid range')
    .optional(),
  
  steps: z.number()
    .int('Steps must be an integer')
    .min(1, 'Steps must be at least 1')
    .max(50, 'Steps cannot exceed 50')
    .default(20)
    .optional(),
  
  guidance: z.number()
    .min(1, 'Guidance must be at least 1')
    .max(20, 'Guidance cannot exceed 20')
    .default(7.5)
    .optional(),
});

/**
 * Text-to-Image Generation Schema
 * For creating images from text prompts
 */
export const textToImageSchema = z.object({
  body: baseGenerationSchema.extend({
    batchSize: z.number()
      .int('Batch size must be an integer')
      .min(1, 'Batch size must be at least 1')
      .max(4, 'Batch size cannot exceed 4')
      .default(1)
      .optional(),
    
    customModel: z.string()
      .min(1, 'Custom model name required')
      .max(100, 'Model name too long')
      .optional(),
  }).refine(data => {
    // Subscription-based validation will be handled in middleware
    // This is for basic parameter validation
    if (data.batchSize && data.batchSize > 1 && data.quality === 'ultra') {
      return false;
    }
    return true;
  }, {
    message: 'Ultra quality not supported with batch size > 1',
    path: ['batchSize']
  })
});

/**
 * Image-to-Image Generation Schema
 * For modifying existing images with prompts
 */
export const imageToImageSchema = z.object({
  body: baseGenerationSchema.extend({
    strength: z.number()
      .min(0.1, 'Strength must be at least 0.1')
      .max(1.0, 'Strength cannot exceed 1.0')
      .default(0.75)
      .optional(),
    
    preserveOriginal: z.boolean()
      .default(false)
      .optional(),
    
    maskMode: z.enum(['none', 'inpainting', 'outpainting'])
      .default('none')
      .optional(),
  }),
  
  files: z.object({
    image: z.array(z.object({
      fieldname: z.string(),
      originalname: z.string(),
      encoding: z.string(),
      mimetype: z.string().refine(
        mimetype => ['image/jpeg', 'image/png', 'image/webp'].includes(mimetype),
        'Only JPEG, PNG, and WebP images are supported'
      ),
      size: z.number().max(10 * 1024 * 1024, 'Image size cannot exceed 10MB'),
      buffer: z.instanceof(Buffer)
    })).min(1, 'Input image is required').max(1, 'Only one input image allowed')
  })
});

/**
 * Multi-Image Composition Schema
 * For creating compositions from multiple images (Premium feature)
 */
export const multiImageSchema = z.object({
  body: baseGenerationSchema.extend({
    compositionType: z.enum(['collage', 'blend', 'sequence', 'comparison'])
      .default('collage'),
    
    layout: z.enum(['grid', 'horizontal', 'vertical', 'custom'])
      .default('grid')
      .optional(),
    
    blendMode: z.enum(['normal', 'multiply', 'overlay', 'soft-light', 'hard-light'])
      .default('normal')
      .optional(),
    
    spacing: z.number()
      .min(0, 'Spacing cannot be negative')
      .max(100, 'Spacing cannot exceed 100px')
      .default(10)
      .optional(),
  }),
  
  files: z.object({
    images: z.array(z.object({
      fieldname: z.string(),
      originalname: z.string(),
      encoding: z.string(),
      mimetype: z.string().refine(
        mimetype => ['image/jpeg', 'image/png', 'image/webp'].includes(mimetype),
        'Only JPEG, PNG, and WebP images are supported'
      ),
      size: z.number().max(10 * 1024 * 1024, 'Each image cannot exceed 10MB'),
      buffer: z.instanceof(Buffer)
    })).min(2, 'At least 2 images required for composition')
      .max(5, 'Maximum 5 images allowed for composition')
  })
});

/**
 * Image Refinement Schema
 * For enhancing, upscaling, and refining images
 */
export const refineImageSchema = z.object({
  body: z.object({
    refinementType: z.enum(['enhance', 'upscale', 'style-transfer', 'color-correction'], {
      errorMap: () => ({ message: 'Refinement type must be enhance, upscale, style-transfer, or color-correction' })
    }),
    
    targetStyle: z.string()
      .min(1, 'Target style required for style transfer')
      .max(500, 'Style description too long')
      .optional(),
    
    upscaleFactor: z.number()
      .min(1, 'Upscale factor must be at least 1')
      .max(4, 'Maximum upscale factor is 4x')
      .default(2)
      .optional(),
    
    enhancementLevel: z.enum(['subtle', 'moderate', 'aggressive'])
      .default('moderate')
      .optional(),
    
    colorAdjustments: z.object({
      brightness: z.number().min(-100).max(100).default(0).optional(),
      contrast: z.number().min(-100).max(100).default(0).optional(),
      saturation: z.number().min(-100).max(100).default(0).optional(),
      hue: z.number().min(-180).max(180).default(0).optional(),
    }).optional(),
    
    preserveDetails: z.boolean().default(true).optional(),
  }).refine(data => {
    // Validate refinement type specific parameters
    if (data.refinementType === 'style-transfer' && !data.targetStyle) {
      return false;
    }
    if (data.refinementType === 'upscale' && (!data.upscaleFactor || data.upscaleFactor < 1)) {
      return false;
    }
    return true;
  }, {
    message: 'Missing required parameters for refinement type'
  }),
  
  files: z.object({
    image: z.array(z.object({
      fieldname: z.string(),
      originalname: z.string(),
      encoding: z.string(),
      mimetype: z.string().refine(
        mimetype => ['image/jpeg', 'image/png', 'image/webp'].includes(mimetype),
        'Only JPEG, PNG, and WebP images are supported'
      ),
      size: z.number().max(15 * 1024 * 1024, 'Image size cannot exceed 15MB for refinement'),
      buffer: z.instanceof(Buffer)
    })).min(1, 'Input image is required').max(1, 'Only one input image allowed')
  })
});

/**
 * Subscription-tier based validation constraints
 * These will be applied in middleware based on user's subscription
 */
export const subscriptionConstraints = {
  free: {
    maxBatchSize: 1,
    allowedQualities: ['standard'],
    maxImageSize: 5 * 1024 * 1024, // 5MB
    allowsMultiImage: false,
    maxMultiImages: 1,
    allowsCustomModels: false,
    maxRefinementUploads: 1,
    allowedRefinementTypes: ['enhance'],
  },
  plus: {
    maxBatchSize: 2,
    allowedQualities: ['standard', 'hd'],
    maxImageSize: 10 * 1024 * 1024, // 10MB
    allowsMultiImage: true,
    maxMultiImages: 3,
    allowsCustomModels: false,
    maxRefinementUploads: 3,
    allowedRefinementTypes: ['enhance', 'upscale', 'color-correction'],
  },
  pro: {
    maxBatchSize: 4,
    allowedQualities: ['standard', 'hd', 'ultra'],
    maxImageSize: 15 * 1024 * 1024, // 15MB
    allowsMultiImage: true,
    maxMultiImages: 5,
    allowsCustomModels: true,
    maxRefinementUploads: 5,
    allowedRefinementTypes: ['enhance', 'upscale', 'style-transfer', 'color-correction'],
  }
};

/**
 * Subscription-tier validation middleware helper
 */
export const validateSubscriptionConstraints = (
  subscriptionTier: 'free' | 'plus' | 'pro',
  data: any,
  generationType: 'text-to-image' | 'image-to-image' | 'multi-image' | 'refine'
) => {
  const constraints = subscriptionConstraints[subscriptionTier];
  const errors: string[] = [];

  // Check batch size
  if (data.batchSize && data.batchSize > constraints.maxBatchSize) {
    errors.push(`Batch size ${data.batchSize} exceeds limit of ${constraints.maxBatchSize} for ${subscriptionTier} tier`);
  }

  // Check quality
  if (data.quality && !constraints.allowedQualities.includes(data.quality)) {
    errors.push(`Quality '${data.quality}' not available for ${subscriptionTier} tier. Available: ${constraints.allowedQualities.join(', ')}`);
  }

  // Check multi-image permissions
  if (generationType === 'multi-image' && !constraints.allowsMultiImage) {
    errors.push(`Multi-image composition requires Plus or Pro subscription`);
  }

  // Check custom model permissions
  if (data.customModel && !constraints.allowsCustomModels) {
    errors.push(`Custom models require Pro subscription`);
  }

  // Check refinement type permissions
  if (generationType === 'refine' && data.refinementType && 
      !constraints.allowedRefinementTypes.includes(data.refinementType)) {
    errors.push(`Refinement type '${data.refinementType}' not available for ${subscriptionTier} tier`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * File upload validation helper
 */
export const validateUploadedFiles = (
  files: any[],
  subscriptionTier: 'free' | 'plus' | 'pro',
  generationType: string
) => {
  const constraints = subscriptionConstraints[subscriptionTier];
  const errors: string[] = [];

  for (const file of files) {
    // Check file size
    if (file.size > constraints.maxImageSize) {
      errors.push(`File ${file.originalname} exceeds size limit of ${constraints.maxImageSize / (1024 * 1024)}MB`);
    }

    // Check file type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      errors.push(`File ${file.originalname} has unsupported format. Only JPEG, PNG, and WebP are allowed`);
    }

    // Check image dimensions (would need to be done after reading the image)
    // This would be handled in the image processing service
  }

  // Check file count limits
  if (generationType === 'multi-image' && files.length > constraints.maxMultiImages) {
    errors.push(`Too many images. Maximum ${constraints.maxMultiImages} allowed for ${subscriptionTier} tier`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

// Export validation schemas for use in routes
export const validationSchemas = {
  textToImage: textToImageSchema,
  imageToImage: imageToImageSchema,
  multiImage: multiImageSchema,
  refineImage: refineImageSchema,
};

export default validationSchemas;