import { connectDB } from '../config/database';
import { UserModel, SubscriptionModel, ImageGenerationModel } from '../models';
import { SubscriptionTier, ImageGenerationType } from '../types';
import { config } from 'dotenv';

// Load environment variables
config();

interface SeedUser {
  clerkUserId: string;
  email: string;
  name: string;
  subscriptionTier: SubscriptionTier;
  monthlyUsage?: number;
  generateImages?: boolean;
  subscriptionOptions?: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    currentPeriodEnd?: Date;
    trialEnd?: Date;
  };
}

interface SeedImageGeneration {
  userIndex: number; // Index in the users array
  type: ImageGenerationType;
  prompt: string;
  status: 'completed' | 'failed' | 'processing';
  style?: string;
  aspectRatio?: string;
  quality?: 'standard' | 'hd';
  outputImages?: Array<{
    url: string;
    filename: string;
    size: number;
  }>;
}

// Seed data configuration
const seedUsers: SeedUser[] = [
  {
    clerkUserId: 'user_test_free_1',
    email: 'free.user@example.com',
    name: 'Free User',
    subscriptionTier: 'free',
    monthlyUsage: 5,
    generateImages: true
  },
  {
    clerkUserId: 'user_test_plus_1',
    email: 'plus.user@example.com',
    name: 'Plus User',
    subscriptionTier: 'plus',
    monthlyUsage: 25,
    generateImages: true,
    subscriptionOptions: {
      stripeCustomerId: 'cus_test_plus_1',
      stripeSubscriptionId: 'sub_test_plus_1',
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    }
  },
  {
    clerkUserId: 'user_test_pro_1',
    email: 'pro.user@example.com',
    name: 'Pro User',
    subscriptionTier: 'pro',
    monthlyUsage: 150,
    generateImages: true,
    subscriptionOptions: {
      stripeCustomerId: 'cus_test_pro_1',
      stripeSubscriptionId: 'sub_test_pro_1',
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    }
  },
  {
    clerkUserId: 'user_test_trial_1',
    email: 'trial.user@example.com',
    name: 'Trial User',
    subscriptionTier: 'plus',
    monthlyUsage: 10,
    generateImages: false,
    subscriptionOptions: {
      stripeCustomerId: 'cus_test_trial_1',
      trialEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
    }
  }
];

const seedImageGenerations: SeedImageGeneration[] = [
  // Free user generations
  {
    userIndex: 0,
    type: 'text-to-image',
    prompt: 'A beautiful sunset over mountains with vibrant colors',
    status: 'completed',
    style: 'realistic',
    aspectRatio: '16:9',
    quality: 'standard',
    outputImages: [{
      url: 'https://example.com/images/sunset-mountains.jpg',
      filename: 'sunset-mountains.jpg',
      size: 1024000
    }]
  },
  {
    userIndex: 0,
    type: 'text-to-image',
    prompt: 'A cute robot playing with a cat',
    status: 'completed',
    style: 'cartoon',
    aspectRatio: '1:1',
    quality: 'standard',
    outputImages: [{
      url: 'https://example.com/images/robot-cat.jpg',
      filename: 'robot-cat.jpg',
      size: 856000
    }]
  },

  // Plus user generations
  {
    userIndex: 1,
    type: 'text-to-image',
    prompt: 'Futuristic cityscape with flying cars at night',
    status: 'completed',
    style: 'cinematic',
    aspectRatio: '16:9',
    quality: 'hd',
    outputImages: [{
      url: 'https://example.com/images/futuristic-city.jpg',
      filename: 'futuristic-city.jpg',
      size: 2048000
    }]
  },
  {
    userIndex: 1,
    type: 'image-to-image',
    prompt: 'Transform this into a watercolor painting style',
    status: 'completed',
    style: 'watercolor',
    aspectRatio: '4:3',
    quality: 'hd',
    outputImages: [{
      url: 'https://example.com/images/watercolor-transform.jpg',
      filename: 'watercolor-transform.jpg',
      size: 1536000
    }]
  },

  // Pro user generations
  {
    userIndex: 2,
    type: 'text-to-image',
    prompt: 'Professional headshot of a business executive in modern office',
    status: 'completed',
    style: 'photographic',
    aspectRatio: '4:5',
    quality: 'hd',
    outputImages: [{
      url: 'https://example.com/images/business-headshot.jpg',
      filename: 'business-headshot.jpg',
      size: 1792000
    }]
  },
  {
    userIndex: 2,
    type: 'text-to-image',
    prompt: 'Abstract geometric patterns in blue and gold',
    status: 'failed',
    style: 'abstract',
    aspectRatio: '1:1',
    quality: 'standard'
  },
  {
    userIndex: 2,
    type: 'refine',
    prompt: 'Upscale this image to 4K resolution',
    status: 'processing',
    style: 'enhance',
    aspectRatio: '16:9',
    quality: 'hd'
  }
];

class DatabaseSeeder {
  private createdUsers: any[] = [];

  async seed(): Promise<void> {
    try {
      console.log('🌱 Starting database seeding...');
      
      // Connect to database
      await connectDB();
      
      // Clear existing data in development
      if (process.env.NODE_ENV === 'development') {
        await this.clearExistingData();
      }
      
      // Seed users and subscriptions
      await this.seedUsers();
      
      // Seed image generations
      await this.seedImageGenerations();
      
      console.log('✅ Database seeding completed successfully!');
      
    } catch (error) {
      console.error('❌ Error seeding database:', error);
      throw error;
    }
  }

  private async clearExistingData(): Promise<void> {
    console.log('🧹 Clearing existing seed data...');
    
    // Only clear test users (identified by clerk user IDs starting with 'user_test_')
    const testUserIds = seedUsers.map(u => u.clerkUserId);
    
    // Find test users
    const testUsers = await UserModel.find({ 
      clerkUserId: { $in: testUserIds } 
    });
    const testUserDbIds = testUsers.map(u => u._id);
    
    // Remove related data
    await ImageGenerationModel.deleteMany({ 
      userId: { $in: testUserDbIds } 
    });
    
    await SubscriptionModel.deleteMany({ 
      userId: { $in: testUserDbIds } 
    });
    
    await UserModel.deleteMany({ 
      clerkUserId: { $in: testUserIds } 
    });
    
    console.log(`🗑️  Cleared data for ${testUsers.length} test users`);
  }

  private async seedUsers(): Promise<void> {
    console.log('👥 Seeding users and subscriptions...');
    
    for (const userData of seedUsers) {
      // Create user
      const user = await UserModel.create({
        clerkUserId: userData.clerkUserId,
        email: userData.email,
        name: userData.name,
        subscriptionTier: userData.subscriptionTier,
        monthlyUsage: userData.monthlyUsage || 0,
        totalImagesGenerated: userData.monthlyUsage || 0,
        quotaResetDate: this.getNextMonthStart(),
        preferences: {
          defaultStyle: 'realistic',
          defaultAspectRatio: '1:1',
          defaultQuality: 'standard',
          saveToGallery: true,
          emailNotifications: true
        },
        settings: {
          privateGallery: false,
          allowDataCollection: true,
          theme: 'light',
          language: 'en'
        }
      });
      
      this.createdUsers.push(user);
      
      // Create subscription if needed
      if (userData.subscriptionTier !== 'free' || userData.subscriptionOptions) {
        await SubscriptionModel.create({
          userId: user._id,
          tier: userData.subscriptionTier,
          status: userData.subscriptionOptions?.trialEnd ? 'trialing' : 'active',
          stripeCustomerId: userData.subscriptionOptions?.stripeCustomerId,
          stripeSubscriptionId: userData.subscriptionOptions?.stripeSubscriptionId,
          currentPeriodStart: new Date(),
          currentPeriodEnd: userData.subscriptionOptions?.currentPeriodEnd || this.getNextMonthStart(),
          trialStart: userData.subscriptionOptions?.trialEnd ? new Date() : undefined,
          trialEnd: userData.subscriptionOptions?.trialEnd,
          metadata: {
            source: 'seed',
            createdBy: 'seeder'
          }
        });
      }
      
      console.log(`✨ Created user: ${userData.name} (${userData.subscriptionTier})`);
    }
  }

  private async seedImageGenerations(): Promise<void> {
    console.log('🎨 Seeding image generations...');
    
    let completedCount = 0;
    
    for (const genData of seedImageGenerations) {
      const user = this.createdUsers[genData.userIndex];
      
      if (!user) {
        console.warn(`⚠️  User at index ${genData.userIndex} not found, skipping generation`);
        continue;
      }
      
      const baseData = {
        userId: user._id,
        type: genData.type,
        prompt: genData.prompt,
        negativePrompt: genData.type === 'text-to-image' ? 'blurry, low quality, distorted' : undefined,
        style: genData.style || 'realistic',
        aspectRatio: genData.aspectRatio || '1:1',
        quality: genData.quality || 'standard',
        model: 'dall-e-3',
        status: genData.status,
        credits: 1,
        processingTime: genData.status === 'completed' ? Math.floor(Math.random() * 30) + 10 : undefined,
        metadata: {
          model: 'dall-e-3',
          version: '1.0',
          parameters: {
            style: genData.style || 'realistic',
            quality: genData.quality || 'standard'
          },
          source: 'seed'
        }
      };
      
      // Add output data for completed generations
      if (genData.status === 'completed' && genData.outputImages) {
        (baseData as any).outputImages = genData.outputImages;
        (baseData as any).completedAt = new Date();
      }
      
      // Add error message for failed generations
      if (genData.status === 'failed') {
        (baseData as any).errorMessage = 'Simulated generation failure for testing';
        (baseData as any).failedAt = new Date();
      }
      
      // Set processing timestamps for processing generations
      if (genData.status === 'processing') {
        (baseData as any).startedAt = new Date();
      }
      
      await ImageGenerationModel.create(baseData);
      completedCount++;
    }
    
    console.log(`🖼️  Created ${completedCount} image generations`);
  }

  private getNextMonthStart(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up seeded data...');
    await this.clearExistingData();
    console.log('✅ Cleanup completed');
  }
}

// CLI interface
async function main(): Promise<void> {
  const seeder = new DatabaseSeeder();
  
  const command = process.argv[2];
  
  try {
    switch (command) {
      case 'seed':
        await seeder.seed();
        break;
      case 'cleanup':
        await seeder.cleanup();
        break;
      case 'reset':
        await seeder.cleanup();
        await seeder.seed();
        break;
      default:
        console.log('Available commands:');
        console.log('  npm run seed        - Seed the database');
        console.log('  npm run seed:cleanup - Clean up seeded data');
        console.log('  npm run seed:reset   - Clean up and re-seed');
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Export for programmatic use
export { DatabaseSeeder, seedUsers, seedImageGenerations };
export default DatabaseSeeder;

// Run if called directly
if (require.main === module) {
  main();
}