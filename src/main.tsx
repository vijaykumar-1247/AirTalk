import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import AppErrorBoundary from "@/components/common/AppErrorBoundary";
import { AppSettingsProvider } from "@/context/AppSettingsContext";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <AppSettingsProvider>
      <App />
    </AppSettingsProvider>
  </AppErrorBoundary>
);
