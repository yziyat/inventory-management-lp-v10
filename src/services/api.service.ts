import { Injectable, signal, computed, inject } from '@angular/core';
import { Article, PriceHistory } from '../models/article.model';
import { Movement, MovementType } from '../models/movement.model';
import { User, UserRole } from '../models/user.model';
import { StockItem } from '../models/stock-item.model';
import { ApiError } from './api-error';
import { FirestoreService } from './firestore.service';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private firestoreService = inject(FirestoreService);

  private today(): string {
    return new Date().toISOString().split('T')[0];
  }

  // Signals for data - will be updated by Firestore listeners
  private _articles = signal<Article[]>([]);
  private _movements = signal<Movement[]>([]);
  private _users = signal<User[]>([]);
  private _settings = signal<{
    categories: string[];
    units: string[];
    suppliers: string[];
    destinations: string[],
    outgoingSubcategories: string[]
  }>({
    categories: ['Médicaments', 'Fournitures', 'Consommables', 'Autres'],
    units: ['Boîte', 'Unité', 'Paquet', 'Flacon', 'Tube'],
    suppliers: ['Fournisseur A', 'Dépôt Central'],
    destinations: ['Service 1', 'Périmé'],
    outgoingSubcategories: ['Dispensation Patient', 'Dotation Service', 'Transfert Inter-dépôt', 'Autre']
  });

  articles = this._articles.asReadonly();
  movements = this._movements.asReadonly();
  users = this._users.asReadonly();
  settings = this._settings.asReadonly();

  constructor() {
    // Initialize Firestore listeners
    this.initializeFirestoreListeners();
  }

  private initializeFirestoreListeners(): void {
    // Listen to articles collection
    this.firestoreService.onCollectionSnapshot<Article>('articles', (articles) => {
      this._articles.set(articles.sort((a, b) => a.id > b.id ? -1 : 1));
    });

    // Listen to movements collection
    this.firestoreService.onCollectionSnapshot<Movement>('movements', (movements) => {
      this._movements.set(movements.sort((a, b) => a.id > b.id ? -1 : 1));
    });

    // Listen to users collection
    this.firestoreService.onCollectionSnapshot<User>('users', (users) => {
      this._users.set(users);
    });

    // Listen to settings document
    this.firestoreService.onDocumentSnapshot('settings', 'global', (settings) => {
      if (settings) {
        this._settings.set(settings as any);
      }
    });
  }

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
    return s.toLowerCase().trim().replace(/\\s+/g, ' ');
  }

  private areSimilar(str1: string, str2: string): boolean {
    return this.normalizeString(str1) === this.normalizeString(str2);
  }

  // ============ ARTICLES ============

  async addArticle(article: Omit<Article, 'id' | 'createdAt' | 'updatedAt' | 'priceHistory'>): Promise<Article> {
    const existingArticles = this._articles();

    if (existingArticles.some(a => a.code.toLowerCase() === article.code.toLowerCase())) {
      throw new ApiError('ARTICLE_CODE_EXISTS');
    }

    const newArticle: Omit<Article, 'id'> = {
      ...article,
      createdAt: this.today(),
      updatedAt: this.today(),
      priceHistory: [{ price: article.price, date: this.today() }]
    };

    const id = await this.firestoreService.addDocument<Omit<Article, 'id'>>('articles', newArticle);
    return { ...newArticle, id: parseInt(id) } as Article;
  }

  async addArticles(articles: Omit<Article, 'id' | 'createdAt' | 'updatedAt' | 'priceHistory'>[]): Promise<Article[]> {
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

    const newArticles: Article[] = [];
    for (const article of articles) {
      const newArticle: Omit<Article, 'id'> = {
        ...article,
        createdAt: this.today(),
        updatedAt: this.today(),
        priceHistory: [{ price: article.price, date: this.today() }]
      };
      const id = await this.firestoreService.addDocument<Omit<Article, 'id'>>('articles', newArticle);
      newArticles.push({ ...newArticle, id: parseInt(id) } as Article);
    }
    return newArticles;
  }

  async updateArticle(updatedArticle: Article): Promise<Article> {
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

    await this.firestoreService.setDocument('articles', articleToSave.id.toString(), articleToSave);
    return articleToSave;
  }

  async deleteArticle(id: number): Promise<void> {
    if (this._movements().some(m => m.articleId === id)) {
      throw new ApiError("ARTICLE_IN_USE");
    }
    await this.firestoreService.deleteDocument('articles', id.toString());
  }

  // ============ MOVEMENTS ============

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

  async addMovement(movement: Omit<Movement, 'id'>): Promise<Movement> {
    const effect = this.getStockEffect(movement);
    // Do not check for sufficient stock on 'Ajustement' type movements
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
    await this.firestoreService.setDocument('movements', newMovement.id.toString(), newMovement);
    return newMovement;
  }

  async updateMovement(updatedMovement: Movement): Promise<Movement> {
    const originalMovement = this._movements().find(m => m.id === updatedMovement.id);
    if (!originalMovement) {
      throw new ApiError('MOVEMENT_NOT_FOUND');
    }

    const originalEffect = this.getStockEffect(originalMovement);
    const updatedEffect = this.getStockEffect(updatedMovement);

    if (originalMovement.articleId === updatedMovement.articleId) {
      const stock = this.stock().find(s => s.id === updatedMovement.articleId)!;
      const stockWithoutOriginal = stock.currentStock - originalEffect;
      if (updatedMovement.type !== 'Ajustement' && stockWithoutOriginal + updatedEffect < 0) {
        const articleName = stock.name;
        throw new ApiError('INSUFFICIENT_STOCK', {
          articleName,
          available: stockWithoutOriginal,
          required: Math.abs(updatedEffect)
        });
      }
    } else {
      // Check new article
      const newArticleStock = this.stock().find(s => s.id === updatedMovement.articleId)!;
      if (updatedMovement.type !== 'Ajustement' && newArticleStock.currentStock + updatedEffect < 0) {
        const articleName = newArticleStock.name;
        throw new ApiError('INSUFFICIENT_STOCK', {
          articleName,
          available: newArticleStock.currentStock,
          required: Math.abs(updatedEffect)
        });
      }
      // Check old article
      const oldArticleStock = this.stock().find(s => s.id === originalMovement.articleId)!;
      if (oldArticleStock.currentStock - originalEffect < 0) {
        throw new ApiError('INSUFFICIENT_STOCK_ON_DELETE', { articleName: oldArticleStock.name });
      }
    }

    await this.firestoreService.setDocument('movements', updatedMovement.id.toString(), updatedMovement);
    return updatedMovement;
  }

  async deleteMovement(id: number): Promise<void> {
    const movementToDelete = this._movements().find(m => m.id === id);
    if (!movementToDelete) return;

    const stockItem = this.stock().find(s => s.id === movementToDelete.articleId);
    if (stockItem) {
      const stockAfterDelete = stockItem.currentStock - this.getStockEffect(movementToDelete);
      if (stockAfterDelete < 0) {
        throw new ApiError('INSUFFICIENT_STOCK_ON_DELETE', { articleName: stockItem.name });
      }
    }
    await this.firestoreService.deleteDocument('movements', id.toString());
  }

  // ============ USERS ============

  async addUser(user: Omit<User, 'id'>): Promise<User> {
    const newUser: Omit<User, 'id'> = { ...user };
    const id = await this.firestoreService.addDocument<Omit<User, 'id'>>('users', newUser);
    return { ...newUser, id } as User;
  }

  async updateUser(updatedUser: User): Promise<User> {
    const existingUser = this._users().find(u => u.id === updatedUser.id);
    if (!existingUser) {
      throw new ApiError('USER_NOT_FOUND');
    }

    const userToSave = { ...updatedUser };
    if (!updatedUser.password) {
      userToSave.password = existingUser.password;
    }

    await this.firestoreService.setDocument('users', updatedUser.id.toString(), userToSave);
    return userToSave;
  }

  async deleteUser(id: string): Promise<void> {
    await this.firestoreService.deleteDocument('users', id);
  }

  // ============ SETTINGS ============

  async updateSettings(
    key: 'categories' | 'units' | 'suppliers' | 'destinations' | 'outgoingSubcategories',
    value: string[]
  ): Promise<{ categories: string[], units: string[], suppliers: string[], destinations: string[], outgoingSubcategories: string[] }> {
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

    const updatedSettings = { ...currentSettings, [key]: value };
    await this.firestoreService.setDocument('settings', 'global', updatedSettings);
    return updatedSettings;
  }

  // ============ AUTHENTICATION (Legacy - now handled by FirebaseAuthService) ============

  authenticate(username: string, password_provided: string): User | null {
    // This method is deprecated and should not be used
    // Authentication is now handled by FirebaseAuthService
    console.warn('ApiService.authenticate() is deprecated. Use FirebaseAuthService instead.');
    return null;
  }
}