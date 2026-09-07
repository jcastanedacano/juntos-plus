import {
  Utensils, Car, ShoppingBag, Gamepad2, FileText, Stethoscope, BookOpen,
  House, Tv, Tag, Wallet, Briefcase, LineChart, Gift, Banknote,
  type LucideIcon,
} from 'lucide-react';

/**
 * Un glifo por categoria, para la lista de movimientos.
 *
 * Es la unica lista de la app que cumple las tres condiciones para llevar
 * icono: es larga, se repite y se escanea buscando un tipo de gasto concreto
 * --no se lee linea por linea--. En Ajustes se quitaron por lo contrario: ahi
 * cada fila es distinta y la etiqueta ya la nombra.
 *
 * Una sola familia de metaforas: objetos concretos. Nada de flechas ni signos
 * abstractos mezclados, que es lo que hace que un set de iconos parezca
 * ensamblado a mano. Y sin color de categoria: el ocre esta reservado para
 * estado, asi que el glifo va en el gris de los metadatos y pesa lo que pesa
 * un dato secundario, ni mas.
 */
const GLIFOS: Record<string, LucideIcon> = {
  food: Utensils,
  transport: Car,
  shopping: ShoppingBag,
  entertainment: Gamepad2,
  bills: FileText,
  health: Stethoscope,
  education: BookOpen,
  home: House,
  subscriptions: Tv,
  'other-expense': Tag,
  salary: Wallet,
  freelance: Briefcase,
  investments: LineChart,
  gifts: Gift,
  'other-income': Banknote,
};

/** Las categorias que se cree el usuario no estan en el mapa: cae en Tag. */
export function CategoryGlyph({ categoryId }: { categoryId: string }) {
  const Icon = GLIFOS[categoryId] ?? Tag;
  // aria-hidden: el nombre de la categoria va escrito al lado, asi que para
  // un lector de pantalla el icono solo seria ruido repetido.
  return <Icon className="cl-mov-glyph" size={16} strokeWidth={1.5} aria-hidden="true" />;
}
