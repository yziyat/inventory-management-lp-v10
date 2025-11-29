import { Injectable, signal, computed } from '@angular/core';
import { Article, PriceHistory } from '../models/article.model';
import { Movement, MovementType } from '../models/movement.model';
import { User, UserRole } from '../models/user.model';
import { StockItem } from '../models/stock-item.model';
import { ApiError } from './api-error';

@Injectable({ providedIn: 'root' })
export class ApiService {
  
  private today(): string {
    return new Date().toISOString().split('T')[0];
  }

  private _articles = signal<Article[]>([
    { id: 1, name: 'Doliprane 1000mg', code: 'DOL1000', category: 'Médicaments', unit: 'Boîte', price: 25.50, alert: 10, description: 'Antalgique et antipyrétique', createdAt: '2024-01-10', updatedAt: '2024-07-15', priceHistory: [{ price: 25.50, date: '2024-01-10' }] },
    { id: 2, name: 'Seringue 5ml', code: 'SER005', category: 'Fournitures', unit: 'Unité', price: 2.00, alert: 100, description: 'Seringue stérile à usage unique', createdAt: '2024-01-10', updatedAt: '2024-01-10', priceHistory: [{ price: 2.00, date: '2024-01-10' }] },
    { id: 3, name: 'Compresses stériles', code: 'COMP01', category: 'Consommables', unit: 'Paquet', price: 15.00, alert: 20, description: 'Paquet de 10 compresses', createdAt: '2024-02-20', updatedAt: '2024-02-20', priceHistory: [{ price: 15.00, date: '2024-02-20' }] },
    { id: 4, name: 'Gants en latex', code: 'GANT-M', category: 'Fournitures', unit: 'Boîte', price: 80.00, alert: 5, description: 'Boîte de 100 gants taille M', createdAt: '2024-03-01', updatedAt: '2024-06-01', priceHistory: [{ price: 75.00, date: '2024-03-01'}, { price: 80.00, date: '2024-06-01'}] },
  ]);
  private _nextArticleId = 5;

  private _movements = signal<Movement[]>([
    { id: 1, articleId: 1, userId: 1, type: 'Entrée', quantity: 50, date: '2024-07-01', refDoc: 'CMD-001', supplierDest: 'Fournisseur A', remarks: '' },
    { id: 2, articleId: 2, userId: 1, type: 'Entrée', quantity: 500, date: '2024-07-01', refDoc: 'CMD-001', supplierDest: 'Fournisseur A', remarks: '' },
    { id: 3, articleId: 1, userId: 2, type: 'Sortie', quantity: 5, date: '2024-07-05', refDoc: 'BS-001', supplierDest: 'Service 1', remarks: 'Dispensation patient', subcategory: 'Dispensation Patient' },
    { id: 4, articleId: 3, userId: 1, type: 'Entrée', quantity: 30, date: '2024-07-06', refDoc: 'CMD-002', supplierDest: 'Dépôt Central', remarks: '' },
    { id: 5, articleId: 2, userId: 2, type: 'Sortie', quantity: 100, date: '2024-07-08', refDoc: 'BS-002', supplierDest: 'Service 1', remarks: '', subcategory: 'Dotation Service' },
    { id: 6, articleId: 1, userId: 2, type: 'Sortie', quantity: 10, date: '2024-07-10', refDoc: 'BS-003', supplierDest: 'Service 1', remarks: '', subcategory: 'Dispensation Patient' },
  ]);

  private _users = signal<User[]>([
    { id: 1, username: 'admin', firstName: 'Admin', lastName: 'User', role: 'admin', password: 'admin' },
    { id: 2, username: 'editor.user', firstName: 'Editor', lastName: 'User', role: 'editor', password: 'password' },
    { id: 3, username: 'viewer.user', firstName: 'Viewer', lastName: 'User', role: 'viewer', password: 'password' },
  ]);

  private _settings = signal<{ categories: string[]; suppliers: string[]; destinations: string[], outgoingSubcategories: string[] }>({
    categories: ['Médicaments', 'Fournitures', 'Consommables', 'Autres'],
    suppliers: ['Fournisseur A', 'Dépôt Central'],
    destinations: ['Service 1', 'Périmé'],
    outgoingSubcategories: ['Dispensation Patient', 'Dotation Service', 'Transfert Inter-dépôt', 'Autre']
  });

  articles = this._articles.asReadonly();
  movements = this._movements.asReadonly();
  users = this._users.asReadonly();
  settings = this._settings.asReadonly();
  
  private getStockEffect(m: Movement | Omit<Movement, 'id'>): number {
    if (m.type === 'Entrée' || m.type === 'Ajustement') {
        return m.quantity;
    }
    // Sortie, Périmé / Rebut
    return -m.quantity;
  }

  stock = computed<StockItem[]>(() => {
    const stockMap = new Map<number, number>();
    this._movements().forEach(m => {
      const current = stockMap.get(m.articleId) ?? 0;
      stockMap.set(m.articleId, current + this.getStockEffect(m));
    });

    return this._articles().map(article => ({
      ...article,
      currentStock: stockMap.get(article.id) ?? 0,
    }));
  });

  // Helpers for validation
  normalizeString(s: string): string {
    return s.toLowerCase().trim().replace(/\s+/g, ' ');
  }
  
  private areSimilar(str1: string, str2: string): boolean {
    return this.normalizeString(str1) === this.normalizeString(str2);
  }

  // Articles
  addArticle(article: Omit<Article, 'id' | 'createdAt' | 'updatedAt' | 'priceHistory'>): Article {
    const existingArticles = this._articles();
    
    if (existingArticles.some(a => a.code.toLowerCase() === article.code.toLowerCase())) {
        throw new ApiError('ARTICLE_CODE_EXISTS');
    }

    const newArticle: Article = { 
      ...article, 
      id: this._nextArticleId++,
      createdAt: this.today(),
      updatedAt: this.today(),
      priceHistory: [{ price: article.price, date: this.today() }]
    };
    this._articles.update(articles => [...articles, newArticle]);
    return newArticle;
  }
  
  addArticles(articles: Omit<Article, 'id' | 'createdAt' | 'updatedAt' | 'priceHistory'>[]): Article[] {
    const existingArticles = this._articles();
    const existingCodes = new Set(existingArticles.map(a => a.code.toLowerCase()));
    const existingNameUnitsNormalized = new Set(existingArticles.map(a => `${this.normalizeString(a.name)}|${a.unit}`));

    const importCodes = new Set<string>();
    const importNameUnits = new Set<string>();

    for (const article of articles) {
        const lowerCode = article.code.toLowerCase();
        const normNameUnit = `${this.normalizeString(article.name)}|${article.unit}`;

        if (existingCodes.has(lowerCode) || importCodes.has(lowerCode)) {
            throw new ApiError('ARTICLE_CODE_EXISTS');
        }
        if (existingNameUnitsNormalized.has(normNameUnit) || importNameUnits.has(normNameUnit)) {
            throw new ApiError('ARTICLE_NAME_UNIT_EXISTS');
        }

        importCodes.add(lowerCode);
        importNameUnits.add(normNameUnit);
    }
    
    const newArticles = articles.map(article => {
       const newArticle: Article = { 
        ...article, 
        id: this._nextArticleId++,
        createdAt: this.today(),
        updatedAt: this.today(),
        priceHistory: [{ price: article.price, date: this.today() }]
      };
      return newArticle;
    });
    this._articles.update(current => [...current, ...newArticles]);
    return newArticles;
  }

  updateArticle(updatedArticle: Article): Article {
    const existingArticles = this._articles();
    const originalArticle = existingArticles.find(a => a.id === updatedArticle.id);
    if (!originalArticle) {
      throw new ApiError('ARTICLE_NOT_FOUND');
    }
    
    if (originalArticle.code.toLowerCase() !== updatedArticle.code.toLowerCase()) {
        if (existingArticles.some(a => a.id !== updatedArticle.id && a.code.toLowerCase() === updatedArticle.code.toLowerCase())) {
            throw new ApiError('ARTICLE_CODE_EXISTS');
        }
    }

    if (!this.areSimilar(originalArticle.name, updatedArticle.name) || originalArticle.unit !== updatedArticle.unit) {
        if (existingArticles.some(a => a.id !== updatedArticle.id && this.areSimilar(a.name, updatedArticle.name) && a.unit === updatedArticle.unit)) {
            throw new ApiError('ARTICLE_NAME_UNIT_EXISTS');
        }
    }

    const newHistory = [...originalArticle.priceHistory];
    if (originalArticle.price !== updatedArticle.price) {
      newHistory.push({ price: updatedArticle.price, date: this.today() });
    }

    const articleToSave: Article = {
      ...updatedArticle,
      updatedAt: this.today(),
      priceHistory: newHistory
    };

    this._articles.update(articles =>
      articles.map(a => (a.id === articleToSave.id ? articleToSave : a))
    );
    return articleToSave;
  }

  deleteArticle(id: number): void {
    if (this._movements().some(m => m.articleId === id)) {
       throw new ApiError("ARTICLE_IN_USE");
    }
    this._articles.update(articles => articles.filter(a => a.id !== id));
  }

  // Movements
  private generateMovementId(): number {
    const now = new Date();
    const pad = (num: number) => num.toString().padStart(2, '0');
    
    const day = pad(now.getDate());
    const month = pad(now.getMonth() + 1);
    const year = now.getFullYear().toString().slice(-2);
    const hours = pad(now.getHours());
    const minutes = pad(now.getMinutes());
    const seconds = pad(now.getSeconds());

    // DDMMYYHHMMSS
    return Number(`${day}${month}${year}${hours}${minutes}${seconds}`);
  }

  addMovement(movement: Omit<Movement, 'id'>): Movement {
    const effect = this.getStockEffect(movement);
    // Do not check for sufficient stock on 'Ajustement' type movements, as they are for correction.
    if (effect < 0 && movement.type !== 'Ajustement') {
      const stockItem = this.stock().find(s => s.id === movement.articleId);
      const currentStock = stockItem?.currentStock || 0;
      const quantityToWithdraw = Math.abs(effect);
      if (currentStock < quantityToWithdraw) {
        const articleName = this._articles().find(a => a.id === movement.articleId)?.name || 'the article';
        throw new ApiError('INSUFFICIENT_STOCK', {
            articleName,
            available: currentStock,
            required: quantityToWithdraw
        });
      }
    }
    const newMovement: Movement = { ...movement, id: this.generateMovementId() };
    this._movements.update(movements => [...movements, newMovement].sort((a,b) => b.id - a.id));
    return newMovement;
  }

  updateMovement(updatedMovement: Movement): Movement {
    const originalMovement = this._movements().find(m => m.id === updatedMovement.id);
    if (!originalMovement) {
      throw new ApiError('MOVEMENT_NOT_FOUND');
    }

    const originalEffect = this.getStockEffect(originalMovement);
    const updatedEffect = this.getStockEffect(updatedMovement);

    if (originalMovement.articleId === updatedMovement.articleId) {
        const stock = this.stock().find(s => s.id === updatedMovement.articleId)!;
        const stockWithoutOriginal = stock.currentStock - originalEffect;
        // Do not check for sufficient stock if the updated movement is an 'Ajustement'
        if (updatedMovement.type !== 'Ajustement' && stockWithoutOriginal + updatedEffect < 0) {
            const articleName = stock.name;
            throw new ApiError('INSUFFICIENT_STOCK', { articleName, available: stockWithoutOriginal, required: Math.abs(updatedEffect) });
        }
    } else {
        // Check new article
        const newArticleStock = this.stock().find(s => s.id === updatedMovement.articleId)!;
        // Do not check for sufficient stock if the updated movement is an 'Ajustement'
        if (updatedMovement.type !== 'Ajustement' && newArticleStock.currentStock + updatedEffect < 0) {
            const articleName = newArticleStock.name;
            throw new ApiError('INSUFFICIENT_STOCK', { articleName, available: newArticleStock.currentStock, required: Math.abs(updatedEffect) });
        }
        // Check old article
        const oldArticleStock = this.stock().find(s => s.id === originalMovement.articleId)!;
        if (oldArticleStock.currentStock - originalEffect < 0) {
             throw new ApiError('INSUFFICIENT_STOCK_ON_DELETE', { articleName: oldArticleStock.name });
        }
    }

    this._movements.update(movements =>
      movements.map(m => (m.id === updatedMovement.id ? updatedMovement : m))
    );
    return updatedMovement;
  }

  deleteMovement(id: number): void {
    const movementToDelete = this._movements().find(m => m.id === id);
    if (!movementToDelete) return;

    const stockItem = this.stock().find(s => s.id === movementToDelete.articleId);
    if (stockItem) {
        const stockAfterDelete = stockItem.currentStock - this.getStockEffect(movementToDelete);
        if (stockAfterDelete < 0) {
            throw new ApiError('INSUFFICIENT_STOCK_ON_DELETE', { articleName: stockItem.name });
        }
    }
    this._movements.update(movements => movements.filter(m => m.id !== id));
  }

  // Users
  authenticate(username: string, password_provided: string): User | null {
    const user = this._users().find(u => u.username === username && u.password === password_provided);
    return user ? { id: user.id, username: user.username, firstName: user.firstName, lastName: user.lastName, role: user.role } : null;
  }

  addUser(user: Omit<User, 'id'>): User {
    const newUser: User = { ...user, id: Date.now() };
    this._users.update(users => [...users, newUser]);
    return newUser;
  }

  updateUser(updatedUser: User): User {
    this._users.update(users =>
      users.map(u => {
        if (u.id === updatedUser.id) {
          const userWithPass = { ...u, ...updatedUser };
          if (!updatedUser.password) {
            userWithPass.password = u.password;
          }
          return userWithPass;
        }
        return u;
      })
    );
    return updatedUser;
  }

  deleteUser(id: number): void {
    this._users.update(users => users.filter(u => u.id !== id));
  }

  // Settings
  updateSettings(key: 'categories' | 'suppliers' | 'destinations' | 'outgoingSubcategories', value: string[]): { categories: string[], suppliers: string[], destinations: string[], outgoingSubcategories: string[] } {
    const currentSettings = this._settings();
    const originalList = currentSettings[key];
    const itemsToDelete = originalList.filter(item => !value.includes(item));
    
    for (const item of itemsToDelete) {
        if (key === 'categories' && this._articles().some(a => a.category === item)) {
            throw new ApiError('CATEGORY_IN_USE', { item });
        }
        if (key === 'suppliers' && this._movements().some(m => m.supplierDest === item && m.type === 'Entrée')) {
            throw new ApiError('SUPPLIER_IN_USE', { item });
        }
        if (key === 'destinations' && this._movements().some(m => m.supplierDest === item && (m.type === 'Sortie' || m.type === 'Périmé / Rebut'))) {
            throw new ApiError('DESTINATION_IN_USE', { item });
        }
        if (key === 'outgoingSubcategories' && this._movements().some(m => m.subcategory === item)) {
            throw new ApiError('SUBCATEGORY_IN_USE', { item });
        }
    }

    this._settings.update(settings => ({ ...settings, [key]: value }));
    return this._settings();
  }
}