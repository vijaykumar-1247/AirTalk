import type { PluginListenerHandle } from "@capacitor/core";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { IncomingCallInvite } from "@/types/sparkmesh";

const INCOMING_CALL_ACTION_TYPE_ID = "incoming_call_actions";

const toNotificationId = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash) || 1;
};

export const isNativeCallNotificationSupported = () => Capacitor.isNativePlatform();

export const initializeNativeCallNotifications = async () => {
  if (!isNativeCallNotificationSupported()) return;

  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== "granted") {
    const requested = await LocalNotifications.requestPermissions();
    if (requested.display !== "granted") return;
  }

  await LocalNotifications.registerActionTypes({
    types: [
      {
        id: INCOMING_CALL_ACTION_TYPE_ID,
        actions: [
          {
            id: "accept",
            title: "Accept",
            foreground: true,
          },
          {
            id: "decline",
            title: "Decline",
            destructive: true,
            foreground: true,
          },
        ],
      },
    ],
  });
};

export const showNativeIncomingCallNotification = async (invite: IncomingCallInvite) => {
  if (!isNativeCallNotificationSupported()) return;

  const id = toNotificationId(invite.id);

  await LocalNotifications.cancel({
    notifications: [{ id }],
  });

  const callLabel = invite.callType === "voice" ? "Incoming audio call" : "Incoming video call";

  await LocalNotifications.schedule({
    notifications: [
      {
        id,
        title: "AirTalk",
        body: `${invite.senderName} • ${callLabel}`,
        actionTypeId: INCOMING_CALL_ACTION_TYPE_ID,
        extra: {
          inviteId: invite.id,
          senderId: invite.senderId,
          callRoomID: invite.callRoomID,
          callType: invite.callType,
        },
        ongoing: true,
        autoCancel: false,
        schedule: {
          at: new Date(Date.now() + 50),
        },
      },
    ],
  });
};

export const clearNativeIncomingCallNotification = async (inviteId?: string) => {
  if (!isNativeCallNotificationSupported()) return;

  if (inviteId) {
    await LocalNotifications.cancel({
      notifications: [{ id: toNotificationId(inviteId) }],
    });
    return;
  }

  await LocalNotifications.cancel({ notifications: [] });
};

export const onNativeIncomingCallAction = (
  handler: (payload: { actionId: string; inviteId?: string }) => void | Promise<void>
): Promise<PluginListenerHandle | null> => {
  if (!isNativeCallNotificationSupported()) return Promise.resolve(null);

  return LocalNotifications.addListener("localNotificationActionPerformed", async (event) => {
    const actionId = event.actionId;
    const inviteId = typeof event.notification.extra?.inviteId === "string" ? event.notification.extra.inviteId : undefined;

    await handler({ actionId, inviteId });
  });
};
