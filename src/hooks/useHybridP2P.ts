import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { hybridP2PEngine, type OfflinePeerState } from '@/lib/hybrid-p2p-engine';
import { localMessagingEngine, type LocalMessage } from '@/lib/local-messaging';

export interface OfflinePeerUIState extends OfflinePeerState {
  isSelected?: boolean;
  unreadMessageCount: number;
}

export const useHybridP2P = (localUserId: string, localUserName: string, localDeviceId: string) => {
  const [peerStates, setPeerStates] = useState<OfflinePeerUIState[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [messages, setMessages] = useState<Map<string, LocalMessage[]>>(new Map());
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map());
  const messageCounterRef = useRef<Map<string, number>>(new Map());

  // Initialize engine and start discovery
  useEffect(() => {
    const initialize = async () => {
      if (!Capacitor.isNativePlatform()) {
        console.log('[useHybridP2P] Skipping on web platform');
        return;
      }

      setIsDiscovering(true);
      try {
        await hybridP2PEngine.startBLEDiscovery(localUserId, localUserName);
      } catch (error) {
        console.error('[useHybridP2P] Initialization error:', error);
      } finally {
        setIsDiscovering(false);
      }
    };

    void initialize();

    return () => {
      void hybridP2PEngine.stop();
    };
  }, [localUserId, localUserName]);

  // Listen for peer state changes
  useEffect(() => {
    const unsubscribe = hybridP2PEngine.onPeerStatesChanged((states) => {
      const uiStates: OfflinePeerUIState[] = states.map((state) => ({
        ...state,
        unreadMessageCount: unreadCounts.get(state.peerId) || 0,
      }));
      setPeerStates(uiStates);
    });

    return unsubscribe;
  }, [unreadCounts]);

  // Listen for incoming messages
  useEffect(() => {
    const unsubscribe = hybridP2PEngine.onMessage((peerId, msg) => {
      setMessages((prev) => {
        const updated = new Map(prev);
        const peerMessages = updated.get(peerId) || [];
        updated.set(peerId, [...peerMessages, msg]);
        return updated;
      });

      // Increment unread count
      const currentCount = messageCounterRef.current.get(peerId) || 0;
      messageCounterRef.current.set(peerId, currentCount + 1);
      setUnreadCounts(new Map(messageCounterRef.current));
    });

    return unsubscribe;
  }, []);

  const selectPeer = useCallback((peerId: string) => {
    setPeerStates((prev) =>
      prev.map((state) => ({
        ...state,
        isSelected: state.peerId === peerId,
      }))
    );
    // Clear unread count for selected peer
    messageCounterRef.current.set(peerId, 0);
    setUnreadCounts(new Map(messageCounterRef.current));
  }, []);

  const sendConnectionRequest = useCallback(
    async (targetPeerId: string) => {
      const targetPeer = peerStates.find((p) => p.peerId === targetPeerId);
      if (!targetPeer) {
        console.error('Peer not found');
        return false;
      }

      return await hybridP2PEngine.initializeConnectionRequest(
        targetPeerId,
        targetPeer.peerName,
        localUserId,
        localUserName,
        localDeviceId
      );
    },
    [peerStates, localUserId, localUserName, localDeviceId]
  );

  const acceptConnection = useCallback(
    async (peerId: string, wifiSSID: string, wifiPassword: string) => {
      return await hybridP2PEngine.acceptConnectionRequest(
        peerId,
        wifiSSID,
        wifiPassword,
        '192.168.49.1',
        localDeviceId,
        localUserName
      );
    },
    [localDeviceId, localUserName]
  );

  const sendMessage = useCallback(async (peerId: string, text: string) => {
    return await hybridP2PEngine.sendMessage(peerId, text);
  }, []);

  const getMessagesForPeer = useCallback(
    (peerId: string): LocalMessage[] => {
      return messages.get(peerId) || [];
    },
    [messages]
  );

  const getActivePeers = useCallback((): OfflinePeerUIState[] => {
    return peerStates.filter((state) => state.phase === 'messaging-ready');
  }, [peerStates]);

  const requestingPeers = useMemo(() => {
    return peerStates.filter((state) => state.phase === 'connection-requested');
  }, [peerStates]);

  const discoveredPeers = useMemo(() => {
    return peerStates.filter((state) => state.phase === 'ble-discovered');
  }, [peerStates]);

  return {
    // State
    peerStates,
    isDiscovering,
    messages,
    unreadCounts,
    
    // UI Helper Groups
    activePeers: getActivePeers(),
    requestingPeers,
    discoveredPeers,
    
    // Actions
    selectPeer,
    sendConnectionRequest,
    acceptConnection,
    sendMessage,
    getMessagesForPeer,
  };
};
