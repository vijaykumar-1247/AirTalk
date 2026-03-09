import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import AppErrorBoundary from "@/components/common/AppErrorBoundary";
import { AppSettingsProvider } from "@/context/AppSettingsContext";
import { SparkMeshProvider } from "@/context/SparkMeshContext";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <AppSettingsProvider>
      <SparkMeshProvider>
        <App />
      </SparkMeshProvider>
    </AppSettingsProvider>
  </AppErrorBoundary>
);
