import { Article } from './article.model';

export interface StockItem extends Article {
  currentStock: number;
}
