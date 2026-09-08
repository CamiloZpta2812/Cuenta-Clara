import { CreditCard, PiggyBank, TrendingUp, Wallet, Utensils, Car, Home, Film, HeartPulse, GraduationCap, Zap, ShoppingBag, MoreHorizontal, Briefcase, Laptop, CircleDollarSign, Landmark, Banknote, Gift, Plane, Dumbbell, PawPrint, Coffee, Smartphone, Baby, Shirt } from 'lucide-react';
import { userConfig } from './userConfig.js';

export const EXPENSE_CATEGORIES = [
  { id: 'alimentacion', label: 'Alimentación', icon: Utensils, color: '#B0524B' },
  { id: 'transporte', label: 'Transporte', icon: Car, color: '#B9772E' },
  { id: 'vivienda', label: 'Vivienda', icon: Home, color: '#6B5199' },
  { id: 'entretenimiento', label: 'Entretenimiento', icon: Film, color: '#3E7FB0' },
  { id: 'salud', label: 'Salud', icon: HeartPulse, color: '#B03E70' },
  { id: 'educacion', label: 'Educación', icon: GraduationCap, color: '#3E9C7A' },
  { id: 'servicios', label: 'Servicios', icon: Zap, color: '#B99A2E' },
  { id: 'compras', label: 'Compras', icon: ShoppingBag, color: '#7A5C44' },
  { id: 'deudas', label: 'Pago de deudas', icon: CreditCard, color: '#6B5199' },
  { id: 'otros_gasto', label: 'Otros', icon: MoreHorizontal, color: '#7A8088' },
];

export const INCOME_CATEGORIES = [
  { id: 'salario', label: 'Salario', icon: Briefcase, color: '#2F7D5C' },
  { id: 'freelance', label: 'Independiente', icon: Laptop, color: '#4F9A6E' },
  { id: 'inversiones', label: 'Inversiones', icon: TrendingUp, color: '#2F8F6F' },
  { id: 'otros_ingreso', label: 'Otros ingresos', icon: CircleDollarSign, color: '#6BAF8A' },
];

export const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

export const ICON_CHOICES = [
  { key: 'utensils', label: 'Comida', Icon: Utensils },
  { key: 'car', label: 'Transporte', Icon: Car },
  { key: 'home', label: 'Hogar', Icon: Home },
  { key: 'film', label: 'Entretenimiento', Icon: Film },
  { key: 'heart', label: 'Salud', Icon: HeartPulse },
  { key: 'grad', label: 'Educación', Icon: GraduationCap },
  { key: 'zap', label: 'Servicios', Icon: Zap },
  { key: 'bag', label: 'Compras', Icon: ShoppingBag },
  { key: 'briefcase', label: 'Trabajo', Icon: Briefcase },
  { key: 'laptop', label: 'Tecnología', Icon: Laptop },
  { key: 'piggy', label: 'Ahorro', Icon: PiggyBank },
  { key: 'landmark', label: 'Banco', Icon: Landmark },
  { key: 'wallet', label: 'Billetera', Icon: Wallet },
  { key: 'gift', label: 'Regalos', Icon: Gift },
  { key: 'plane', label: 'Viajes', Icon: Plane },
  { key: 'dumbbell', label: 'Ejercicio', Icon: Dumbbell },
  { key: 'paw', label: 'Mascotas', Icon: PawPrint },
  { key: 'coffee', label: 'Café/salidas', Icon: Coffee },
  { key: 'phone', label: 'Celular', Icon: Smartphone },
  { key: 'baby', label: 'Bebé/niños', Icon: Baby },
  { key: 'shirt', label: 'Ropa', Icon: Shirt },
  { key: 'other', label: 'Otro', Icon: MoreHorizontal },
];

export const ICON_MAP = Object.fromEntries(ICON_CHOICES.map((i) => [i.key, i.Icon]));

/*
 * El débito va de primero porque es de lejos el más usado: es el que aparece
 * puesto en los formularios, y el que se asume cuando un registro viejo no
 * dice cuál fue (ver getPaymentMethod).
 */
export const PAYMENT_METHODS = [
  { id: 'debito', label: 'Débito / ahorros', icon: Wallet },
  { id: 'efectivo', label: 'Efectivo', icon: Banknote },
  { id: 'credito', label: 'Tarjeta crédito', icon: CreditCard },
];

export function getCategory(id) {
  const custom = userConfig.customCategories.find((c) => c.id === id);
  const found = custom || ALL_CATEGORIES.find((c) => c.id === id) || EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];
  const icon = found.icon || ICON_MAP[found.iconKey] || MoreHorizontal;
  const customLabel = userConfig.categoryLabels[found.id];
  return { ...found, icon, label: customLabel || found.label };
}

export function getPaymentMethod(id) {
  return PAYMENT_METHODS.find((p) => p.id === id) || PAYMENT_METHODS[0];
}
