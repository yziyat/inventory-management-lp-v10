# Recommandations pour la Mise en Production

Ce document liste les actions recommandées pour préparer l'application "Inventory Management" à un déploiement en production.

## 🚨 Actions Critiques (Priorité Haute)

Ces actions sont indispensables pour la stabilité et la sécurité de l'application.

1.  **Gestion des Dépendances** :
    *   **Problème** : Utilisation de CDNs pour `Tailwind CSS`, `XLSX`, et `D3.js` dans `index.html`.
    *   **Risque** : Dépendance à des services externes, problèmes de performance (chargement bloquant), sécurité, et impossibilité de travailler hors ligne.
    *   **Solution** : Installer ces librairies via npm :
        ```bash
        npm install xlsx d3
        npm install -D tailwindcss postcss autoprefixer
        npx tailwindcss init
        ```
    *   **Tailwind** : Configurer Tailwind correctement via `tailwind.config.js` pour permettre le "tree-shaking" (suppression du CSS inutilisé) et réduire la taille du bundle.

2.  **Environnement d'Exécution** :
    *   S'assurer que **Node.js** (v18 ou v20 LTS) est installé sur le serveur de build/production.

## ⚡ Performance et Optimisation

1.  **Lazy Loading (Chargement à la demande)** :
    *   **Constat** : Actuellement, tous les composants sont chargés au démarrage (`src/routes.ts`).
    *   **Recommandation** : Utiliser `loadComponent` pour charger les pages uniquement quand l'utilisateur y accède.
    *   **Exemple** :
        ```typescript
        {
          path: 'articles',
          loadComponent: () => import('./components/articles/articles.component').then(m => m.ArticlesComponent)
        }
        ```

2.  **Budget de Bundle** :
    *   Configurer les budgets de taille dans `angular.json` pour être averti si l'application devient trop lourde.

## 🔍 SEO et Accessibilité

1.  **Métadonnées (SEO)** :
    *   **Constat** : Titre générique "Inventory LP" et absence de description.
    *   **Action** :
        *   Définir un titre dynamique par page (déjà partiellement en place via `TitleStrategy` ou le code dans `AppComponent`, à vérifier/standardiser).
        *   Ajouter une balise `<meta name="description" content="...">` dans `index.html`.

2.  **Accessibilité (a11y)** :
    *   Ajouter l'attribut `lang="fr"` (ou "en") sur la balise `<html>`.
    *   Vérifier que tous les boutons ont des labels explicites (ou `aria-label` pour les icônes).
    *   S'assurer que le contraste des couleurs (notamment avec Tailwind) respecte les normes WCAG AA.

## 🏗️ Architecture et Backend

1.  **Persistance des Données** :
    *   **Actuel** : Stockage en mémoire (perte de données au refresh).
    *   **Recommandation** : Connecter l'application à une véritable API (Node.js/NestJS, Python/Django, etc.) ou utiliser une solution "Serverless" (Firebase, Supabase).
    *   Créer des `Interceptors` Angular pour gérer les tokens d'authentification (JWT).

2.  **Authentification** :
    *   Remplacer l'authentification "en dur" par un véritable flux OAuth2 ou JWT.

## 🛠️ DevOps et Déploiement

1.  **Docker** :
    *   Créer un `Dockerfile` pour conteneuriser l'application (build multi-stage : build Angular -> serveur Nginx).

2.  **CI/CD** :
    *   Mettre en place un pipeline (GitHub Actions, GitLab CI) pour lancer les tests (`ng test`) et le build (`ng build`) à chaque commit.
