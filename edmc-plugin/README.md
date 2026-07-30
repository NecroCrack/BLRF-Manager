# Plugin EDMC — BLRF Squadron Manager

Ce plugin pour [EDMC](https://github.com/EDCD/EDMarketConnector) (Elite Dangerous Market Connector) alimente automatiquement deux fonctionnalités de l'application :

- **Onglet Membres** : votre système actuel, mis à jour à chaque saut.
- **Onglet Colonisation** : la progression des chantiers de construction quand vous êtes à quai dessus.

Aucune de ces deux fonctionnalités ne peut être alimentée sans ce plugin (ni Inara, ni aucune API publique ne fournit ces informations de façon fiable pour un suivi d'escadron).

## Installation

1. Dans EDMC : **Fichier > Paramètres > Plugins > Ouvrir le dossier des plugins**.
2. Copier ce dossier (`edmc-plugin/`) tel quel dans le dossier qui s'ouvre. Vous pouvez le renommer si vous le souhaitez (ex. `blrf-squadron-manager`).
3. Redémarrer EDMC.
4. Un nouvel onglet **BLRF Squadron Manager** apparaît dans les paramètres d'EDMC (onglet Plugins).

## Configuration

Dans l'onglet du plugin (EDMC > Paramètres > Plugins > BLRF Squadron Manager) :

- **URL du serveur** : l'adresse de l'application (ex. `https://blrf.onrender.com` une fois déployée, ou `http://localhost:3001` en local pour du test).
- **Jeton personnel** : généré depuis l'application, dans **Paramètres de compte > Plugin EDMC > Générer un jeton**. Le jeton n'est affiché qu'une seule fois à la génération — copiez-le immédiatement dans ce champ. Si vous le perdez, régénérez-en un nouveau (l'ancien est alors invalidé).

Aucune autre configuration n'est nécessaire : le plugin envoie automatiquement les informations dès que vous jouez, sans action supplémentaire de votre part.

## Confidentialité

Le plugin n'envoie que : votre système actuel, et — uniquement quand vous êtes à quai sur un chantier de colonisation — le nom du site et sa progression. Aucune autre donnée de jeu (finances, cargo, combat, etc.) n'est transmise.

## En cas de problème

- Vérifiez que l'URL du serveur ne se termine pas par un `/`.
- Vérifiez que le jeton a bien été copié en entier (pas d'espace avant/après).
- Le plugin échoue silencieusement si le serveur est injoignable — cela ne bloque jamais EDMC ni le jeu, mais rien ne sera mis à jour dans l'app tant que la configuration n'est pas correcte.
