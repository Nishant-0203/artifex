import { Schema, model, Model } from 'mongoose';
import { createBaseSchema, addStaticMethods, BaseDocument, validators } from './base';
import { User as IUser, UserRole, SubscriptionTier, UserPreferences, SUBSCRIPTION_QUOTAS } from '../types';

// User document interface extending base document
export interface UserDocument extends BaseDocument, Omit<IUser, 'id'> {
  // Instance methods
  resetMonthlyQuota(): Promise<UserDocument>;
  canGenerateImages(count?: number): boolean;
  incrementUsage(count?: number): Promise<UserDocument>;
  updateSubscription(tier: SubscriptionTier): Promise<UserDocument>;
  getRemainingQuota(): number;
  isQuotaExceeded(): boolean;
}

// User model interface with static methods
export interface UserModel extends Model<UserDocument> {
  findByClerkId(clerkId: string): Promise<UserDocument | null>;
  findByEmail(email: string): Promise<UserDocument | null>;
  createFromClerk(clerkData: any): Promise<UserDocument>;
  getUsersToResetQuota(): Promise<UserDocument[]>;
  resetAllQuotas(): Promise<void>;
  getActiveUsersCount(): Promise<number>;
  getUsersByTier(tier: SubscriptionTier): Promise<UserDocument[]>;
}

// Default user preferences
const defaultPreferences: UserPreferences = {
  defaultImageSize: '512x512',
  defaultStyle: 'realistic',
  emailNotifications: true,
  marketingEmails: false,
  theme: 'auto',
  language: 'en'
};

// User schema definition
const userSchemaDefinition = {
  clerkId: {
    type: String,
    required: [true, 'Clerk ID is required'],
    unique: true,
    index: true
  },
  email: {
    ...validators.email,
    required: [true, 'Email is required'],
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  firstName: {
    type: String,
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  username: {
    type: String,
    trim: true,
    unique: true,
    sparse: true,
    match: [/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens']
  },
  imageUrl: {
    ...validators.url,
    required: false
  },
  role: {
    ...validators.enumValidator(['user', 'admin', 'moderator'], 'role'),
    default: 'user',
    index: true
  },
  subscriptionTier: {
    ...validators.enumValidator(['free', 'plus', 'pro'], 'subscription tier'),
    default: 'free',
    index: true
  },
  subscriptionId: {
    type: String,
    ref: 'Subscription',
    index: true
  },
  emailVerified: {
    type: Boolean,
    default: false,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  lastLoginAt: {
    type: Date,
    default: Date.now
  },
  quotaResetDate: {
    type: Date,
    required: true,
    default: () => {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth() + 1, 1);
    },
    index: true
  },
  monthlyUsage: {
    type: Number,
    default: 0,
    min: [0, 'Monthly usage cannot be negative']
  },
  totalImagesGenerated: {
    type: Number,
    default: 0,
    min: [0, 'Total images generated cannot be negative']
  },
  preferences: {
    defaultImageSize: {
      type: String,
      default: defaultPreferences.defaultImageSize,
      enum: ['256x256', '512x512', '1024x1024', '1536x1536', '2048x2048']
    },
    defaultStyle: {
      type: String,
      default: defaultPreferences.defaultStyle,
      enum: ['realistic', 'artistic', 'anime', 'cartoon', 'abstract']
    },
    emailNotifications: {
      type: Boolean,
      default: defaultPreferences.emailNotifications
    },
    marketingEmails: {
      type: Boolean,
      default: defaultPreferences.marketingEmails
    },
    theme: {
      type: String,
      default: defaultPreferences.theme,
      enum: ['light', 'dark', 'auto']
    },
    language: {
      type: String,
      default: defaultPreferences.language,
      enum: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh']
    }
  }
};

// Create the user schema
const userSchema = createBaseSchema(userSchemaDefinition);

// Add compound indexes for efficient querying
userSchema.index({ clerkId: 1, isDeleted: 1 });
userSchema.index({ email: 1, isDeleted: 1 });
userSchema.index({ subscriptionTier: 1, isActive: 1 });
userSchema.index({ quotaResetDate: 1, subscriptionTier: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ lastLoginAt: -1 });

// Instance methods
userSchema.methods.resetMonthlyQuota = function(): Promise<UserDocument> {
  this.monthlyUsage = 0;
  const now = new Date();
  this.quotaResetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return this.save();
};

userSchema.methods.canGenerateImages = function(count: number = 1): boolean {
  const quota = SUBSCRIPTION_QUOTAS[this.subscriptionTier as SubscriptionTier];
  return (this.monthlyUsage + count) <= quota;
};

userSchema.methods.incrementUsage = function(count: number = 1): Promise<UserDocument> {
  this.monthlyUsage += count;
  this.totalImagesGenerated += count;
  return this.save();
};

userSchema.methods.updateSubscription = function(tier: SubscriptionTier): Promise<UserDocument> {
  this.subscriptionTier = tier;
  // Reset quota when upgrading/downgrading
  return this.resetMonthlyQuota();
};

userSchema.methods.getRemainingQuota = function(): number {
  const quota = SUBSCRIPTION_QUOTAS[this.subscriptionTier as SubscriptionTier];
  return Math.max(0, quota - this.monthlyUsage);
};

userSchema.methods.isQuotaExceeded = function(): boolean {
  const quota = SUBSCRIPTION_QUOTAS[this.subscriptionTier as SubscriptionTier];
  return this.monthlyUsage >= quota;
};

// Static methods
userSchema.statics.findByClerkId = function(clerkId: string): Promise<UserDocument | null> {
  return this.findOne({ clerkId, isDeleted: false });
};

userSchema.statics.findByEmail = function(email: string): Promise<UserDocument | null> {
  return this.findOne({ email: email.toLowerCase(), isDeleted: false });
};

userSchema.statics.createFromClerk = async function(clerkData: any): Promise<UserDocument> {
  const userData = {
    clerkId: clerkData.id,
    email: clerkData.emailAddresses[0]?.emailAddress?.toLowerCase(),
    name: `${clerkData.firstName || ''} ${clerkData.lastName || ''}`.trim() || clerkData.username,
    firstName: clerkData.firstName,
    lastName: clerkData.lastName,
    username: clerkData.username,
    imageUrl: clerkData.imageUrl,
    emailVerified: clerkData.emailAddresses[0]?.verification?.status === 'verified',
    lastLoginAt: new Date()
  };

  return this.create(userData);
};

userSchema.statics.getUsersToResetQuota = function(): Promise<UserDocument[]> {
  const now = new Date();
  return this.find({
    quotaResetDate: { $lte: now },
    isActive: true,
    isDeleted: false
  });
};

userSchema.statics.resetAllQuotas = async function(): Promise<void> {
  const usersToReset = await (this as UserModel).getUsersToResetQuota();
  
  const bulkOps = usersToReset.map((user: UserDocument) => ({
    updateOne: {
      filter: { _id: user._id },
      update: {
        monthlyUsage: 0,
        quotaResetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
      }
    }
  }));

  if (bulkOps.length > 0) {
    await this.bulkWrite(bulkOps);
  }
};

userSchema.statics.getActiveUsersCount = function(): Promise<number> {
  return this.countDocuments({ isActive: true, isDeleted: false });
};

userSchema.statics.getUsersByTier = function(tier: SubscriptionTier): Promise<UserDocument[]> {
  return this.find({ 
    subscriptionTier: tier, 
    isActive: true, 
    isDeleted: false 
  });
};

// Add virtual for id
userSchema.virtual('id').get(function(this: any) {
  return this._id?.toHexString();
});

// Add static methods for soft delete
addStaticMethods(userSchema);

// Pre-save middleware for data validation and normalization
userSchema.pre('save', function(this: any, next: any) {
  // Normalize email to lowercase
  if (this.email && typeof this.email === 'string') {
    this.email = this.email.toLowerCase();
  }
  
  // Generate username from name if not provided
  if (!this.username && this.name && typeof this.name === 'string') {
    this.username = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 20);
  }
  
  // Update lastLoginAt on first save
  if (this.isNew) {
    this.lastLoginAt = new Date();
  }
  
  next();
});

// Create and export the User model
export const UserModel = model<UserDocument, UserModel>('User', userSchema);