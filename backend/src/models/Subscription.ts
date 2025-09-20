import { Schema, model, Model } from 'mongoose';
import { createBaseSchema, addStaticMethods, BaseDocument, validators } from './base';
import { Subscription as ISubscription, SubscriptionTier, ClerkSubscriptionStatus, SUBSCRIPTION_QUOTAS } from '../types';

// Subscription document interface extending base document
export interface SubscriptionDocument extends BaseDocument, Omit<ISubscription, 'id'> {
  // Clerk-specific fields
  clerkSubscriptionId?: string;
  clerkPlanId?: string;
  clerkCustomerId?: string;
  status: ClerkSubscriptionStatus;
  
  // Instance methods
  isActive(): boolean;
  isInTrial(): boolean;
  hasExpired(): boolean;
  canUpgrade(newTier: SubscriptionTier): boolean;
  canDowngrade(newTier: SubscriptionTier): boolean;
  getDaysUntilRenewal(): number;
  getQuotaForTier(): number;
  cancel(immediately?: boolean): Promise<SubscriptionDocument>;
  reactivate(): Promise<SubscriptionDocument>;
  upgrade(newTier: SubscriptionTier): Promise<SubscriptionDocument>;
  downgrade(newTier: SubscriptionTier): Promise<SubscriptionDocument>;
}

// Subscription model interface with static methods
export interface SubscriptionModel extends Model<SubscriptionDocument> {
  findByUserId(userId: string): Promise<SubscriptionDocument | null>;
  findByClerkId(clerkSubscriptionId: string): Promise<SubscriptionDocument | null>;
  findActiveSubscriptions(): Promise<SubscriptionDocument[]>;
  findExpiredSubscriptions(): Promise<SubscriptionDocument[]>;
  findTrialEndingSoon(days: number): Promise<SubscriptionDocument[]>;
  findByTier(tier: SubscriptionTier): Promise<SubscriptionDocument[]>;
  createFromClerk(clerkData: any): Promise<SubscriptionDocument>;
  updateFromClerk(clerkId: string, clerkData: any): Promise<SubscriptionDocument | null>;
}

// Subscription schema definition
const subscriptionSchemaDefinition = {
  userId: {
    type: String,
    required: [true, 'User ID is required'],
    ref: 'User',
    index: true
  },
  tier: {
    ...validators.enumValidator(['free', 'plus', 'pro'], 'subscription tier'),
    required: [true, 'Subscription tier is required'],
    index: true
  },
  status: {
    ...validators.enumValidator([
      'active', 
      'inactive',
      'trialing', 
      'past_due', 
      'canceled',
      'incomplete',
      'paused'
    ], 'subscription status'),
    required: [true, 'Subscription status is required'],
    index: true
  },
  clerkCustomerId: {
    type: String,
    sparse: true,
    index: true
  },
  clerkSubscriptionId: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  clerkPlanId: {
    type: String,
    required: function(this: SubscriptionDocument) {
      return this.tier !== 'free';
    }
  },
  currentPeriodStart: {
    type: Date,
    required: [true, 'Current period start is required'],
    index: true
  },
  currentPeriodEnd: {
    type: Date,
    required: [true, 'Current period end is required'],
    index: true
  },
  cancelAtPeriodEnd: {
    type: Boolean,
    default: false,
    index: true
  },
  canceledAt: {
    type: Date
  },
  trialStart: {
    type: Date
  },
  trialEnd: {
    type: Date,
    index: true
  },
  lastPaymentAt: {
    type: Date
  },
  nextPaymentAt: {
    type: Date,
    index: true
  },
  paymentFailures: {
    type: Number,
    default: 0,
    min: [0, 'Payment failures cannot be negative']
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  }
};

// Create the subscription schema
const subscriptionSchema = createBaseSchema(subscriptionSchemaDefinition);

// Add compound indexes for efficient querying
subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ stripeCustomerId: 1, status: 1 });
subscriptionSchema.index({ tier: 1, status: 1 });
subscriptionSchema.index({ status: 1, currentPeriodEnd: 1 });
subscriptionSchema.index({ trialEnd: 1, status: 1 });
subscriptionSchema.index({ nextPaymentAt: 1, status: 1 });

// Instance methods
subscriptionSchema.methods.isActive = function(): boolean {
  return this.status === 'active';
};

subscriptionSchema.methods.isInTrial = function(): boolean {
  return this.status === 'trialing' && 
         this.trialEnd && 
         new Date() < this.trialEnd;
};

subscriptionSchema.methods.hasExpired = function(): boolean {
  return new Date() > this.currentPeriodEnd;
};

subscriptionSchema.methods.canUpgrade = function(newTier: SubscriptionTier): boolean {
  const tierOrder = { free: 0, plus: 1, pro: 2 };
  return tierOrder[newTier] > tierOrder[this.tier as SubscriptionTier];
};

subscriptionSchema.methods.canDowngrade = function(newTier: SubscriptionTier): boolean {
  const tierOrder = { free: 0, plus: 1, pro: 2 };
  return tierOrder[newTier] < tierOrder[this.tier as SubscriptionTier];
};

subscriptionSchema.methods.getDaysUntilRenewal = function(): number {
  const now = new Date();
  const renewalDate = this.nextPaymentAt || this.currentPeriodEnd;
  const diffTime = renewalDate.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

subscriptionSchema.methods.getQuotaForTier = function(): number {
  return SUBSCRIPTION_QUOTAS[this.tier as SubscriptionTier];
};

subscriptionSchema.methods.cancel = async function(immediately: boolean = false): Promise<SubscriptionDocument> {
  if (immediately) {
    this.status = 'canceled';
    this.canceledAt = new Date();
  } else {
    this.cancelAtPeriodEnd = true;
  }
  return this.save();
};

subscriptionSchema.methods.reactivate = async function(): Promise<SubscriptionDocument> {
  this.status = 'active';
  this.cancelAtPeriodEnd = false;
  this.canceledAt = null;
  return this.save();
};

subscriptionSchema.methods.upgrade = async function(newTier: SubscriptionTier): Promise<SubscriptionDocument> {
  if (!this.canUpgrade(newTier)) {
    throw new Error(`Cannot upgrade from ${this.tier} to ${newTier}`);
  }
  this.tier = newTier;
  return this.save();
};

subscriptionSchema.methods.downgrade = async function(newTier: SubscriptionTier): Promise<SubscriptionDocument> {
  if (!this.canDowngrade(newTier)) {
    throw new Error(`Cannot downgrade from ${this.tier} to ${newTier}`);
  }
  this.tier = newTier;
  return this.save();
};

// Static methods
subscriptionSchema.statics.findByUserId = function(userId: string): Promise<SubscriptionDocument | null> {
  return this.findOne({ userId, isDeleted: false }).sort({ createdAt: -1 });
};

subscriptionSchema.statics.findByStripeId = function(stripeSubscriptionId: string): Promise<SubscriptionDocument | null> {
  return this.findOne({ stripeSubscriptionId, isDeleted: false });
};

subscriptionSchema.statics.findActiveSubscriptions = function(): Promise<SubscriptionDocument[]> {
  return this.find({ 
    status: 'active',
    isDeleted: false 
  }).sort({ createdAt: -1 });
};

subscriptionSchema.statics.findExpiredSubscriptions = function(): Promise<SubscriptionDocument[]> {
  const now = new Date();
  return this.find({
    currentPeriodEnd: { $lt: now },
    status: { $in: ['active', 'past_due'] },
    isDeleted: false
  }).sort({ currentPeriodEnd: 1 });
};

subscriptionSchema.statics.findTrialEndingSoon = function(days: number = 7): Promise<SubscriptionDocument[]> {
  const now = new Date();
  const endDate = new Date(now.getTime() + (days * 24 * 60 * 60 * 1000));
  
  return this.find({
    status: 'trialing',
    trialEnd: {
      $gte: now,
      $lte: endDate
    },
    isDeleted: false
  }).sort({ trialEnd: 1 });
};

subscriptionSchema.statics.findByTier = function(tier: SubscriptionTier): Promise<SubscriptionDocument[]> {
  return this.find({ 
    tier, 
    status: 'active',
    isDeleted: false 
  }).sort({ createdAt: -1 });
};

subscriptionSchema.statics.findByClerkId = function(clerkSubscriptionId: string): Promise<SubscriptionDocument | null> {
  return this.findOne({ 
    clerkSubscriptionId, 
    isDeleted: false 
  });
};

subscriptionSchema.statics.createFromClerk = async function(clerkData: any): Promise<SubscriptionDocument> {
  const subscriptionData = {
    userId: clerkData.metadata?.userId,
    tier: clerkData.metadata?.tier || 'plus',
    status: clerkData.status,
    clerkCustomerId: clerkData.customer_id,
    clerkSubscriptionId: clerkData.subscription_id,
    clerkPlanId: clerkData.plan_id,
    currentPeriodStart: new Date(clerkData.current_period_start * 1000),
    currentPeriodEnd: new Date(clerkData.current_period_end * 1000),
    cancelAtPeriodEnd: clerkData.cancel_at_period_end,
    trialStart: clerkData.trial_start ? new Date(clerkData.trial_start * 1000) : null,
    trialEnd: clerkData.trial_end ? new Date(clerkData.trial_end * 1000) : null,
    metadata: clerkData.metadata || {}
  };

  return this.create(subscriptionData);
};

subscriptionSchema.statics.updateFromClerk = async function(
  clerkId: string, 
  clerkData: any
): Promise<SubscriptionDocument | null> {
  const subscription = await (this as SubscriptionModel).findByClerkId(clerkId);
  
  if (!subscription) {
    return null;
  }

  subscription.status = clerkData.status;
  subscription.currentPeriodStart = new Date(clerkData.current_period_start * 1000);
  subscription.currentPeriodEnd = new Date(clerkData.current_period_end * 1000);
  subscription.cancelAtPeriodEnd = clerkData.cancel_at_period_end;
  
  if (clerkData.canceled_at) {
    subscription.canceledAt = new Date(clerkData.canceled_at * 1000);
  }
  
  if (clerkData.trial_start) {
    subscription.trialStart = new Date(clerkData.trial_start * 1000);
  }
  
  if (clerkData.trial_end) {
    subscription.trialEnd = new Date(clerkData.trial_end * 1000);
  }
  
  subscription.metadata = { ...subscription.metadata, ...clerkData.metadata };

  return subscription.save();
};

// Add virtual for id
subscriptionSchema.virtual('id').get(function(this: any) {
  return this._id?.toHexString();
});

// Add static methods for soft delete
addStaticMethods(subscriptionSchema);

// Pre-save middleware
subscriptionSchema.pre('save', function(this: any, next: any) {
  // Set default period for free tier
  if (this.tier === 'free' && this.isNew) {
    const now = new Date();
    this.currentPeriodStart = now;
    this.currentPeriodEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
  }
  
  // Set next payment date for active subscriptions
  if (this.status === 'active' && !this.nextPaymentAt && this.tier !== 'free') {
    this.nextPaymentAt = this.currentPeriodEnd;
  }
  
  next();
});

// Post-save middleware to update user's subscription tier
subscriptionSchema.post('save', async function(this: SubscriptionDocument) {
  if (this.isActive() || this.isInTrial()) {
    const User = require('./User').UserModel;
    await User.findOneAndUpdate(
      { _id: this.userId },
      { 
        subscriptionTier: this.tier,
        subscriptionId: this.id
      }
    );
  }
});

// Create and export the Subscription model
export const SubscriptionModel = model<SubscriptionDocument, SubscriptionModel>('Subscription', subscriptionSchema);