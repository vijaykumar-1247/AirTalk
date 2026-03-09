import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { PluginListenerHandle } from '@capacitor/core';

class BackgroundNotificationService {
  private appStateListener: PluginListenerHandle | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Request notification permissions
      const permission = await LocalNotifications.requestPermissions();
      if (permission.display !== 'granted') {
        console.warn('Notification permissions not granted');
        return;
      }

      // Listen to app state changes
      this.appStateListener = await App.addListener('appStateChange', async ({ isActive }) => {
        console.log('App state changed:', isActive ? 'active' : 'inactive');

        // When app becomes inactive, we can prepare for background notifications
        // The actual notification triggering will be handled by the message/callt handlers
      });

      this.isInitialized = true;
      console.log('Background notification service initialized');
    } catch (error) {
      console.error('Failed to initialize background notification service:', error);
    }
  }

  async showChatMessageNotification(message: {
    fromUserName: string;
    text?: string;
    hasAttachment?: boolean;
  }): Promise<void> {
    try {
      await LocalNotifications.schedule({
        notifications: [{
          title: `New message from ${message.fromUserName}`,
          body: message.hasAttachment
            ? '📎 Attachment received'
            : message.text || 'New message',
          id: Date.now(),
          sound: 'default',
          channelId: 'chat-messages',
        }],
      });
    } catch (error) {
      console.error('Failed to show chat message notification:', error);
    }
  }

  async showCallNotification(call: {
    fromUserName: string;
    callType: 'voice' | 'video';
  }): Promise<void> {
    try {
      await LocalNotifications.schedule({
        notifications: [{
          title: `Incoming ${call.callType} call`,
          body: `Call from ${call.fromUserName}`,
          id: Date.now(),
          sound: 'default',
          channelId: 'incoming-calls',
        }],
      });
    } catch (error) {
      console.error('Failed to show call notification:', error);
    }
  }

  async showFriendRequestNotification(request: {
    fromUserName: string;
    message?: string;
  }): Promise<void> {
    try {
      await LocalNotifications.schedule({
        notifications: [{
          title: 'New friend request',
          body: `Friend request from ${request.fromUserName}`,
          id: Date.now(),
          sound: 'default',
          channelId: 'friend-requests',
        }],
      });
    } catch (error) {
      console.error('Failed to show friend request notification:', error);
    }
  }

  async cleanup(): Promise<void> {
    if (this.appStateListener) {
      await this.appStateListener.remove();
      this.appStateListener = null;
    }
    this.isInitialized = false;
  }
}

export const backgroundNotificationService = new BackgroundNotificationService();