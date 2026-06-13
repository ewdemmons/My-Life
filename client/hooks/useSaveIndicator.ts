import { useState, useRef, useCallback, useEffect } from "react";

export interface SaveIndicatorOptions {
  successMessage?: string;
  errorMessage?: string;
  threshold?: number;
  successDuration?: number;
}

export interface WithSaveIndicatorOptions {
  successMessage?: string;
  errorMessage?: string;
  showSuccess?: boolean;
}

export function useSaveIndicator(options: SaveIndicatorOptions = {}) {
  const {
    successMessage: defaultSuccessMessage = "Saved",
    errorMessage: defaultErrorMessage = "Save failed",
    threshold = 500,
    successDuration = 1500,
  } = options;

  const [toastState, setToastState] = useState<
    "saving" | "success" | "error" | "hidden"
  >("hidden");
  const [toastMessage, setToastMessage] = useState<string | undefined>(
    undefined,
  );
  const [retryFn, setRetryFn] = useState<(() => void) | null>(null);

  const thresholdTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const withSaveIndicator = useCallback(
    async <T>(
      saveFn: () => Promise<T>,
      callOptions?: WithSaveIndicatorOptions,
    ): Promise<T | null> => {
      const successMsg =
        callOptions?.successMessage ?? defaultSuccessMessage;
      const errorMsg = callOptions?.errorMessage ?? defaultErrorMessage;
      const showSuccess = callOptions?.showSuccess ?? true;

      clearTimeout(thresholdTimerRef.current);
      clearTimeout(successTimerRef.current);

      let thresholdReached = false;

      thresholdTimerRef.current = setTimeout(() => {
        thresholdReached = true;
        setToastState("saving");
        setToastMessage(undefined);
        setRetryFn(null);
      }, threshold);

      try {
        const result = await saveFn();

        clearTimeout(thresholdTimerRef.current);

        if (thresholdReached) {
          if (showSuccess) {
            setToastState("success");
            setToastMessage(successMsg);
            successTimerRef.current = setTimeout(() => {
              setToastState("hidden");
              setToastMessage(undefined);
            }, successDuration);
          } else {
            setToastState("hidden");
            setToastMessage(undefined);
          }
        }

        return result;
      } catch {
        clearTimeout(thresholdTimerRef.current);

        setToastState("error");
        setToastMessage(errorMsg);

        return null;
      }
    },
    [threshold, successDuration, defaultSuccessMessage, defaultErrorMessage],
  );

  const setRetry = useCallback((fn: () => void) => {
    setRetryFn(() => fn);
  }, []);

  const dismiss = useCallback(() => {
    clearTimeout(successTimerRef.current);
    setToastState("hidden");
    setToastMessage(undefined);
    setRetryFn(null);
  }, []);

  useEffect(() => {
    return () => {
      clearTimeout(thresholdTimerRef.current);
      clearTimeout(successTimerRef.current);
    };
  }, []);

  return {
    toastState,
    toastMessage,
    retryFn,
    withSaveIndicator,
    setRetry,
    dismiss,
  };
}
