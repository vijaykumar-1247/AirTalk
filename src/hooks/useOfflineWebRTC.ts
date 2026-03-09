import { type PluginListenerHandle } from "@capacitor/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WifiDirectTransport } from "@/plugins/wifi-direct-transport";

type SignalMessage =
  | { type: "offer"; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; sdp: RTCSessionDescriptionInit }
  | { type: "candidate"; candidate: RTCIceCandidateInit };

type UseOfflineWebRTCParams = {
  peerId: string;
  isCaller: boolean;
  isVideoOn: boolean;
};

export const useOfflineWebRTC = ({ peerId, isCaller, isVideoOn }: UseOfflineWebRTCParams) => {
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const listenerRef = useRef<PluginListenerHandle | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>("new");
  const [error, setError] = useState<string | null>(null);

  const canUseWebRTC = typeof window !== "undefined" && typeof RTCPeerConnection !== "undefined";

  const sendSignal = useCallback(
    async (payload: SignalMessage) => {
      if (!peerId) return;
      await WifiDirectTransport.sendMessage({
        peerId,
        text: JSON.stringify(payload),
      });
    },
    [peerId]
  );

  const ensureLocalStream = useCallback(
    async (videoEnabled: boolean) => {
      const existing = localStreamRef.current;
      if (existing) return existing;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: videoEnabled,
      });

      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    },
    []
  );

  const ensurePeerConnection = useCallback(async () => {
    if (peerConnectionRef.current) return peerConnectionRef.current;

    const pc = new RTCPeerConnection({ iceServers: [] });

    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
    };

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      void sendSignal({
        type: "candidate",
        candidate: event.candidate.toJSON(),
      });
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (stream) {
        remoteStreamRef.current = stream;
        setRemoteStream(stream);
        return;
      }

      if (!remoteStreamRef.current) {
        remoteStreamRef.current = new MediaStream();
      }
      remoteStreamRef.current.addTrack(event.track);
      setRemoteStream(new MediaStream(remoteStreamRef.current.getTracks()));
    };

    const stream = await ensureLocalStream(isVideoOn);
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    peerConnectionRef.current = pc;
    return pc;
  }, [ensureLocalStream, isVideoOn, sendSignal]);

  const handleOffer = useCallback(
    async (offer: RTCSessionDescriptionInit) => {
      const pc = await ensurePeerConnection();
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (pc.localDescription) {
        await sendSignal({ type: "answer", sdp: pc.localDescription.toJSON() });
      }
    },
    [ensurePeerConnection, sendSignal]
  );

  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  }, []);

  const handleCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  }, []);

  const startCall = useCallback(async () => {
    try {
      setError(null);
      const pc = await ensurePeerConnection();
      if (!isCaller) return;

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (pc.localDescription) {
        await sendSignal({ type: "offer", sdp: pc.localDescription.toJSON() });
      }
    } catch {
      setError("Failed to initialize offline WebRTC call");
    }
  }, [ensurePeerConnection, isCaller, sendSignal]);

  const setVideoEnabled = useCallback(async (enabled: boolean) => {
    const stream = localStreamRef.current;
    const pc = peerConnectionRef.current;
    if (!stream || !pc) return;

    const currentVideoTrack = stream.getVideoTracks()[0];

    if (enabled) {
      if (currentVideoTrack) {
        currentVideoTrack.enabled = true;
        return;
      }

      const videoOnly = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      const newVideoTrack = videoOnly.getVideoTracks()[0];
      if (!newVideoTrack) return;

      const sender = pc.getSenders().find((entry) => entry.track?.kind === "video");
      if (sender) {
        await sender.replaceTrack(newVideoTrack);
      } else {
        pc.addTrack(newVideoTrack, stream);
      }

      stream.addTrack(newVideoTrack);
      setLocalStream(new MediaStream(stream.getTracks()));
      return;
    }

    if (currentVideoTrack) {
      currentVideoTrack.enabled = false;
    }
  }, []);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const nextMuted = !isMuted;

    stream.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });

    setIsMuted(nextMuted);
  }, [isMuted]);

  const endCall = useCallback(() => {
    const pc = peerConnectionRef.current;
    pc?.close();
    peerConnectionRef.current = null;

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    remoteStreamRef.current?.getTracks().forEach((track) => track.stop());

    localStreamRef.current = null;
    remoteStreamRef.current = null;

    setLocalStream(null);
    setRemoteStream(null);
    setConnectionState("closed");
  }, []);

  useEffect(() => {
    if (!canUseWebRTC || !peerId) return;

    const attachSignaling = async () => {
      listenerRef.current = await WifiDirectTransport.addListener("messageReceived", (event) => {
        if (event.fromPeerId !== peerId || !event.text) return;

        let parsed: SignalMessage | null = null;
        try {
          parsed = JSON.parse(event.text) as SignalMessage;
        } catch {
          parsed = null;
        }

        if (!parsed) return;

        if (parsed.type === "offer") {
          void handleOffer(parsed.sdp);
          return;
        }

        if (parsed.type === "answer") {
          void handleAnswer(parsed.sdp);
          return;
        }

        if (parsed.type === "candidate") {
          void handleCandidate(parsed.candidate);
        }
      });

      await startCall();
    };

    void attachSignaling();

    return () => {
      void listenerRef.current?.remove();
      listenerRef.current = null;
      endCall();
    };
  }, [canUseWebRTC, endCall, handleAnswer, handleCandidate, handleOffer, peerId, startCall]);

  useEffect(() => {
    void setVideoEnabled(isVideoOn);
  }, [isVideoOn, setVideoEnabled]);

  const streamState = useMemo(
    () => ({
      localStream,
      remoteStream,
      isMuted,
      connectionState,
      error,
    }),
    [connectionState, error, isMuted, localStream, remoteStream]
  );

  return {
    ...streamState,
    toggleMute,
    endCall,
    setVideoEnabled,
  };
};
