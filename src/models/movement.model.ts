export type MovementType = 'Entrée' | 'Sortie' | 'Ajustement' | 'Périmé / Rebut';

export interface Movement {
  id: string;
  articleId: string;
  userId: string;
  type: MovementType;
  quantity: number;
  date: string; // YYYY-MM-DD
  refDoc: string;
  supplierDest: string;
  remarks: string;
  subcategory?: string;
}