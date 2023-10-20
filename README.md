# scrapper-logement-crous
Scrapper pour récupérer des logements crous pour une ville et les recevoir par mail

## Utilisation
### Environnement
Un fichier .env est necessaire pour savoir avec quel compte se connecter sur `trouverunlogement.lescrous.fr`.
- `EMAIL` est l'email de connexion au site
- `CROUS_PWD` est le mot de passe
- `NODEMAILER_USER` est le compte gmail qui va servir à envoyer des mail
- `NODEMAILER_PASS` est le mot de passe d'application lié au compte gmail [(En savoir plus...)](https://support.google.com/accounts/answer/185833?hl=fr)
- `PORT_DEPLOY` est le port sur lequel déployer l'application.

Voici un exemple de fichier :
```env
EMAIL=example@example.com
CROUS_PWD=pass
NODEMAILER_USER=example2@example2.com
NODEMAILER_PASS='pass app gmail'
PORT_DEPLOY=3001
```
### Route
La route `http://endpoint:port/scrape/:zoom/:ville/:destinataire` permet de lancer le scraping.

### Déploiement
L'application peut être facilement déployée sur render.com et un Google Cloud Scheduler peut appeler la route avec les bons paramètres pour notifier régulièrement par mail les logements disponibles.

## Exemples
### 1
`curl http://localhost:3001/scrape/zoom/Paris/example@example.com`
Permet de récupérer les logements à `Paris` et de les envoyer par mail à `example@example.com`. `zoom` permet de cliquer une fois sur le zoom de la carte pour restreindre un peu plus la recherche.
### 2
`curl http://localhost:3001/scrape/noZoom/Marseille/example@example.com`
Permet de récupérer les logements à `Marseille` et de les envoyer par mail à `example@example.com`. `noZoom` ou toute valeur différente de `zoom` permet de ne pas zoomer sur la carte et d'avoir une recherche un peu plus large.
