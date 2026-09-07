import { Category, TransactionType } from '../types';
import { defaultCategories } from '../data/categories';

const KEYS = {
  CUSTOM: 'finance_custom_categories',
  HIDDEN: 'finance_hidden_categories',
};

// ─── Storage ────────────────────────────────────────────────────────────────

export function getCustomCategories(): Category[] {
  try {
    const raw = localStorage.getItem(KEYS.CUSTOM);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveCustomCategories(categories: Category[]): void {
  localStorage.setItem(KEYS.CUSTOM, JSON.stringify(categories));
}

export function getHiddenCategoryIds(): string[] {
  try {
    const raw = localStorage.getItem(KEYS.HIDDEN);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveHiddenCategoryIds(ids: string[]): void {
  localStorage.setItem(KEYS.HIDDEN, JSON.stringify(ids));
}

// ─── Queries ────────────────────────────────────────────────────────────────

/** All categories (defaults not hidden + custom). Used for selectors/grids. */
export function getAllCategories(): Category[] {
  const hidden = new Set(getHiddenCategoryIds());
  const visible = defaultCategories.filter(c => !hidden.has(c.id));
  return [...visible, ...getCustomCategories()];
}

/** All categories including hidden defaults. Used for CSV import, manager UI. */
export function getAllCategoriesRaw(): Category[] {
  return [...defaultCategories, ...getCustomCategories()];
}

/** Find category by ID. Searches ALL (including hidden) so existing txns resolve. */
export function getCategoryById(id: string): Category | undefined {
  // Check defaults first (fast path)
  const def = defaultCategories.find(c => c.id === id);
  if (def) return def;
  return getCustomCategories().find(c => c.id === id);
}

/** Categories filtered by type, excluding hidden. For modal selectors. */
export function getCategoriesByType(type: TransactionType): Category[] {
  return getAllCategories().filter(c => c.type === type);
}

/** Check if a category ID is a built-in default. */
export function isDefaultCategory(id: string): boolean {
  return defaultCategories.some(c => c.id === id);
}

/** Generate a unique ID for a custom category. */
export function generateCategoryId(): string {
  return `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// ─── CRUD for custom categories ─────────────────────────────────────────────

export function addCustomCategory(cat: Omit<Category, 'id'>): Category {
  const newCat: Category = { ...cat, id: generateCategoryId() };
  const all = getCustomCategories();
  all.push(newCat);
  saveCustomCategories(all);
  return newCat;
}

export function updateCustomCategory(id: string, updates: Partial<Omit<Category, 'id'>>): void {
  const all = getCustomCategories().map(c =>
    c.id === id ? { ...c, ...updates } : c
  );
  saveCustomCategories(all);
}

export function deleteCustomCategory(id: string): void {
  saveCustomCategories(getCustomCategories().filter(c => c.id !== id));
}

export function toggleHideDefault(id: string): void {
  const hidden = getHiddenCategoryIds();
  const idx = hidden.indexOf(id);
  if (idx >= 0) {
    hidden.splice(idx, 1);
  } else {
    hidden.push(id);
  }
  saveHiddenCategoryIds(hidden);
}
