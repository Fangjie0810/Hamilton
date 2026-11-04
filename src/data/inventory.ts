import type { GameState } from '../core/GameState';
import type { StateSystem } from '../systems/StateSystem';
import { bi, type BiText } from '../i18n/text';

export type InventoryItemId = 'scattered-newspaper';
export interface InventoryItem {
  id: InventoryItemId;
  name: BiText;
  description: BiText;
  icon: 'newspaper';
}

export const NEWSPAPER_PICKUP_KEY = 'inventory:scattered-newspaper';
export const NEWSPAPER_RETURN_KEY = 'side:arrival-scattered-paper';
export const newspaperItem: InventoryItem = {
  id: 'scattered-newspaper', icon: 'newspaper',
  name: bi('被风吹落的报纸', 'Windblown Newspaper'),
  description: bi('在酒馆后拾到的散页，可以交还给街上的报童。', 'Loose pages found behind the tavern. Return them to the newsboy on the street.'),
};

/** Inventory uses the same immutable choice records as story checkpoints. */
export const newspaperCollected = (state: GameState) => Object.hasOwn(state.choices, NEWSPAPER_PICKUP_KEY);
export const newspaperReturned = (state: GameState) => Object.hasOwn(state.choices, NEWSPAPER_RETURN_KEY);
export const hasInventoryItem = (state: GameState, id: InventoryItemId) =>
  id === 'scattered-newspaper' && newspaperCollected(state) && !newspaperReturned(state);
export const inventoryItems = (state: GameState): InventoryItem[] => hasInventoryItem(state, newspaperItem.id) ? [newspaperItem] : [];

/** Picking up an object never awards the reward reserved for returning it. */
export function collectNewspaper(state: StateSystem): boolean {
  if (newspaperCollected(state.state) || newspaperReturned(state.state)) return false;
  state.choose(NEWSPAPER_PICKUP_KEY, 'collected', {});
  return true;
}
