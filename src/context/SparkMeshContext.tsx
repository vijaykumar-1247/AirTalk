import { createContext, useContext, type ReactNode } from "react";
import { useSparkMeshState } from "@/hooks/useSparkMeshState";

type SparkMeshContextValue = ReturnType<typeof useSparkMeshState>;

const SparkMeshContext = createContext<SparkMeshContextValue | null>(null);

export const SparkMeshProvider = ({ children }: { children: ReactNode }) => {
  const value = useSparkMeshState();
  return <SparkMeshContext.Provider value={value}>{children}</SparkMeshContext.Provider>;
};

export const useSparkMesh = () => {
  const context = useContext(SparkMeshContext);
  if (!context) {
    throw new Error("useSparkMesh must be used inside SparkMeshProvider");
  }
  return context;
};
