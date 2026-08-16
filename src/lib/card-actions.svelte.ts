/** Tracks which note card (if any) currently has its swipe-action tray open, so opening one closes any other. */
class CardActionsStore {
  openId = $state<string | null>(null);
}

export const cardActions = new CardActionsStore();
