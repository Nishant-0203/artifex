import express from 'express';
import { imageGenerationController } from '../controllers/imageGeneration';
import { 
  uploadSingleImage, 
  uploadMultipleImages, 
  cleanupUploadedFiles, 
  validateSubscriptionLimits 
} from '../middleware/imageGeneration';
import { validateRequest } from '../middleware/validation';
import { requireAuthentication } from '../middleware/auth';
import { 
  textToImageSchema,
  imageToImageSchema,
  multiImageSchema,
  refineImageSchema
} from '../validation/imageGeneration';

const router = express.Router();

// Apply authentication middleware to all image generation routes
router.use(requireAuthentication);

/**
 * @route POST /api/generate/text-to-image
 * @description Generate image from text prompt
 * @access Private
 */
router.post('/text-to-image', 
  validateSubscriptionLimits,
  validateRequest(textToImageSchema),
  cleanupUploadedFiles,
  imageGenerationController.textToImage.bind(imageGenerationController)
);

/**
 * @route POST /api/generate/image-to-image
 * @description Transform existing image with text prompt
 * @access Private
 */
router.post('/image-to-image',
  validateSubscriptionLimits,
  uploadSingleImage,
  validateRequest(imageToImageSchema),
  cleanupUploadedFiles,
  imageGenerationController.imageToImage.bind(imageGenerationController)
);

/**
 * @route POST /api/generate/multi-image
 * @description Compose multiple images into single output
 * @access Private
 */
router.post('/multi-image',
  validateSubscriptionLimits,
  uploadMultipleImages,
  validateRequest(multiImageSchema),
  cleanupUploadedFiles,
  imageGenerationController.multiImageComposition.bind(imageGenerationController)
);

/**
 * @route POST /api/generate/refine
 * @description Refine existing image with detailed adjustments
 * @access Private
 */
router.post('/refine',
  validateSubscriptionLimits,
  uploadSingleImage,
  validateRequest(refineImageSchema),
  cleanupUploadedFiles,
  imageGenerationController.refineImage.bind(imageGenerationController)
);

/**
 * @route GET /api/generate/history
 * @description Get user's generation history
 * @access Private
 */
router.get('/history',
  imageGenerationController.getGenerationHistory.bind(imageGenerationController)
);

/**
 * @route GET /api/generate/quota
 * @description Get user's current quota status
 * @access Private
 */
router.get('/quota',
  imageGenerationController.getQuotaStatus.bind(imageGenerationController)
);

export default router;