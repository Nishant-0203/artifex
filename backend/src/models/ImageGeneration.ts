import { Schema, model, Model } from 'mongoose';
import { createBaseSchema, addStaticMethods, BaseDocument, validators } from './base';
import { 
  ImageGeneration as IImageGeneration, 
  ImageGenerationType, 
  ImageGenerationStatus,
  GeneratedImage,
  ImageGenerationMetadata
} from '../types';

// ImageGeneration document interface extending base document
export interface ImageGenerationDocument extends BaseDocument {
  userId: string;
  type: ImageGenerationType;
  status: ImageGenerationStatus;
  prompt: string;
  negativePrompt?: string;
  style?: string;
  aspectRatio: string;
  quality: 'standard' | 'hd';
  model: string;
  seed?: number;
  steps?: number;
  guidance?: number;
  inputImages?: string[];
  outputImages: GeneratedImage[];
  processingTimeMs?: number;
  cost: number;
  credits: number;
  metadata: ImageGenerationMetadata;
  errorMessage?: string;
  
  // Instance methods
  markAsProcessing(): Promise<ImageGenerationDocument>;
  markAsCompleted(images: GeneratedImage[], processingTime?: number): Promise<ImageGenerationDocument>;
  markAsFailed(error: string): Promise<ImageGenerationDocument>;
  markAsCanceled(): Promise<ImageGenerationDocument>;
  calculateCost(): number;
  getEstimatedProcessingTime(): number;
  isProcessing(): boolean;
  isCompleted(): boolean;
  hasFailed(): boolean;
  addImage(image: GeneratedImage): Promise<ImageGenerationDocument>;
  updateMetadata(metadata: Partial<ImageGenerationMetadata>): Promise<ImageGenerationDocument>;
}

// ImageGeneration model interface with static methods
export interface ImageGenerationModel extends Model<ImageGenerationDocument> {
  findByUserId(userId: string, limit?: number): Promise<ImageGenerationDocument[]>;
  findByStatus(status: ImageGenerationStatus): Promise<ImageGenerationDocument[]>;
  findByType(type: ImageGenerationType): Promise<ImageGenerationDocument[]>;
  findPending(): Promise<ImageGenerationDocument[]>;
  findProcessing(): Promise<ImageGenerationDocument[]>;
  findRecentByUser(userId: string, days?: number): Promise<ImageGenerationDocument[]>;
  getUserStats(userId: string): Promise<any>;
  getSystemStats(): Promise<any>;
  createGeneration(data: Partial<IImageGeneration>): Promise<ImageGenerationDocument>;
  findStalledGenerations(minutes?: number): Promise<ImageGenerationDocument[]>;
}

// Generated image schema
const generatedImageSchema = new Schema({
  url: {
    type: String,
    required: [true, 'Image URL is required'],
    trim: true,
    match: [/^https?:\/\/.+/, 'Please provide a valid URL']
  },
  width: {
    type: Number,
    required: [true, 'Image width is required'],
    min: [1, 'Width must be positive']
  },
  height: {
    type: Number,
    required: [true, 'Image height is required'],
    min: [1, 'Height must be positive']
  },
  format: {
    type: String,
    required: [true, 'Image format is required'],
    enum: ['png', 'jpg', 'jpeg', 'webp'],
    lowercase: true
  },
  fileSize: {
    type: Number,
    required: [true, 'File size is required'],
    min: [0, 'File size must be non-negative']
  },
  storageKey: {
    type: String,
    required: [true, 'Storage key is required']
  },
  thumbnailUrl: {
    type: String,
    required: false,
    trim: true,
    match: [/^https?:\/\/.+/, 'Please provide a valid URL']
  }
}, { _id: false });

// Image generation metadata schema
const metadataSchema = new Schema({
  model: {
    type: String,
    required: [true, 'Model is required'],
    enum: ['dall-e-2', 'dall-e-3', 'stable-diffusion', 'midjourney']
  },
  version: {
    type: String,
    required: [true, 'Model version is required']
  },
  parameters: {
    type: Schema.Types.Mixed,
    default: {}
  },
  processingNode: {
    type: String,
    default: null
  },
  queuePosition: {
    type: Number,
    default: null,
    min: [0, 'Queue position must be non-negative']
  },
  estimatedTime: {
    type: Number,
    default: null,
    min: [0, 'Estimated time must be non-negative']
  },
  actualTime: {
    type: Number,
    default: null,
    min: [0, 'Actual time must be non-negative']
  }
}, { _id: false });

// Image generation schema definition
const imageGenerationSchemaDefinition = {
  userId: {
    type: String,
    required: [true, 'User ID is required'],
    ref: 'User',
    index: true
  },
  type: {
    ...validators.enumValidator([
      'text-to-image', 
      'image-to-image', 
      'multi-image', 
      'refine'
    ], 'generation type'),
    required: [true, 'Generation type is required'],
    index: true
  },
  status: {
    ...validators.enumValidator([
      'pending', 
      'processing', 
      'completed', 
      'failed', 
      'canceled'
    ], 'generation status'),
    default: 'pending',
    index: true
  },
  prompt: {
    type: String,
    required: [true, 'Prompt is required'],
    maxlength: [4000, 'Prompt cannot exceed 4000 characters'],
    trim: true
  },
  negativePrompt: {
    type: String,
    maxlength: [2000, 'Negative prompt cannot exceed 2000 characters'],
    trim: true
  },
  style: {
    type: String,
    enum: ['realistic', 'artistic', 'anime', 'cartoon', 'abstract', 'vintage', 'modern'],
    default: 'realistic'
  },
  aspectRatio: {
    type: String,
    required: [true, 'Aspect ratio is required'],
    enum: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'],
    default: '1:1'
  },
  quality: {
    type: String,
    enum: ['standard', 'hd'],
    default: 'standard'
  },
  model: {
    type: String,
    required: [true, 'Model is required'],
    enum: ['dall-e-2', 'dall-e-3', 'stable-diffusion', 'midjourney'],
    default: 'dall-e-3'
  },
  seed: {
    type: Number,
    min: [0, 'Seed must be non-negative']
  },
  steps: {
    type: Number,
    min: [1, 'Steps must be at least 1'],
    max: [150, 'Steps cannot exceed 150'],
    default: 30
  },
  guidance: {
    type: Number,
    min: [0, 'Guidance must be non-negative'],
    max: [30, 'Guidance cannot exceed 30'],
    default: 7.5
  },
  inputImages: [{
    type: String,
    validate: {
      validator: function(url: string) {
        return /^https?:\/\/.+/.test(url);
      },
      message: 'Invalid input image URL'
    }
  }],
  outputImages: [generatedImageSchema],
  processingTimeMs: {
    type: Number,
    min: [0, 'Processing time must be non-negative']
  },
  cost: {
    type: Number,
    required: [true, 'Cost is required'],
    min: [0, 'Cost must be non-negative'],
    default: 0
  },
  credits: {
    type: Number,
    required: [true, 'Credits is required'],
    min: [0, 'Credits must be non-negative'],
    default: 1
  },
  metadata: {
    type: metadataSchema,
    required: true,
    default: () => ({
      model: 'dall-e-3',
      version: '1.0',
      parameters: {}
    })
  },
  errorMessage: {
    type: String,
    maxlength: [1000, 'Error message cannot exceed 1000 characters']
  }
};

// Create the image generation schema
const imageGenerationSchema = createBaseSchema(imageGenerationSchemaDefinition);

// Add compound indexes for efficient querying
imageGenerationSchema.index({ userId: 1, status: 1 });
imageGenerationSchema.index({ userId: 1, createdAt: -1 });
imageGenerationSchema.index({ status: 1, createdAt: -1 });
imageGenerationSchema.index({ type: 1, status: 1 });
imageGenerationSchema.index({ model: 1, status: 1 });
imageGenerationSchema.index({ createdAt: -1 });

// Instance methods
imageGenerationSchema.methods.markAsProcessing = async function(): Promise<ImageGenerationDocument> {
  this.status = 'processing';
  this.metadata.actualTime = Date.now();
  return this.save();
};

imageGenerationSchema.methods.markAsCompleted = async function(
  images: GeneratedImage[], 
  processingTime?: number
): Promise<ImageGenerationDocument> {
  this.status = 'completed';
  this.outputImages = images;
  if (processingTime) {
    this.processingTimeMs = processingTime;
    this.metadata.actualTime = processingTime;
  }
  return this.save();
};

imageGenerationSchema.methods.markAsFailed = async function(error: string): Promise<ImageGenerationDocument> {
  this.status = 'failed';
  this.errorMessage = error;
  return this.save();
};

imageGenerationSchema.methods.markAsCanceled = async function(): Promise<ImageGenerationDocument> {
  this.status = 'canceled';
  return this.save();
};

imageGenerationSchema.methods.calculateCost = function(): number {
  const baseCost = {
    'dall-e-2': 0.02,
    'dall-e-3': 0.04,
    'stable-diffusion': 0.01,
    'midjourney': 0.03
  };

  let cost = baseCost[this.model as keyof typeof baseCost] || 0.02;
  
  // HD quality multiplier
  if (this.quality === 'hd') {
    cost *= 2;
  }
  
  // Multiple images multiplier
  const imageCount = Math.max(1, this.outputImages.length);
  cost *= imageCount;

  return Math.round(cost * 100) / 100; // Round to 2 decimal places
};

imageGenerationSchema.methods.getEstimatedProcessingTime = function(): number {
  const baseTime = {
    'dall-e-2': 10000, // 10 seconds
    'dall-e-3': 15000, // 15 seconds
    'stable-diffusion': 5000, // 5 seconds
    'midjourney': 30000 // 30 seconds
  };

  let time = baseTime[this.model as keyof typeof baseTime] || 10000;
  
  // HD quality adds time
  if (this.quality === 'hd') {
    time *= 1.5;
  }

  // Higher steps add time
  if (this.steps > 50) {
    time *= 1.2;
  }

  return Math.round(time);
};

imageGenerationSchema.methods.isProcessing = function(): boolean {
  return this.status === 'processing';
};

imageGenerationSchema.methods.isCompleted = function(): boolean {
  return this.status === 'completed';
};

imageGenerationSchema.methods.hasFailed = function(): boolean {
  return this.status === 'failed';
};

imageGenerationSchema.methods.addImage = async function(image: GeneratedImage): Promise<ImageGenerationDocument> {
  this.outputImages.push(image);
  return this.save();
};

imageGenerationSchema.methods.updateMetadata = async function(
  metadata: Partial<ImageGenerationMetadata>
): Promise<ImageGenerationDocument> {
  this.metadata = { ...this.metadata.toObject(), ...metadata };
  return this.save();
};

// Static methods
imageGenerationSchema.statics.findByUserId = function(
  userId: string, 
  limit: number = 50
): Promise<ImageGenerationDocument[]> {
  return this.find({ userId, isDeleted: false })
    .sort({ createdAt: -1 })
    .limit(limit);
};

imageGenerationSchema.statics.findByStatus = function(status: ImageGenerationStatus): Promise<ImageGenerationDocument[]> {
  return this.find({ status, isDeleted: false }).sort({ createdAt: -1 });
};

imageGenerationSchema.statics.findByType = function(type: ImageGenerationType): Promise<ImageGenerationDocument[]> {
  return this.find({ type, isDeleted: false }).sort({ createdAt: -1 });
};

imageGenerationSchema.statics.findPending = function(): Promise<ImageGenerationDocument[]> {
  return this.find({ status: 'pending', isDeleted: false }).sort({ createdAt: 1 });
};

imageGenerationSchema.statics.findProcessing = function(): Promise<ImageGenerationDocument[]> {
  return this.find({ status: 'processing', isDeleted: false }).sort({ createdAt: -1 });
};

imageGenerationSchema.statics.findRecentByUser = function(
  userId: string, 
  days: number = 7
): Promise<ImageGenerationDocument[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.find({
    userId,
    createdAt: { $gte: startDate },
    isDeleted: false
  }).sort({ createdAt: -1 });
};

imageGenerationSchema.statics.getUserStats = async function(userId: string): Promise<any> {
  const stats = await this.aggregate([
    {
      $match: { userId, isDeleted: false }
    },
    {
      $group: {
        _id: null,
        totalGenerations: { $sum: 1 },
        completedGenerations: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        failedGenerations: {
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
        },
        totalCost: { $sum: '$cost' },
        totalCredits: { $sum: '$credits' },
        avgProcessingTime: { $avg: '$processingTimeMs' },
        totalImages: { $sum: { $size: '$outputImages' } }
      }
    }
  ]);

  return stats[0] || {
    totalGenerations: 0,
    completedGenerations: 0,
    failedGenerations: 0,
    totalCost: 0,
    totalCredits: 0,
    avgProcessingTime: 0,
    totalImages: 0
  };
};

imageGenerationSchema.statics.getSystemStats = async function(): Promise<any> {
  const stats = await this.aggregate([
    {
      $match: { isDeleted: false }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalCost: { $sum: '$cost' },
        avgProcessingTime: { $avg: '$processingTimeMs' }
      }
    }
  ]);

  const dailyStats = await this.aggregate([
    {
      $match: {
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        isDeleted: false
      }
    },
    {
      $group: {
        _id: null,
        todayGenerations: { $sum: 1 },
        todayImages: { $sum: { $size: '$outputImages' } }
      }
    }
  ]);

  return {
    statusBreakdown: stats,
    dailyStats: dailyStats[0] || { todayGenerations: 0, todayImages: 0 }
  };
};

imageGenerationSchema.statics.createGeneration = async function(
  data: Partial<IImageGeneration>
): Promise<ImageGenerationDocument> {
  const generation = new this(data);
  generation.cost = generation.calculateCost();
  generation.metadata.estimatedTime = generation.getEstimatedProcessingTime();
  return generation.save();
};

imageGenerationSchema.statics.findStalledGenerations = function(
  minutes: number = 30
): Promise<ImageGenerationDocument[]> {
  const cutoff = new Date(Date.now() - minutes * 60 * 1000);
  
  return this.find({
    status: 'processing',
    updatedAt: { $lt: cutoff },
    isDeleted: false
  }).sort({ updatedAt: 1 });
};

// Add virtual for id
imageGenerationSchema.virtual('id').get(function(this: any) {
  return this._id?.toHexString();
});

// Add static methods for soft delete
addStaticMethods(imageGenerationSchema);

// Pre-save middleware
imageGenerationSchema.pre('save', function(this: any, next: any) {
  // Calculate cost if not set
  if (this.isNew && !this.cost) {
    this.cost = this.calculateCost();
  }
  
  // Set estimated processing time
  if (this.isNew && this.metadata && !this.metadata.estimatedTime) {
    this.metadata.estimatedTime = this.getEstimatedProcessingTime();
  }

  next();
});

// Post-save middleware to update user statistics
imageGenerationSchema.post('save', async function(this: ImageGenerationDocument, doc: any) {
  if (this.status === 'completed' && doc.isNew) {
    const User = require('./User').UserModel;
    await User.findOneAndUpdate(
      { _id: this.userId },
      { 
        $inc: { 
          monthlyUsage: this.credits,
          totalImagesGenerated: this.outputImages.length 
        }
      }
    );
  }
});

// Create and export the ImageGeneration model
export const ImageGenerationModel = model<ImageGenerationDocument, ImageGenerationModel>('ImageGeneration', imageGenerationSchema);