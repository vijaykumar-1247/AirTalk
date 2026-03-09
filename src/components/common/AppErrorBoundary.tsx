import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { handleAppError } from "@/lib/app-error";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

class AppErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  private readonly onGlobalError = (event: ErrorEvent) => {
    handleAppError(event.error ?? new Error(event.message), "Global window error");
  };

  private readonly onUnhandledRejection = (event: PromiseRejectionEvent) => {
    handleAppError(event.reason, "Unhandled promise rejection");
  };

  public componentDidMount() {
    window.addEventListener("error", this.onGlobalError);
    window.addEventListener("unhandledrejection", this.onUnhandledRejection);
  }

  public componentWillUnmount() {
    window.removeEventListener("error", this.onGlobalError);
    window.removeEventListener("unhandledrejection", this.onUnhandledRejection);
  }

  public static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error) {
    console.error(error);
    handleAppError(error, "Global Error Boundary");
  }

  private handleRestart = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.assign("/home");
  };

  public render() {
    if (this.state.hasError) {
      return (
        <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-4 bg-background px-4 text-center">
          <h1 className="text-xl font-semibold text-foreground">Oops! Something went wrong in Air Talk</h1>
          <p className="text-sm text-muted-foreground">You can restart the app or go back home safely.</p>
          <div className="flex w-full max-w-xs flex-col gap-2">
            <Button onClick={this.handleRestart} type="button" variant="default">
              Restart App
            </Button>
            <Button onClick={this.handleGoHome} type="button" variant="outline">
              Go to Home
            </Button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;
