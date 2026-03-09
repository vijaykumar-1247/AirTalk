import { toast } from "@/components/ui/sonner";

type ErrorContext = string;

const resolveUserMessage = (error: unknown) => {
  const fallback = "Something failed. Please try again.";
  if (!(error instanceof Error)) return fallback;

  const lowered = error.message.toLowerCase();
  if (lowered.includes("network") || lowered.includes("connection")) {
    return "Connection dropped.";
  }
  if (lowered.includes("send") || lowered.includes("message")) {
    return "Failed to send message.";
  }
  return fallback;
};

export const handleAppError = (error: unknown, context: ErrorContext) => {
  console.error(`[Air Talk][${context}]`, error);

  toast.error(resolveUserMessage(error), {
    description: context,
  });
};
