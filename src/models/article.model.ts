export interface PriceHistory {
  price: number;
  date: string; // YYYY-MM-DD
}

export interface Article {
  id: string;
  displayId?: number;
  name: string;
  code: string;
  category: string;
  unit: string;
  price: number;
  alert: number;
  description: string;
  createdAt: string; // YYYY-MM-DD
  updatedAt: string; // YYYY-MM-DD
  priceHistory: PriceHistory[];
}