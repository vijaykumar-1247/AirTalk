import { useEffect } from "react";
import { Navigate, Route, Routes, BrowserRouter, useLocation, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import IncomingCallBanner from "@/components/sparkmesh/IncomingCallBanner";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SparkMeshProvider, useSparkMesh } from "@/context/SparkMeshContext";
import { applyAppearanceSettings, loadAppearanceSettings } from "@/lib/appearance-settings";
import { initializeNativeCallNotifications, isNativeCallNotificationSupported, onNativeIncomingCallAction } from "@/lib/native-call-notifications";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Home from "./pages/Home";
import ChatRoom from "./pages/ChatRoom";
import WebCallScreen from "./pages/WebCallScreen";
import ScanNearby from "./pages/ScanNearby";
import Settings from "./pages/Settings";
import UnblockList from "./pages/UnblockList";
import OfflineUpgradeSignup from "./pages/OfflineUpgradeSignup";
import Permissions from "./pages/Permissions";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();


const GuardedRoute = ({ children, requirePermissions = true }: { children: JSX.Element; requirePermissions?: boolean }) => {
  const { profile, permissionsCompleted } = useSparkMesh();
  if (!profile) return <Navigate replace to="/login" />;
  if (requirePermissions && !permissionsCompleted) return <Navigate replace to="/permissions" />;
  return children;
};

const GuestRoute = ({ children }: { children: JSX.Element }) => {
  const { profile, permissionsCompleted } = useSparkMesh();
  if (!profile) return children;
  return <Navigate replace to={permissionsCompleted ? "/home" : "/permissions"} />;
};

const GlobalIncomingCallLayer = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { incomingCallInvite, authUserId, profile, acceptIncomingCallInvite, declineIncomingCallInvite } = useSparkMesh();

  const canShowBanner = Boolean(incomingCallInvite && authUserId && profile?.name && !location.pathname.startsWith("/call/"));

  const acceptIncomingCall = async () => {
    const acceptedInvite = await acceptIncomingCallInvite();
    if (!acceptedInvite) return;

    const returnTo = location.pathname.startsWith("/chat/") ? location.pathname : "/home";

    navigate(`/call/${encodeURIComponent(acceptedInvite.callRoomID)}`, {
      state: {
        callRoomID: acceptedInvite.callRoomID,
        currentUserID: authUserId,
        currentUserName: profile.name,
        peerUserID: acceptedInvite.peerUserID,
        callType: acceptedInvite.callType,
        direction: acceptedInvite.direction,
        startedAt: acceptedInvite.startedAt,
        returnTo,
      },
    });
  };

  const declineIncomingCall = async () => {
    await declineIncomingCallInvite();
  };

  useEffect(() => {
    if (!isNativeCallNotificationSupported()) return;

    void initializeNativeCallNotifications();

    let listenerCancelled = false;
    let listenerHandle: { remove: () => Promise<void> } | null = null;

    const attachListener = async () => {
      listenerHandle = await onNativeIncomingCallAction(async ({ actionId, inviteId }) => {
        if (listenerCancelled || !incomingCallInvite) return;
        if (inviteId && inviteId !== incomingCallInvite.id) return;

        if (actionId === "accept") {
          await acceptIncomingCall();
          return;
        }

        if (actionId === "decline") {
          await declineIncomingCall();
        }
      });
    };

    void attachListener();

    return () => {
      listenerCancelled = true;
      if (listenerHandle) {
        void listenerHandle.remove();
      }
    };
  }, [incomingCallInvite, acceptIncomingCallInvite, authUserId, declineIncomingCallInvite, location.pathname, navigate, profile?.name]);

  if (!canShowBanner || !incomingCallInvite) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-2 z-[95] mx-auto w-full max-w-md px-2">
      <div className="pointer-events-auto">
        <IncomingCallBanner invite={incomingCallInvite} onAccept={() => void acceptIncomingCall()} onDecline={() => void declineIncomingCall()} />
      </div>
    </div>
  );
};

const App = () => {
  const { isInitializing } = useSparkMesh();

  useEffect(() => {
    applyAppearanceSettings(loadAppearanceSettings());
  }, []);

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SparkMeshProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            
            <GlobalIncomingCallLayer />
            <Routes>
              <Route
                element={
                  <GuestRoute>
                    <Index />
                  </GuestRoute>
                }
                path="/"
              />
              <Route
                element={
                  <GuestRoute>
                    <Login />
                  </GuestRoute>
                }
                path="/login"
              />
              <Route
                element={
                  <GuestRoute>
                    <Signup />
                  </GuestRoute>
                }
                path="/signup"
              />
              <Route
                element={
                  <GuardedRoute>
                    <Home />
                  </GuardedRoute>
                }
                path="/home"
              />
              <Route
                element={
                  <GuardedRoute>
                    <ScanNearby />
                  </GuardedRoute>
                }
                path="/scan"
              />
              <Route
                element={
                  <GuardedRoute>
                    <ChatRoom />
                  </GuardedRoute>
                }
                path="/chat/:userId"
              />
              <Route
                element={
                  <GuardedRoute>
                    <Settings />
                  </GuardedRoute>
                }
                path="/settings"
              />
              <Route
                element={
                  <GuardedRoute>
                    <UnblockList />
                  </GuardedRoute>
                }
                path="/settings/unblock-list"
              />
              <Route
                element={
                  <GuardedRoute>
                    <WebCallScreen />
                  </GuardedRoute>
                }
                path="/call/:callRoomID"
              />
              <Route
                element={
                  <GuardedRoute>
                    <OfflineUpgradeSignup />
                  </GuardedRoute>
                }
                path="/upgrade-online"
              />
              <Route
                element={
                  <GuardedRoute requirePermissions={false}>
                    <Permissions />
                  </GuardedRoute>
                }
                path="/permissions"
              />
              <Route element={<NotFound />} path="*" />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </SparkMeshProvider>
    </QueryClientProvider>
  );
};

export default App;
