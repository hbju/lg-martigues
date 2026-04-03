# 📋 Sprint 4 — Étapes Manuelles (ce que tu dois faire toi-même)

Ce document liste **toutes les étapes que l'agent ne peut pas faire** et que tu dois effectuer manuellement.

---

## 1. 🗄️ Exécuter les migrations SQL dans Supabase

Tu as 2 nouvelles migrations à exécuter dans l'**éditeur SQL** de ton projet Supabase :

### Migration 013 — Triggers d'intégrité + table error_logs
1. Va sur **https://supabase.com/dashboard** → ton projet → **SQL Editor**
2. Copie-colle le contenu de `supabase/migrations/013_sprint4_final_vote.sql`
3. Exécute

### Migration 014 — Colonne metadata sur votes
1. Toujours dans le SQL Editor
2. Copie-colle le contenu de `supabase/migrations/014_votes_metadata.sql`
3. Exécute

> ⚠️ **Vérifie** ensuite dans **Table Editor** que :
> - La table `error_logs` existe
> - La table `votes` a bien une colonne `metadata` (type JSONB)

---

## 2. 🔄 Activer Realtime sur les nouvelles tables

Dans Supabase Dashboard :
1. Va dans **Database → Replication**
2. Vérifie que la table `error_logs` est activée pour Realtime (normalement fait par la migration 013, mais vérifie)

---

## 3. 🌐 Variables d'environnement

Assure-toi que ton fichier `.env` local contient :

```env
VITE_SUPABASE_URL=https://ton-projet.supabase.co
VITE_SUPABASE_ANON_KEY=ta-clé-anon
VITE_APP_URL=https://ton-domaine.vercel.app
```

`VITE_APP_URL` est utilisé pour générer les QR codes de login et de récompense. En production, c'est ton URL Vercel.

---

## 4. 🚀 Déploiement sur Vercel

### Première fois
1. Va sur **https://vercel.com** → "New Project"
2. Connecte ton repo GitHub
3. Framework preset : **Vite**
4. Ajoute les variables d'environnement :
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_APP_URL` (= l'URL Vercel une fois connue, ex: `https://lg-martigues.vercel.app`)
5. Deploy

### Mises à jour
- Chaque `git push` sur `main` déclenche un redéploiement automatique

### Vérification post-déploiement
- [ ] L'app charge sur Android (Chrome)
- [ ] L'app charge sur iOS (Safari)
- [ ] Le login par QR fonctionne
- [ ] La page `/tv` charge correctement

---

## 5. 🎲 Seed des données de production

Une fois déployé avec une base Supabase propre :

1. **Exécute toutes les migrations** (001 à 014) dans l'ordre dans le SQL Editor
2. **Exécute `supabase/seed.sql`** pour créer les 16 joueurs + le MJ
   - ⚠️ Modifie les noms et tokens si nécessaire avant d'exécuter
3. **Crée les challenges** via le dashboard MJ (`/gm/challenges`) :
   - Beer Pong
   - Pub Crawl (équipes + itinéraires)
   - Mad Scientists
4. **Crée les QR récompenses** via `/gm/qr-rewards` :
   - Crée autant de QR que tu veux cacher
   - Note les emplacements dans les labels

---

## 6. 🖨️ Imprimer les QR codes

### QR codes de login (1 par joueur)
1. Va sur `/gm/qr-codes`
2. Clique **📄 Télécharger PDF**
3. Imprime le PDF — 4 cartes par page A4, lignes pointillées pour découper
4. Découpe les cartes

### QR codes récompenses
1. Va sur `/gm/qr-rewards`
2. Clique **📄 PDF QR** pour le PDF des QR à cacher
3. Clique **📋 Aide-mémoire MJ** pour la fiche de référence avec labels + emplacements
4. Imprime les deux
5. Découpe les QR récompenses et cache-les dans la maison

### Impression bonus
- [ ] Imprime la checklist MJ depuis `/gm/checklist` pour avoir une version papier

---

## 7. 📺 Configuration TV

1. Ouvre un navigateur (Chrome recommandé) sur l'écran TV du salon
2. Va sur `https://ton-domaine.vercel.app/tv`
3. Passe en **plein écran** (F11)
4. Désactive la mise en veille de l'écran
5. Vérifie que l'écran idle s'affiche avec l'animation

---

## 8. 🐺 Préparation physique

### Point de rencontre Loups-Garous
- Choisis un lieu de réunion secret pour les loups-garous
- Configure ce texte dans le message de la révélation des rôles (via `game_state.metadata.werewolf_meeting_point` ou directement dans le code si nécessaire)

### Wi-Fi
- Note le nom du réseau Wi-Fi + mot de passe
- Prépare à le communiquer verbalement le vendredi soir

### Enveloppe de secours ("BREAK GLASS")
Prépare une enveloppe scellée contenant :
- [ ] 17 cartes rôles imprimées (13 Villageois, 3 Loups-Garous)
- [ ] Une grille de vote papier (votant × cible)
- [ ] Un stylo + papier pour tracker les éliminations
- [ ] Les instructions pour passer en mode "papier" si l'app plante

---

## 9. 🧹 Dress Rehearsal (PBI-27 — Répétition Générale)

Fais une simulation complète avec ta copine. Voici le scénario :

### Préparation
1. Seed 8 joueurs test (ou utilise les vrais comptes)
2. Imprime les QR de test
3. Cache 3 QR récompenses
4. Ouvre la vue TV
5. Prépare 3-4 appareils (phones, tablettes, onglets navigateur)

### Simulation Vendredi soir
- [ ] Tous les "joueurs" scannent leur QR et se connectent
- [ ] Vérifier le lobby en temps réel
- [ ] MJ assigne les rôles → tous les appareils montrent la révélation
- [ ] Vérifier : loups voient le point de rencontre, villageois non
- [ ] Beer Pong : créer 4 duos, générer bracket, jouer

### Simulation Samedi
- [ ] Vote du conseil #1 : ouvrir, voter depuis plusieurs appareils, timer expire, résolution
- [ ] Meurtre #1 : ouvrir fenêtre, loups votent, MJ confirme → victime devient fantôme
- [ ] Pub Crawl : configurer 2 équipes, tester
- [ ] Vote du conseil #2

### Simulation Dimanche
- [ ] Vote + meurtre supplémentaires
- [ ] Tester infection (loup solitaire → transformation)
- [ ] Mad Scientists : 2 rounds
- [ ] Scanner QR récompense → MJ approuve → vérifier inventaire
- [ ] Tester clairvoyance + bouclier

### Simulation Lundi (Vote Final)
- [ ] Éliminer jusqu'à 6 joueurs
- [ ] Le mode Vote Final s'active
- [ ] Faire une élimination + sondage continuer/arrêter
- [ ] Le groupe vote "arrêter" → révélation finale sur tous les écrans + TV
- [ ] Vérifier le récapitulatif de jeu
- [ ] Tester "Réinitialiser" pour tout remettre à zéro

### Test Offline
- [ ] Passer un appareil en mode avion pendant un vote
- [ ] Vérifier que le vote est mis en file d'attente localement
- [ ] Vérifier la bannière de reconnexion
- [ ] Remettre en ligne → le vote se synchronise (si le round est encore ouvert)

---

## 10. ✅ Checklist Pré-Vol Final (2 avril au soir)

- [ ] Ouvrir l'app de production sur ton téléphone — le login fonctionne
- [ ] Ouvrir l'app sur le téléphone de ta copine — le login fonctionne
- [ ] `/tv` sur la TV — charge et affiche l'écran idle
- [ ] Créer un vote test → voter → résoudre → supprimer les données test
- [ ] Scanner un QR récompense test → approuver → nettoyer
- [ ] Dashboard Supabase : toutes les tables saines, Realtime actif, pas d'erreurs
- [ ] Charger tous les appareils pendant la nuit
- [ ] Vérifier que l'enveloppe de secours est scellée et accessible

---

## Résumé rapide

| Étape | Quoi | Où |
|-------|------|----|
| Migrations SQL | 013 + 014 | Supabase SQL Editor |
| Realtime | Vérifier error_logs | Supabase Dashboard |
| Env vars | 3 variables | `.env` local + Vercel |
| Déploiement | Push sur main | Vercel |
| Seed data | Joueurs + challenges + QR | SQL Editor + App MJ |
| Impression | QR login + QR récompenses + aide-mémoire | `/gm/qr-codes` + `/gm/qr-rewards` |
| TV | Navigateur plein écran | Écran salon |
| Physique | Wi-Fi, enveloppe, point de rencontre | IRL |
| Dress rehearsal | Simulation complète | Multi-appareils |
| Pré-vol | Checklist finale | Tout vérifier |
