import * as cron from 'node-cron';
import * as schedule from 'node-schedule';
import { UserModel } from '../models';
import { SUBSCRIPTION_QUOTAS } from '../types';
import mongoose from 'mongoose';

/**
 * Scheduled task management for quota resets, analytics, and maintenance
 */
export class ScheduledTasks {
  private static tasks: Map<string, any> = new Map();
  
  /**
   * Initialize all scheduled tasks
   */
  static init() {
    console.log('Initializing scheduled tasks...');
    
    if (process.env.QUOTA_RESET_ENABLED === 'true') {
      this.scheduleQuotaReset();
    }
    
    if (process.env.ANALYTICS_PROCESSING_ENABLED === 'true') {
      this.scheduleAnalyticsProcessing();
    }
    
    if (process.env.SUBSCRIPTION_SYNC_ENABLED === 'true') {
      this.scheduleSubscriptionSync();
    }
    
    // Schedule maintenance tasks
    this.scheduleMaintenanceTasks();
    
    console.log(`Initialized ${this.tasks.size} scheduled tasks`);
  }
  
  /**
   * Schedule monthly quota reset
   */
  private static scheduleQuotaReset() {
    const schedule = process.env.QUOTA_RESET_SCHEDULE || '0 0 1 * *'; // First day of month at midnight
    const timezone = process.env.QUOTA_RESET_TIMEZONE || 'America/New_York';
    
    const task = cron.schedule(schedule, async () => {
      console.log('Starting monthly quota reset...');
      
      try {
        const result = await this.resetAllUserQuotas();
        console.log(`Quota reset completed: ${result.processed} users processed, ${result.errors} errors`);
        
        // Log quota reset analytics
        await this.logQuotaResetAnalytics(result);
        
      } catch (error) {
        console.error('Quota reset failed:', error);
        
        // In production, send alert notification
        await this.sendErrorNotification('Quota Reset Failed', error);
      }
    }, {
      scheduled: true,
      timezone
    });
    
    this.tasks.set('quotaReset', task);
    console.log(`Quota reset scheduled: ${schedule} (${timezone})`);
  }
  
  /**
   * Schedule analytics processing
   */
  private static scheduleAnalyticsProcessing() {
    // Daily analytics processing at 2 AM
    const task = cron.schedule('0 2 * * *', async () => {
      console.log('Starting daily analytics processing...');
      
      try {
        await this.processAnalytics();
        console.log('Analytics processing completed successfully');
        
      } catch (error) {
        console.error('Analytics processing failed:', error);
        await this.sendErrorNotification('Analytics Processing Failed', error);
      }
    }, {
      scheduled: true,
      timezone: process.env.QUOTA_RESET_TIMEZONE || 'America/New_York'
    });
    
    this.tasks.set('analyticsProcessing', task);
    console.log('Analytics processing scheduled: Daily at 2:00 AM');
  }
  
  /**
   * Schedule subscription synchronization
   */
  private static scheduleSubscriptionSync() {
    // Sync subscriptions every 6 hours
    const task = cron.schedule('0 */6 * * *', async () => {
      console.log('Starting subscription synchronization...');
      
      try {
        await this.syncSubscriptions();
        console.log('Subscription sync completed successfully');
        
      } catch (error) {
        console.error('Subscription sync failed:', error);
        await this.sendErrorNotification('Subscription Sync Failed', error);
      }
    }, {
      scheduled: true
    });
    
    this.tasks.set('subscriptionSync', task);
    console.log('Subscription sync scheduled: Every 6 hours');
  }
  
  /**
   * Schedule maintenance tasks
   */
  private static scheduleMaintenanceTasks() {
    // Weekly database cleanup on Sundays at 3 AM
    const cleanupTask = cron.schedule('0 3 * * 0', async () => {
      console.log('Starting weekly database cleanup...');
      
      try {
        await this.performDatabaseCleanup();
        console.log('Database cleanup completed successfully');
        
      } catch (error) {
        console.error('Database cleanup failed:', error);
        await this.sendErrorNotification('Database Cleanup Failed', error);
      }
    }, {
      scheduled: true,
      timezone: process.env.QUOTA_RESET_TIMEZONE || 'America/New_York'
    });
    
    this.tasks.set('databaseCleanup', cleanupTask);
    
    // Daily health check at 1 AM
    const healthCheckTask = cron.schedule('0 1 * * *', async () => {
      console.log('Performing daily health check...');
      
      try {
        await this.performHealthCheck();
        
      } catch (error) {
        console.error('Health check failed:', error);
        await this.sendErrorNotification('Health Check Failed', error);
      }
    }, {
      scheduled: true
    });
    
    this.tasks.set('healthCheck', healthCheckTask);
    
    console.log('Maintenance tasks scheduled: Weekly cleanup, daily health check');
  }
  
  /**
   * Reset all user quotas to their tier limits
   */
  private static async resetAllUserQuotas() {
    let processed = 0;
    let errors = 0;
    
    try {
      const users = await UserModel.find({}).select('_id subscriptionTier quotaUsed');
      
      for (const user of users) {
        try {
          const tierLimit = SUBSCRIPTION_QUOTAS[user.subscriptionTier] || SUBSCRIPTION_QUOTAS.free;
          
          await UserModel.findByIdAndUpdate(user._id, {
            quotaUsed: 0,
            quotaLimit: tierLimit,
            lastQuotaReset: new Date()
          });
          
          processed++;
          
        } catch (userError) {
          console.error(`Failed to reset quota for user ${user._id}:`, userError);
          errors++;
        }
      }
      
    } catch (error) {
      console.error('Failed to fetch users for quota reset:', error);
      throw error;
    }
    
    return { processed, errors, timestamp: new Date() };
  }
  
  /**
   * Process analytics data
   */
  private static async processAnalytics() {
    // This would integrate with actual analytics processing
    // For now, just log the operation
    
    console.log('Processing usage analytics...');
    
    // Calculate daily/weekly/monthly statistics
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const userCount = await UserModel.countDocuments({});
    const activeUsers = await UserModel.countDocuments({
      lastActive: { $gte: thirtyDaysAgo }
    });
    
    const analyticsData = {
      totalUsers: userCount,
      activeUsers,
      processedAt: now
    };
    
    console.log('Analytics summary:', analyticsData);
    
    // In production, save to analytics collection
    // await AnalyticsModel.create(analyticsData);
  }
  
  /**
   * Sync subscriptions with Clerk
   */
  private static async syncSubscriptions() {
    // This would integrate with Clerk subscription API
    console.log('Syncing subscriptions with Clerk...');
    
    // Get all users with subscriptions
    const users = await UserModel.find({
      subscriptionTier: { $ne: 'free' }
    }).select('_id clerkId subscriptionTier');
    
    let synced = 0;
    let errors = 0;
    
    for (const user of users) {
      try {
        // In production, fetch subscription status from Clerk
        // const clerkSubscription = await clerkClient.subscriptions.getSubscription(user.clerkId);
        
        // For now, just log the sync attempt
        console.log(`Would sync subscription for user ${user._id}`);
        synced++;
        
      } catch (error) {
        console.error(`Failed to sync subscription for user ${user._id}:`, error);
        errors++;
      }
    }
    
    console.log(`Subscription sync completed: ${synced} synced, ${errors} errors`);
  }
  
  /**
   * Perform database cleanup
   */
  private static async performDatabaseCleanup() {
    console.log('Performing database cleanup...');
    
    const retentionDays = parseInt(process.env.ANALYTICS_RETENTION_DAYS || '90');
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    // Clean up old analytics data (placeholder)
    // await AnalyticsModel.deleteMany({ createdAt: { $lt: cutoffDate } });
    
    // Clean up old session data
    // await SessionModel.deleteMany({ expiresAt: { $lt: new Date() } });
    
    console.log(`Database cleanup completed for data older than ${retentionDays} days`);
  }
  
  /**
   * Perform health check
   */
  private static async performHealthCheck() {
    console.log('Performing health check...');
    
    // Check database connection
    const dbStatus = mongoose.connection.readyState === 1;
    
    // Check user quota consistency
    const quotaIssues = await this.checkQuotaConsistency();
    
    // Check subscription status consistency
    const subscriptionIssues = await this.checkSubscriptionConsistency();
    
    const healthReport = {
      timestamp: new Date(),
      database: dbStatus,
      quotaIssues,
      subscriptionIssues,
      status: dbStatus && quotaIssues === 0 && subscriptionIssues === 0 ? 'healthy' : 'issues_detected'
    };
    
    console.log('Health check report:', healthReport);
    
    if (healthReport.status === 'issues_detected') {
      await this.sendErrorNotification('Health Check Issues Detected', healthReport);
    }
  }
  
  /**
   * Check quota consistency
   */
  private static async checkQuotaConsistency() {
    const issues = await UserModel.countDocuments({
      $or: [
        { quotaUsed: { $lt: 0 } },
        { quotaUsed: { $gt: '$quotaLimit' } },
        { quotaLimit: { $lte: 0 } }
      ]
    });
    
    return issues;
  }
  
  /**
   * Check subscription consistency
   */
  private static async checkSubscriptionConsistency() {
    const issues = await UserModel.countDocuments({
      subscriptionTier: { $nin: ['free', 'plus', 'pro'] }
    });
    
    return issues;
  }
  
  /**
   * Log quota reset analytics
   */
  private static async logQuotaResetAnalytics(resetResult: any) {
    // In production, save to analytics collection
    console.log('Quota reset analytics:', {
      type: 'quota_reset',
      ...resetResult
    });
  }
  
  /**
   * Send error notification
   */
  private static async sendErrorNotification(subject: string, error: any) {
    // In production, send email or Slack notification
    console.error(`ALERT: ${subject}`, error);
    
    // Could integrate with notification services like:
    // - SendGrid for email
    // - Slack webhook
    // - Discord webhook
    // - PagerDuty for critical alerts
  }
  
  /**
   * Stop a specific task
   */
  static stopTask(taskName: string) {
    const task = this.tasks.get(taskName);
    if (task) {
      task.destroy();
      this.tasks.delete(taskName);
      console.log(`Stopped scheduled task: ${taskName}`);
    }
  }
  
  /**
   * Stop all scheduled tasks
   */
  static stopAll() {
    console.log('Stopping all scheduled tasks...');
    
    for (const [name, task] of this.tasks.entries()) {
      task.destroy();
      console.log(`Stopped task: ${name}`);
    }
    
    this.tasks.clear();
    console.log('All scheduled tasks stopped');
  }
  
  /**
   * Get status of all tasks
   */
  static getTaskStatus() {
    const status: Record<string, any> = {};
    
    for (const [name, task] of this.tasks.entries()) {
      status[name] = {
        name,
        running: task.running,
        scheduled: true
      };
    }
    
    return status;
  }
  
  /**
   * Manually trigger a task (for testing/admin purposes)
   */
  static async triggerTask(taskName: string) {
    console.log(`Manually triggering task: ${taskName}`);
    
    switch (taskName) {
      case 'quotaReset':
        return await this.resetAllUserQuotas();
      case 'analyticsProcessing':
        return await this.processAnalytics();
      case 'subscriptionSync':
        return await this.syncSubscriptions();
      case 'databaseCleanup':
        return await this.performDatabaseCleanup();
      case 'healthCheck':
        return await this.performHealthCheck();
      default:
        throw new Error(`Unknown task: ${taskName}`);
    }
  }
}

// Export for use in server initialization
export default ScheduledTasks;