"use client"

import { createContext, useContext, useState, ReactNode, useCallback } from "react"

export interface ToastOptions {
  id?: string
  message: string
  actionLabel?: string
  onAction?: () => void
  duration?: number
}

interface ToastContextType {
  showToast: (options: ToastOptions | string) => void
  hideToast: () => void
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
  hideToast: () => {},
})

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toast, setToast] = useState<ToastOptions | null>(null)
  const [timerId, setTimerId] = useState<NodeJS.Timeout | null>(null)

  const hideToast = useCallback(() => {
    setToast(null)
    if (timerId) clearTimeout(timerId)
  }, [timerId])

  const showToast = useCallback((options: ToastOptions | string) => {
    if (timerId) clearTimeout(timerId)

    const toastData: ToastOptions = typeof options === "string" ? { message: options } : options
    const duration = toastData.duration || 5000

    setToast(toastData)

    const timer = setTimeout(() => {
      setToast(null)
    }, duration)

    setTimerId(timer)
  }, [timerId])

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      {toast && (
        <div
          className="global-toast-notification"
          style={{
            position: "fixed",
            bottom: "24px",
            left: "24px",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: "16px",
            background: "#1e1e1e",
            color: "var(--text-bright, #fff)",
            border: "1px solid rgba(212, 175, 55, 0.4)",
            borderRadius: "10px",
            padding: "12px 20px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.8), 0 0 15px rgba(212, 175, 55, 0.2)",
            fontFamily: "Inter, -apple-system, sans-serif",
            fontSize: "13px",
            fontWeight: "600",
            maxWidth: "calc(100vw - 32px)",
            animation: "toastSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)"
          }}
        >
          <style>{`
            @keyframes toastSlideUp {
              from { transform: translateY(20px); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
            @media (max-width: 768px) {
              .global-toast-notification {
                left: 16px !important;
                right: 16px !important;
                bottom: calc(72px + env(safe-area-inset-bottom, 0px)) !important;
                justify-content: space-between;
              }
            }
          `}</style>
          <span>{toast.message}</span>
          {toast.actionLabel && (
            <button
              onClick={() => {
                if (toast.onAction) toast.onAction()
                hideToast()
              }}
              style={{
                background: "none",
                border: "none",
                color: "var(--gold-mid, #C5A059)",
                fontWeight: "700",
                fontSize: "13px",
                cursor: "pointer",
                padding: "2px 6px",
                borderRadius: "4px",
                transition: "background 0.2s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(212,175,55,0.15)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "none"}
            >
              {toast.actionLabel}
            </button>
          )}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
