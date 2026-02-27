import React, { useEffect, useState, useCallback } from 'react';
import { useMobileNavigation } from '../stores/mobileNavigationStore';

interface MobileLayoutProps {
  children: React.ReactNode;
}

export function MobileLayout({ children }: MobileLayoutProps) {
  const { pop, drawerOpen, setDrawerOpen } = useMobileNavigation();
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Track visual viewport for keyboard handling
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const handleResize = () => {
      const newHeight = viewport.height;
      setViewportHeight(newHeight);
      setKeyboardVisible(newHeight < window.innerHeight * 0.75);
    };

    viewport.addEventListener('resize', handleResize);
    return () => viewport.removeEventListener('resize', handleResize);
  }, []);

  // Handle Android hardware back button
  const handleBack = useCallback(() => {
    if (drawerOpen) {
      setDrawerOpen(false);
      return true;
    }
    return pop();
  }, [drawerOpen, setDrawerOpen, pop]);

  useEffect(() => {
    const handleBackButton = (e: PopStateEvent) => {
      e.preventDefault();
      const handled = handleBack();
      if (!handled) return;
      window.history.pushState(null, '', window.location.href);
    };

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handleBackButton);

    return () => {
      window.removeEventListener('popstate', handleBackButton);
    };
  }, [handleBack]);

  return (
    <div
      className="flex flex-col bg-owl-bg overflow-hidden mobile-layout"
      style={{
        height: `${viewportHeight}px`,
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
      data-keyboard-visible={keyboardVisible}
    >
      {children}
    </div>
  );
}
