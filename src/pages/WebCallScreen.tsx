import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ZegoUIKitPrebuilt } from "@zegocloud/zego-uikit-prebuilt";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAppSettings } from "@/context/AppSettingsContext";
import { handleAppError } from "@/lib/app-error";
import { getCallQualityProfile } from "@/lib/low-data-mode";

const ZEGO_APP_ID = 1483807521;

type WebCallRouteState = {
  currentUserID?: string;
  currentUserName?: string;
  callRoomID?: string;
  peerUserID?: string;
  callType?: "video" | "voice";
  direction?: "incoming" | "outgoing";
  startedAt?: string;
  returnTo?: string;
};

const WebCallScreen = () => {
  const { isLowDataModeEnabled } = useAppSettings();
  const navigate = useNavigate();
  const { callRoomID: roomIdParam } = useParams();
  const { state } = useLocation();
  const parsedState = (state as WebCallRouteState | null) ?? null;

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const elementRef = useRef<HTMLDivElement | null>(null);
  const zegoRef = useRef<ReturnType<typeof ZegoUIKitPrebuilt.create> | null>(null);

  const callRoomID = parsedState?.callRoomID ?? roomIdParam ?? "";
  const currentUserID = parsedState?.currentUserID ?? "";
  const currentUserName = parsedState?.currentUserName ?? "";
  const callType = parsedState?.callType ?? "video";
  const returnTo = parsedState?.returnTo ?? "/home";

  const canStartCall = useMemo(
    () => Boolean(callRoomID.trim() && currentUserID.trim() && currentUserName.trim()),
    [callRoomID, currentUserID, currentUserName]
  );

  useEffect(() => {
    let cancelled = false;

    const initializeCall = async () => {
      if (!canStartCall || !elementRef.current) {
        setErrorMessage("Missing call details. Please start the call again from Home.");
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("zego-token", {
          body: {
            callRoomID,
            userID: currentUserID,
            userName: currentUserName,
          },
        });

        if (cancelled) return;

        if (error || !data?.token) {
          setErrorMessage("Unable to start the call. Please try again.");
          return;
        }

        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForProduction(
          ZEGO_APP_ID,
          data.token,
          callRoomID,
          currentUserID,
          currentUserName
        );

        const zp = ZegoUIKitPrebuilt.create(kitToken);
        zegoRef.current = zp;

        const { zegoJoinRoomOverrides } = getCallQualityProfile(isLowDataModeEnabled);

        zp.joinRoom({
          container: elementRef.current,
          scenario: {
            mode: ZegoUIKitPrebuilt.OneONoneCall,
            config: { role: ZegoUIKitPrebuilt.Host },
          },
          turnOnMicrophoneWhenJoining: true,
          turnOnCameraWhenJoining: callType !== "voice",
          showMyCameraToggleButton: callType !== "voice",
          showMyMicrophoneToggleButton: true,
          showAudioVideoSettingsButton: true,
          showScreenSharingButton: callType !== "voice",
          showTextChat: true,
          showUserList: true,
          maxUsers: 2,
          layout: "Auto",
          showLayoutButton: false,
          showPreJoinView: false,
          ...zegoJoinRoomOverrides,
          onLeaveRoom: () => {
            navigate(returnTo, { replace: true });
          },
        });
      } catch (error) {
        handleAppError(error, "Web call initialization");
        setErrorMessage("Unable to start the call. Please try again.");
      }
    };

    void initializeCall();

    return () => {
      cancelled = true;
      try {
        zegoRef.current?.destroy();
      } catch {
        // ignore cleanup errors
      }
      zegoRef.current = null;
    };
  }, [callRoomID, callType, canStartCall, currentUserID, currentUserName, isLowDataModeEnabled, navigate, returnTo]);

  if (errorMessage) {
    return (
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center justify-center gap-3 bg-background px-4">
        <p className="text-center text-sm text-foreground">{errorMessage}</p>
        <Button onClick={() => navigate("/home", { replace: true })} type="button" variant="secondary">
          Back to Home
        </Button>
      </main>
    );
  }

  return (
    <main className="fixed inset-0 z-[90] bg-background">
      <div className="h-[100dvh] w-screen" ref={elementRef} />
    </main>
  );
};

export default WebCallScreen;

