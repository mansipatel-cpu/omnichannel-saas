import { useEffect, useRef, useCallback, useState } from "react";
import { AuthStorage } from "@/shared/lib/auth-storage";
export function useActivityTimeout({ onTimeout, onWarning, warningThresholdMs = 5 * 60 * 1000, enabled = true, } = {}) {
    const [isWarningVisible, setIsWarningVisible] = useState(false);
    const [remainingTime, setRemainingTime] = useState(0);
    const checkIntervalRef = useRef(null);
    const warningIntervalRef = useRef(null);
    const hasShownWarning = useRef(false);
    const resetActivity = useCallback(() => {
        AuthStorage.updateLastActivity();
        setIsWarningVisible(false);
        hasShownWarning.current = false;
    }, []);
    const dismissWarning = useCallback(() => {
        setIsWarningVisible(false);
        resetActivity();
    }, [resetActivity]);
    const handleUserActivity = useCallback(() => {
        if (!isWarningVisible) {
            AuthStorage.updateLastActivity();
        }
    }, [isWarningVisible]);
    useEffect(() => {
        if (!enabled)
            return;
        const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];
        const throttledHandler = (() => {
            let lastCall = 0;
            return () => {
                const now = Date.now();
                if (now - lastCall >= 30000) {
                    lastCall = now;
                    handleUserActivity();
                }
            };
        })();
        events.forEach(event => {
            window.addEventListener(event, throttledHandler, { passive: true });
        });
        return () => {
            events.forEach(event => {
                window.removeEventListener(event, throttledHandler);
            });
        };
    }, [enabled, handleUserActivity]);
    useEffect(() => {
        if (!enabled)
            return;
        const timeoutMs = AuthStorage.getActivityTimeoutMs();
        const checkActivity = () => {
            const lastActivity = AuthStorage.getLastActivity();
            if (!lastActivity)
                return;
            const elapsed = Date.now() - lastActivity;
            const remaining = timeoutMs - elapsed;
            if (remaining <= 0) {
                setIsWarningVisible(false);
                if (checkIntervalRef.current) {
                    clearInterval(checkIntervalRef.current);
                }
                onTimeout?.();
                return;
            }
            if (remaining <= warningThresholdMs && !hasShownWarning.current) {
                hasShownWarning.current = true;
                setIsWarningVisible(true);
                setRemainingTime(remaining);
                onWarning?.(remaining);
            }
            if (isWarningVisible) {
                setRemainingTime(remaining);
            }
        };
        checkIntervalRef.current = setInterval(checkActivity, 5000);
        checkActivity();
        return () => {
            if (checkIntervalRef.current) {
                clearInterval(checkIntervalRef.current);
            }
        };
    }, [enabled, warningThresholdMs, onTimeout, onWarning, isWarningVisible]);
    useEffect(() => {
        if (!isWarningVisible) {
            if (warningIntervalRef.current) {
                clearInterval(warningIntervalRef.current);
            }
            return;
        }
        const updateRemaining = () => {
            const lastActivity = AuthStorage.getLastActivity();
            if (!lastActivity)
                return;
            const timeoutMs = AuthStorage.getActivityTimeoutMs();
            const elapsed = Date.now() - lastActivity;
            const remaining = timeoutMs - elapsed;
            if (remaining <= 0) {
                setIsWarningVisible(false);
                onTimeout?.();
            }
            else {
                setRemainingTime(remaining);
            }
        };
        warningIntervalRef.current = setInterval(updateRemaining, 1000);
        return () => {
            if (warningIntervalRef.current) {
                clearInterval(warningIntervalRef.current);
            }
        };
    }, [isWarningVisible, onTimeout]);
    return {
        isWarningVisible,
        remainingTime,
        resetActivity,
        dismissWarning,
    };
}
export default useActivityTimeout;
