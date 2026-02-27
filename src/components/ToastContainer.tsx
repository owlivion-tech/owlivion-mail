// ============================================================================
// Owlivion Mail - Global Toast Notification Container
// ============================================================================

import { useToastStore } from '../stores/toastStore';
import { isMobile } from '../hooks/usePlatform';

const typeStyles = {
  success: {
    bg: 'bg-green-500/15 border-green-500/30',
    icon: 'text-green-400',
    iconPath: 'M5 13l4 4L19 7',
  },
  error: {
    bg: 'bg-red-500/15 border-red-500/30',
    icon: 'text-red-400',
    iconPath: 'M6 18L18 6M6 6l12 12',
  },
  warning: {
    bg: 'bg-amber-500/15 border-amber-500/30',
    icon: 'text-amber-400',
    iconPath: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  },
  info: {
    bg: 'bg-blue-500/15 border-blue-500/30',
    icon: 'text-blue-400',
    iconPath: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
};

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  const mobile = isMobile();

  return (
    <div className={`fixed z-[9999] flex flex-col gap-2 ${mobile ? 'bottom-20 left-4 right-4' : 'bottom-4 right-4 max-w-sm'}`}>
      {toasts.map((toast) => {
        const style = typeStyles[toast.type];
        return (
          <div
            key={toast.id}
            className={`${style.bg} border rounded-lg px-4 py-3 shadow-lg backdrop-blur-sm animate-slide-in-right flex items-start gap-3`}
          >
            <svg className={`w-5 h-5 ${style.icon} shrink-0 mt-0.5`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={style.iconPath} />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-owl-text">{toast.title}</p>
              {toast.message && (
                <p className="text-xs text-owl-text-secondary mt-0.5 line-clamp-3">{toast.message}</p>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 p-0.5 hover:bg-white/10 rounded text-owl-text-secondary hover:text-owl-text transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default ToastContainer;
