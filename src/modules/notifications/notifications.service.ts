import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PushNotification {
  title: string;
  body: string;
  data?: Record<string, string>;
  image?: string;
  sound?: string;
  badge?: number;
  priority?: 'high' | 'normal';
}

export interface NotificationPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  type?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private firebaseApp: any;

  constructor(private configService: ConfigService) {
    this.initFirebase();
  }

  private initFirebase(): void {
    try {
      const serviceAccountPath =
        this.configService.get<string>('app.firebaseServiceAccount');
      if (serviceAccountPath) {
        const admin = require('firebase-admin');
        const serviceAccount = JSON.parse(
          Buffer.from(serviceAccountPath, 'base64').toString(),
        );
        this.firebaseApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: this.configService.get<string>('app.firebaseDatabaseUrl'),
        });
        this.logger.log('Firebase initialized successfully');
      } else {
        this.logger.warn('Firebase service account not configured');
      }
    } catch (error) {
      this.logger.error(`Firebase init error: ${error.message}`);
    }
  }

  async sendPushNotification(
    deviceToken: string,
    notification: PushNotification,
  ): Promise<boolean> {
    if (!this.firebaseApp) {
      this.logger.warn('Firebase not initialized, skipping push notification');
      return false;
    }

    try {
      const message: any = {
        token: deviceToken,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: notification.data || {},
        android: {
          priority: notification.priority || 'high',
          notification: {
            sound: notification.sound || 'default',
            image: notification.image,
            channelId: 'food_delivery_channel',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: notification.sound || 'default',
              badge: notification.badge || 1,
              contentAvailable: true,
            },
          },
          fcmOptions: {
            image: notification.image,
          },
        },
      };

      const response = await this.firebaseApp.messaging().send(message);
      this.logger.log(`Push notification sent: ${response}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send push notification: ${error.message}`);
      return false;
    }
  }

  async sendMulticast(
    deviceTokens: string[],
    notification: PushNotification,
  ): Promise<{ success: number; failure: number }> {
    if (!this.firebaseApp || deviceTokens.length === 0) {
      return { success: 0, failure: 0 };
    }

    try {
      const message: any = {
        tokens: deviceTokens,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: notification.data || {},
        android: {
          priority: notification.priority || 'high',
        },
      };

      const response = await this.firebaseApp.messaging().sendEachForMulticast(message);
      this.logger.log(
        `Multicast sent: ${response.successCount} success, ${response.failureCount} failure`,
      );
      return {
        success: response.successCount,
        failure: response.failureCount,
      };
    } catch (error) {
      this.logger.error(`Multicast send failed: ${error.message}`);
      return { success: 0, failure: deviceTokens.length };
    }
  }

  async sendToTopic(
    topic: string,
    notification: PushNotification,
  ): Promise<boolean> {
    if (!this.firebaseApp) return false;

    try {
      const message: any = {
        topic,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: notification.data || {},
      };

      await this.firebaseApp.messaging().send(message);
      this.logger.log(`Topic notification sent to ${topic}`);
      return true;
    } catch (error) {
      this.logger.error(`Topic send failed: ${error.message}`);
      return false;
    }
  }

  async sendOrderStatusUpdate(
    deviceToken: string,
    orderId: string,
    status: string,
    orderNumber: string,
  ): Promise<boolean> {
    const statusMessages = {
      confirmed: 'Your order has been confirmed!',
      preparing: 'Your food is being prepared!',
      ready: 'Your order is ready for pickup!',
      picked_up: 'Your order has been picked up by the courier!',
      delivering: 'Your order is on its way!',
      delivered: 'Your order has been delivered! Enjoy your meal!',
      cancelled: 'Your order has been cancelled.',
    };

    return this.sendPushNotification(deviceToken, {
      title: `Order #${orderNumber}`,
      body: statusMessages[status] || `Order status updated to ${status}`,
      data: {
        orderId,
        status,
        orderNumber,
        type: 'order_update',
      },
      priority: 'high',
    });
  }

  async sendPromotionalNotification(
    deviceTokens: string[],
    title: string,
    body: string,
    imageUrl?: string,
    deepLink?: string,
  ): Promise<{ success: number; failure: number }> {
    return this.sendMulticast(deviceTokens, {
      title,
      body,
      image: imageUrl,
      data: {
        type: 'promotional',
        link: deepLink || '',
      },
      priority: 'normal',
    });
  }

  async sendCustomNotification(
    deviceToken: string,
    payload: NotificationPayload,
  ): Promise<boolean> {
    return this.sendPushNotification(deviceToken, {
      title: payload.title,
      body: payload.body,
      data: {
        ...payload.data,
        type: payload.type || 'general',
      },
    });
  }

  async subscribeToTopic(
    deviceTokens: string[],
    topic: string,
  ): Promise<boolean> {
    if (!this.firebaseApp) return false;

    try {
      await this.firebaseApp.messaging().subscribeToTopic(deviceTokens, topic);
      this.logger.log(`Subscribed ${deviceTokens.length} tokens to ${topic}`);
      return true;
    } catch (error) {
      this.logger.error(`Topic subscription failed: ${error.message}`);
      return false;
    }
  }

  async unsubscribeFromTopic(
    deviceTokens: string[],
    topic: string,
  ): Promise<boolean> {
    if (!this.firebaseApp) return false;

    try {
      await this.firebaseApp
        .messaging()
        .unsubscribeFromTopic(deviceTokens, topic);
      this.logger.log(
        `Unsubscribed ${deviceTokens.length} tokens from ${topic}`,
      );
      return true;
    } catch (error) {
      this.logger.error(`Topic unsubscription failed: ${error.message}`);
      return false;
    }
  }
}
