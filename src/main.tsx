import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import AppErrorBoundary from "@/components/common/AppErrorBoundary";
import { AppSettingsProvider } from "@/context/AppSettingsContext";
import { SparkMeshProvider } from "@/context/SparkMeshContext";
import { backgroundNotificationService } from "@/lib/background-notifications";
import "./index.css";

// Initialize background notification service
void backgroundNotificationService.initialize();

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <AppSettingsProvider>
      <SparkMeshProvider>
        <App />
      </SparkMeshProvider>
    </AppSettingsProvider>
  </AppErrorBoundary>
);
