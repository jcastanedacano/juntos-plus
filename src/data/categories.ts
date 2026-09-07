import { Category } from '../types';

export const defaultCategories: Category[] = [
  // Gastos
  { id: 'food', name: 'Alimentación', icon: '🍔', color: '#FF6B6B', type: 'expense' },
  { id: 'transport', name: 'Transporte', icon: '🚗', color: '#4ECDC4', type: 'expense' },
  { id: 'shopping', name: 'Compras', icon: '🛍️', color: '#FFE66D', type: 'expense' },
  { id: 'entertainment', name: 'Ocio', icon: '🎮', color: '#A8E6CF', type: 'expense' },
  { id: 'bills', name: 'Facturas', icon: '📄', color: '#95A5A6', type: 'expense' },
  { id: 'health', name: 'Salud', icon: '⚕️', color: '#FF8B94', type: 'expense' },
  { id: 'education', name: 'Educación', icon: '📚', color: '#C7CEEA', type: 'expense' },
  { id: 'home', name: 'Hogar', icon: '🏠', color: '#FFDAC1', type: 'expense' },
  { id: 'subscriptions', name: 'Suscripciones', icon: '📱', color: '#B4A7D6', type: 'expense' },
  { id: 'other-expense', name: 'Otros gastos', icon: '💸', color: '#FAD4B8', type: 'expense' },

  // Ingresos
  { id: 'salary', name: 'Salario', icon: '💰', color: '#02B08D', type: 'income' },
  { id: 'freelance', name: 'Freelance', icon: '💼', color: '#03D4A8', type: 'income' },
  { id: 'investments', name: 'Inversiones', icon: '📈', color: '#01927A', type: 'income' },
  { id: 'gifts', name: 'Regalos', icon: '🎁', color: '#04E5B8', type: 'income' },
  { id: 'other-income', name: 'Otros ingresos', icon: '💵', color: '#018068', type: 'income' },
];

export const getCategoryInfo = (categoryId: string): Category | undefined => {
  // Legacy helper — prefer getCategoryById from utils/categoryHelpers
  return defaultCategories.find(cat => cat.id === categoryId);
};
