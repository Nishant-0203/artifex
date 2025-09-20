# Database Implementation Documentation

This document provides comprehensive documentation for the MongoDB database implementation for the AI Image SaaS application using Mongoose ODM.

## Table of Contents
- [Overview](#overview)
- [Database Schema](#database-schema)
- [Models](#models)
- [Database Utilities](#database-utilities)
- [Seeding](#seeding)
- [Configuration](#configuration)
- [API Usage Examples](#api-usage-examples)
- [Maintenance](#maintenance)

## Overview

The database implementation uses MongoDB with Mongoose ODM to provide a robust, scalable data layer for the AI image generation SaaS application. The implementation includes:

- **User Management**: Clerk integration with subscription tracking
- **Subscription Management**: Multi-tier subscriptions with Stripe integration
- **Image Generation Tracking**: Comprehensive tracking of AI generation requests
- **Quota Management**: Monthly usage tracking and limits
- **Analytics**: User and system-wide analytics capabilities

### Key Features
- TypeScript-first design with comprehensive type safety
- Soft delete functionality across all models
- Automatic quota reset scheduling
- Comprehensive validation and error handling
- Built-in analytics and reporting utilities
- Database seeding for development and testing

## Database Schema

### Subscription Tiers
```typescript
const SUBSCRIPTION_QUOTAS = {
  free: 10,    // 10 images per month
  plus: 100,   // 100 images per month  
  pro: 1000    // 1000 images per month
};
```

### Core Models
1. **User**: User profiles with Clerk integration
2. **Subscription**: Subscription management with Stripe integration
3. **ImageGeneration**: AI image generation request tracking

## Models

### User Model (`/models/User.ts`)

Manages user profiles, subscription tiers, and quota tracking.

#### Key Features
- Clerk authentication integration
- Monthly quota tracking and automatic resets
- Subscription tier management
- User preferences and settings
- Soft delete support

#### Instance Methods
```typescript
// Quota management
user.canGenerateImages(credits?: number): boolean
user.incrementUsage(credits?: number): Promise<void>
user.resetMonthlyQuota(): Promise<void>
user.getRemainingQuota(): number

// Subscription management
user.updateSubscription(tier: SubscriptionTier): Promise<void>
user.getSubscriptionDetails(): Promise<Subscription | null>
```

#### Static Methods
```typescript
// User retrieval and analytics
UserModel.findByClerkId(clerkUserId: string)
UserModel.getActiveUsersCount()
UserModel.getUsersToResetQuota()
```

#### Schema Fields
```typescript
interface User {
  clerkUserId: string;           // Unique Clerk user ID
  email: string;                 // User email
  name: string;                  // Display name
  subscriptionTier: SubscriptionTier;
  monthlyUsage: number;          // Current month usage
  totalImagesGenerated: number;  // Lifetime generation count
  quotaResetDate: Date;          // Next quota reset date
  preferences: UserPreferences;   // UI/generation preferences
  settings: UserSettings;        // Account settings
  // Base fields: createdAt, updatedAt, isDeleted, deletedAt
}
```

### Subscription Model (`/models/Subscription.ts`)

Manages user subscriptions with Stripe integration.

#### Key Features
- Multi-tier subscription support (free, plus, pro)
- Stripe webhook integration
- Trial period support
- Automatic subscription status management
- Upgrade/downgrade functionality

#### Instance Methods
```typescript
// Subscription management
subscription.isActive(): boolean
subscription.isInTrial(): boolean
subscription.hasExpired(): boolean
subscription.getDaysUntilRenewal(): number
subscription.canUpgrade(newTier: SubscriptionTier): boolean
subscription.upgrade(newTier: SubscriptionTier): Promise<void>
subscription.downgrade(newTier: SubscriptionTier): Promise<void>
```

#### Static Methods
```typescript
// Subscription queries
SubscriptionModel.findByUserId(userId: string)
SubscriptionModel.findByTier(tier: SubscriptionTier)
SubscriptionModel.findByStripeId(stripeSubscriptionId: string)
SubscriptionModel.findExpiredSubscriptions()
SubscriptionModel.createFromStripe(stripeData: any)
```

#### Schema Fields
```typescript
interface Subscription {
  userId: ObjectId;              // Reference to User
  tier: SubscriptionTier;        // Subscription tier
  status: SubscriptionStatus;    // active, canceled, past_due, etc.
  stripeCustomerId?: string;     // Stripe customer ID
  stripeSubscriptionId?: string; // Stripe subscription ID
  currentPeriodStart: Date;      // Billing period start
  currentPeriodEnd: Date;        // Billing period end
  trialStart?: Date;             // Trial start date
  trialEnd?: Date;               // Trial end date
  cancelAtPeriodEnd: boolean;    // Cancel at period end flag
  metadata: Record<string, any>; // Additional data
}
```

### ImageGeneration Model (`/models/ImageGeneration.ts`)

Tracks AI image generation requests and results.

#### Key Features
- Multi-type generation support (text-to-image, image-to-image, etc.)
- Processing status tracking
- Cost calculation
- Output image management
- Analytics and reporting

#### Instance Methods
```typescript
// Status management
generation.markAsProcessing(): Promise<void>
generation.markAsCompleted(outputImages: OutputImage[]): Promise<void>
generation.markAsFailed(errorMessage: string): Promise<void>
generation.calculateCost(): number
```

#### Static Methods
```typescript
// Generation management
ImageGenerationModel.createGeneration(data: Partial<ImageGeneration>)
ImageGenerationModel.findByUser(userId: string, options?: QueryOptions)
ImageGenerationModel.findRecentByUser(userId: string, days?: number)
ImageGenerationModel.getUserStats(userId: string)
ImageGenerationModel.getSystemStats()
ImageGenerationModel.findStalledGenerations()
```

#### Schema Fields
```typescript
interface ImageGeneration {
  userId: ObjectId;              // Reference to User
  type: ImageGenerationType;     // Generation type
  prompt: string;                // Generation prompt
  negativePrompt?: string;       // Negative prompt
  style: string;                 // Art style
  aspectRatio: string;           // Image dimensions
  quality: 'standard' | 'hd';    // Generation quality
  model: string;                 // AI model used
  status: GenerationStatus;      // pending, processing, completed, failed
  credits: number;               // Credits consumed
  processingTime?: number;       // Processing duration (seconds)
  outputImages: OutputImage[];   // Generated images
  errorMessage?: string;         // Error details (if failed)
  metadata: GenerationMetadata;  // Additional generation data
  startedAt?: Date;              // Processing start time
  completedAt?: Date;            // Completion time
  failedAt?: Date;               // Failure time
}
```

## Database Utilities

### DatabaseUtils Class (`/utils/database.ts`)

Provides high-level utilities for common database operations.

#### Quota Management
```typescript
// Check if user has sufficient quota
const quotaCheck = await DatabaseUtils.checkUserQuota(userId, creditsRequired);

// Consume user quota
await DatabaseUtils.consumeUserQuota(userId, credits);

// Reset user quota manually
await DatabaseUtils.resetUserQuota(userId);
```

#### Subscription Validation
```typescript
// Validate user subscription status
const validation = await DatabaseUtils.validateUserSubscription(userId);

// Upgrade user subscription
const subscription = await DatabaseUtils.upgradeUserSubscription(userId, 'pro');
```

#### Image Generation
```typescript
// Create new image generation
const generation = await DatabaseUtils.createImageGeneration({
  userId: 'user123',
  type: 'text-to-image',
  prompt: 'A beautiful sunset',
  style: 'realistic'
});

// Get user generation history
const history = await DatabaseUtils.getImageGenerationHistory(userId, {
  limit: 20,
  status: 'completed'
});
```

#### Analytics
```typescript
// Get comprehensive user analytics
const analytics = await DatabaseUtils.getUserAnalytics(userId, 30);

// Get system-wide analytics
const systemAnalytics = await DatabaseUtils.getSystemAnalytics(30);
```

## Seeding

### Development Data Seeding

The seeding system provides realistic test data for development and testing.

#### Available Commands
```bash
# Seed the database with test data
npm run seed

# Clean up seeded data
npm run seed:cleanup

# Reset (cleanup + seed)
npm run seed:reset
```

#### Seed Data Includes
- **4 Test Users**: Free, Plus, Pro, and Trial users
- **Subscription Records**: Active subscriptions with Stripe integration
- **Image Generations**: Various generation types and statuses
- **Realistic Usage Patterns**: Different usage levels per tier

#### Seed Users
```typescript
// Free tier user
{
  clerkUserId: 'user_test_free_1',
  email: 'free.user@example.com',
  subscriptionTier: 'free',
  monthlyUsage: 5
}

// Plus tier user  
{
  clerkUserId: 'user_test_plus_1',
  email: 'plus.user@example.com', 
  subscriptionTier: 'plus',
  monthlyUsage: 25
}

// Pro tier user
{
  clerkUserId: 'user_test_pro_1',
  email: 'pro.user@example.com',
  subscriptionTier: 'pro', 
  monthlyUsage: 150
}
```

## Configuration

### Database Connection (`/config/database.ts`)

The database configuration handles MongoDB connection with automatic model initialization.

```typescript
import { connectDB } from '@/config/database';

// Connect to database (includes model initialization)
await connectDB();
```

#### Connection Features
- Automatic retry logic
- Connection pooling
- Model registration
- Event logging
- Graceful disconnection

### Environment Variables

Required environment variables:
```env
MONGODB_URI=mongodb://localhost:27017/artifex
NODE_ENV=development
```

## API Usage Examples

### User Management
```typescript
import { UserModel } from '@/models';

// Create user from Clerk webhook
const user = await UserModel.create({
  clerkUserId: 'user_123',
  email: 'user@example.com',
  name: 'John Doe',
  subscriptionTier: 'free'
});

// Check if user can generate images
if (user.canGenerateImages(2)) {
  // Proceed with generation
  await user.incrementUsage(2);
}

// Get user with subscription details
const userWithSubscription = await UserModel.findById(userId)
  .populate('subscription');
```

### Subscription Management
```typescript
import { SubscriptionModel } from '@/models';

// Handle Stripe webhook
const subscription = await SubscriptionModel.createFromStripe({
  customerId: 'cus_123',
  subscriptionId: 'sub_123',
  status: 'active',
  currentPeriodEnd: new Date('2024-02-01')
});

// Check subscription status
const userSubscription = await SubscriptionModel.findByUserId(userId);
if (userSubscription.isActive()) {
  // Allow premium features
}
```

### Image Generation Workflow
```typescript
import { ImageGenerationModel } from '@/models';
import { DatabaseUtils } from '@/utils/database';

// Check quota and create generation
const quotaCheck = await DatabaseUtils.checkUserQuota(userId);
if (!quotaCheck.allowed) {
  throw new Error('Insufficient quota');
}

const generation = await ImageGenerationModel.createGeneration({
  userId,
  type: 'text-to-image',
  prompt: 'A majestic mountain landscape',
  style: 'realistic'
});

// Process generation (in your AI service)
await generation.markAsProcessing();

// Complete generation
await generation.markAsCompleted([{
  url: 'https://example.com/image.jpg',
  filename: 'mountain.jpg',
  size: 1024000
}]);

// Update user quota
await DatabaseUtils.consumeUserQuota(userId, 1);
```

### Analytics and Reporting
```typescript
import { DatabaseUtils } from '@/utils/database';

// Get user analytics dashboard data
const userAnalytics = await DatabaseUtils.getUserAnalytics(userId, 30);
console.log('User Analytics:', {
  remainingQuota: userAnalytics.user.remainingQuota,
  totalGenerated: userAnalytics.user.totalImagesGenerated,
  dailyUsage: userAnalytics.analytics.dailyGenerations
});

// Get system-wide metrics
const systemMetrics = await DatabaseUtils.getSystemAnalytics(7);
console.log('System Metrics:', {
  totalUsers: systemMetrics.overview.totalUsers,
  dailyGenerations: systemMetrics.trends.dailyTrends
});
```

## Maintenance

### Automated Quota Resets
```typescript
import { UserModel } from '@/models';

// Reset quotas for users whose reset date has passed
const usersToReset = await UserModel.getUsersToResetQuota();
for (const user of usersToReset) {
  await user.resetMonthlyQuota();
}
```

### Cleanup Operations
```typescript
import { DatabaseUtils } from '@/utils/database';

// Perform maintenance cleanup
const results = await DatabaseUtils.performMaintenanceCleanup();
console.log('Cleanup Results:', results);
// {
//   oldGenerationsRemoved: 150,
//   failedGenerationsRemoved: 25,
//   subscriptionsUpdated: 5
// }
```

### Database Health Checks
```typescript
import { getConnectionInfo } from '@/config/database';

// Check database connection status
const dbInfo = getConnectionInfo();
if (!dbInfo.isConnected) {
  // Handle disconnection
  await connectDB();
}
```

## Error Handling

### Common Error Patterns
```typescript
try {
  await DatabaseUtils.checkUserQuota(userId);
} catch (error) {
  if (error.message === 'User not found') {
    // Handle missing user
  } else if (error.message === 'Insufficient quota remaining') {
    // Handle quota exceeded
  }
}
```

### Validation Errors
```typescript
try {
  const user = await UserModel.create(userData);
} catch (error) {
  if (error.name === 'ValidationError') {
    // Handle validation errors
    console.log('Validation errors:', error.errors);
  }
}
```

## Performance Considerations

### Indexing Strategy
- Compound indexes on frequently queried fields
- User lookups by Clerk ID (unique index)
- Generation queries by user and date range
- Subscription lookups by Stripe IDs

### Query Optimization
- Use lean queries for analytics
- Populate relationships selectively
- Implement pagination for large datasets
- Cache frequently accessed data

### Monitoring
- Track query performance
- Monitor connection pool usage
- Set up alerts for quota limits
- Log slow queries for optimization

## Security

### Data Protection
- Soft delete prevents accidental data loss
- User data isolation by Clerk ID
- Subscription data encrypted at rest
- Audit trails for critical operations

### Access Control
- Model-level validation
- Field-level permissions
- Stripe webhook signature verification
- Rate limiting on quota operations

---

This database implementation provides a solid foundation for the AI Image SaaS application with comprehensive user management, subscription handling, and image generation tracking capabilities.