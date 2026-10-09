# Mail Quest — Audit de sécurité : plan d'implémentation

Suivi de l'audit complet (voir détail dans la session). Légende : ⬜ à faire / ✅ fait.

## Étape 0 — Manuelle (hors code, à faire par le propriétaire)
- ⬜ Rotation des secrets exposés dans les transcripts de session : 4 mots de passe mail (IMAP/SMTP), DATABASE_URL Neon, clé API cron-job.org. Puis mettre à jour Vercel + `.env.local` + `pass`.
  (✅ `CRON_SECRET` déjà rotaté : Vercel + pass + .env.local + headers des 2 jobs cron-job.org.)

## Étape 1 — Failles critiques
- ✅ C1 XSS mails : sanitize-html serveur (getMessage/getDraft), variantes `html` / `htmlNoImg` (images distantes bloquées par défaut + bouton « afficher »), iframe sandboxé `allow-same-origin allow-popups` (jamais `allow-scripts`), liens `target=_blank rel=noopener`, auto-height via contentDocument.
- ✅ H2 Headers : CSP, nosniff, Referrer-Policy, Permissions-Policy, poweredByHeader off (next.config.ts).
- ✅ C2+B1+B7 Injection d'en-têtes : createReplyDraft via nodemailer MailComposer, destinataire validé, Reply-To du mail original, In-Reply-To/References, encodage RFC2047 auto, marqueur `X-Mail-Quest: ai`.
- ✅ B2 Correspondance exacte des expéditeurs (deleteFromSender, mutedUnseen, filtres).

## Étape 2 — Authentification renforcée
- ✅ H3 Sessions aléatoires révocables (table `sessions`, expiration 90 j), vérif DB dans proxy, routes publiques en comparaison exacte, déconnexion qui purge le snapshot localStorage.
- ✅ H4 Cron fail-closed : 503 si CRON_SECRET absent, comparaison timing-safe (helper partagé cron+reminders).
- ✅ M8 Jeton bot limité à GET/POST sur tasks/notes + comparaison timing-safe.
- ✅ M5 Rate-limit /api/auth (table login_attempts, 20 essais/15 min/IP → 429).
- ✅ M6 Garde CSRF : mutations /api exigent Sec-Fetch-Site same-origin/none ou Origin même hôte ; content-type JSON requis.
- ✅ M3 `mailbox` résolu côté serveur (findMailbox \Drafts), uid `Number.isInteger && >0`, account validé.
- ✅ M1 Erreurs génériques au client (console.error serveur) via wrapper commun.
- ✅ M2 Clé Gemini en header x-goog-api-key.
- ✅ M4 Allowlist d'endpoints push (FCM/Mozilla/Apple/Windows) + tailles max.
- ✅ M7 Snapshot localStorage effacé à la déconnexion (+ bouton 🔒 dans le tiroir).

## Étape 3 — Fiabilité & bugs
- ✅ H5 Anti prompt-injection : systemInstruction + délimitation contenu non fiable + badge « IA » sur brouillons générés.
- ✅ B3 Fenêtre « derniers messages » après filtrage des bannis.
- ✅ B4 Purge des abonnements push 404/410.
- ✅ B5 Envoi idempotent (flag moved → avertissement client).
- ✅ B6 SW : cache shell uniquement pour "/".
- ✅ B8 Transactions pour reorderTasks/reorderNotes/setInboxOrder.
- ✅ B9 Dédup in-flight du cache overview.
- ✅ B10 Hydratation offline (init false, puis effect).
- ✅ B11 try/catch togglePush.
- ✅ B12 notificationclick → focus client existant ; tag par compte.
- ✅ B13 min=aujourd'hui dans DateTimeInput + clamp jour 31.
- ✅ B14 garde uid NaN pour pièces jointes.
- ✅ B15 Toast : reset du timer précédent.
- ✅ B16 Timeout Gemini (AbortSignal).
- ✅ L1 filename* UTF-8 + nosniff sur pièces jointes.
- ✅ L2 REMINDER_TO requis pour l'envoi (sinon skip loggé).
- ✅ B7bis MIME correct via MailComposer (fait avec C2).

## Étape 4 — Refactors & qualité
- ✅ Découpage page.tsx : hooks (useOfflineSync, usePush, useInstallPrompt, useToast) + composants (Sheet, ConfirmDialog, MessageReader, EmailBody).
- ✅ lib/api.ts : isUuid partagé, parseJson (content-type), erreurs.
- ✅ lib/dates.ts : fmt courts partagés.
- ✅ ai.ts : helper callGemini mutualisé.
- ✅ imap.ts : addr() unique, mapping enveloppe→InboxItem partagé, getDraft réutilise downloadRaw.
- ✅ Aside/mute via l'outbox offline ; édition de la date d'échéance dans AgendaPanel ; effets mis en pause quand panneaux cachés ; grille HUD dynamique.
- ✅ Tests vitest (items, dates, validate, safeEq) + workflow CI GitHub.
- ✅ README réel (env, architecture, menaces).

## Étape 5 — Vérif & livraison
- ✅ lint + tsc + vitest + build verts.
- ✅ Diff final relu, aucun secret, prêt à commit/push sur demande.

## Étape 6 — Retour de review (2e passe)
- ✅ R1 `headerAddresses`/`extractAddress` : `To:` avec display name « Jean <a@b> » et listes multi-destinataires acceptés par createReplyDraft ; findOriginalMessage matche l'adresse extraite (plus de subject-only fallback).
- ✅ R2 Rate-limit login : `x-real-ip` puis dernier XFF (plus jamais la 1re entrée client-contrôlée) ; seuls les échecs comptent.
- ✅ R3 CSRF vérifié avant l'early-return des routes publiques (/api/auth protégé aussi).
- ✅ R4 `Sheet.panelClass` remplace la max-h par défaut (conflit 70/80dvh).
- ✅ R5 `apiError` déplacé vers `lib/client.ts` (next/server hors du bundle client).
- ✅ R6 `listAsides` sans catch silencieux (500 explicite au lieu de "cleared:0").
- ✅ R7 Scan muté en 2 passes : `1:*` enveloppes+flags, `bodyStructure` seulement sur la fenêtre.
- ✅ R8 Badge IA : valeur exacte `x-mail-quest: ai` (enveloppe ET headers parsés).
- ✅ R9 notes PATCH exige `body` string (plus de wipe par oubli de champ).
- ✅ R10 Sujet des rappels sanitizé (CRLF retirés).
- ✅ Vérif : tsc + eslint + 30 vitest + build — tout vert.

## Étape 7 — Retour de review (3e passe)
- ✅ R11 `htmlNoImg` : attribut `style` retiré — les CSS `url()` (background-image, list-style-image, cursor…) ne contournent plus le blocage des pixels-espions. Test de régression ajouté.
- ✅ R12 `isAuthed` mort retiré d'auth.ts.
- ✅ R13 `improveMissive` : refresh() en catch — la carte retirée optimistement est restaurée sur échec.
- ✅ R14 Sessions : SHA-256 du jeton en DB (un leak de la table ne donne aucun jeton utilisable).
- ✅ R15 `sessionCache` proxy : sweep des entrées expirées au-delà de 500.
- ✅ R16 Bucket "unknown" du rate-limit documenté (hors Vercel).
- ✅ R17 Warn REMINDER_TO une fois par process (plus de spam par overview).
- ✅ R18 createReplyDraft : fallback sur To si le Reply-To est entièrement invalide.
- ✅ R19 `DateTimeInput.setTime` passe par `apply()` (min respecté si jamais il porte une heure).
- ✅ R20 reorderTasks/reorderNotes : no-op sur liste vide.
- ✅ R21 `/api/draft/improve` : `moved:false` remonté si l'original n'a pas pu être rangé (pas de 500 qui pousserait à retenter en doublon).
- ✅ R22 `ai` propagé sur getMessage/findOriginalMessage (+attachments sur findOriginalMessage).
- ✅ Vérif : tsc + eslint + 31 vitest + build — tout vert.
