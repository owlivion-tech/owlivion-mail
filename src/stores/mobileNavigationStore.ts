import { create } from 'zustand';

export type MobileScreen =
  | { type: 'emailList' }
  | { type: 'emailDetail'; emailId: string }
  | { type: 'compose'; mode?: 'new' | 'reply' | 'replyAll' | 'forward' }
  | { type: 'settings' }
  | { type: 'filters' };

export type MobileTab = 'inbox' | 'search' | 'compose' | 'settings';

interface MobileNavigationState {
  // Stack-based navigation
  screenStack: MobileScreen[];
  currentScreen: MobileScreen;

  // Bottom tab
  activeTab: MobileTab;

  // Drawer state
  drawerOpen: boolean;

  // Actions
  push: (screen: MobileScreen) => void;
  pop: () => boolean; // returns false if can't go back
  reset: (screen?: MobileScreen) => void;
  setActiveTab: (tab: MobileTab) => void;
  toggleDrawer: () => void;
  setDrawerOpen: (open: boolean) => void;
}

export const useMobileNavigation = create<MobileNavigationState>((set, get) => ({
  screenStack: [{ type: 'emailList' }],
  currentScreen: { type: 'emailList' },
  activeTab: 'inbox',
  drawerOpen: false,

  push: (screen) =>
    set((state) => ({
      screenStack: [...state.screenStack, screen],
      currentScreen: screen,
    })),

  pop: () => {
    const state = get();
    if (state.screenStack.length <= 1) return false;
    const newStack = state.screenStack.slice(0, -1);
    set({
      screenStack: newStack,
      currentScreen: newStack[newStack.length - 1],
    });
    return true;
  },

  reset: (screen) => {
    const initial = screen || { type: 'emailList' as const };
    set({
      screenStack: [initial],
      currentScreen: initial,
    });
  },

  setActiveTab: (tab) => {
    const screenMap: Record<MobileTab, MobileScreen> = {
      inbox: { type: 'emailList' },
      search: { type: 'emailList' },
      compose: { type: 'compose', mode: 'new' },
      settings: { type: 'settings' },
    };
    set({
      activeTab: tab,
      screenStack: [screenMap[tab]],
      currentScreen: screenMap[tab],
    });
  },

  toggleDrawer: () => set((state) => ({ drawerOpen: !state.drawerOpen })),
  setDrawerOpen: (open) => set({ drawerOpen: open }),
}));
