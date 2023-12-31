const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');
const express = require('express');
const fs = require('fs');
require('dotenv').config();

const app = express();
const port = process.env.PORT_DEPLOY || 3000;
let global_logements_precedents = {};

app.get('/', (req, res) => {
    res.send('CROUS Scrapper app').end();
});

app.get('/scrape/:withZoom/:ville/:destinataire', async (req, res) => {
    const ville = req.params.ville;
    const destinataire = req.params.destinataire;
    const zoom = req.params.withZoom === 'zoom' ?? false;

    const regex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/g;
    if (!regex.test(destinataire)) {
        res.status(400).send('Le destinataire doit être un email').end();
    } else {
        const browser = await puppeteer.launch({
            defaultViewport: null,
            args: [
                '--start-maximized',
                `--window-size=1920,1080`,
            ],
            executablePath: process.env.NODE_ENV === 'production' ? process.env.PUPPETEER_EXECUTABLE_PATH : puppeteer.executablePath(),
        });
        await scrape(browser, ville, destinataire, zoom)
            .then((result) => {
                res.status(200).send(result).end();
            })
            .catch((err) => {
                browser.close();
                res.status(500).send('Erreur lors du scraping: ' + err).end();
            });
    }
});

app.listen(port, () => {
    console.log(`CROUS Scrapper app listening at port ${port}`)
});

const scrape = async (browser, ville, destinataire, withZoom) => {
    'use strict';
    ville = ville.charAt(0).toUpperCase() + ville.slice(1);
    const url = 'https://trouverunlogement.lescrous.fr';
    const email = process.env.EMAIL;
    const pwd = process.env.CROUS_PWD;

    const seConnecter = '.fr-icon-account-line';
    const connexionMesservicesEtudiant = '.logo-mse-connect-fr';
    const connectBtn = '.btn-lg';
    const logementIndividuel = '#SearchOccupationMode--alone';
    const lancerUneRechercheBtn = '.svelte-w11odb';
    const searchVille = '#PlaceAutocompletearia-autocomplete-1-input';
    const logement = '.svelte-11sc5my>li';
    const paris = '#PlaceAutocompletearia-autocomplete-1-option--0';
    const openMap = '.toggleListeMap';
    const zoomIn = '.leaflet-control-zoom-in';
    const reloadSearch = '.svelte-1l12jlo';

    const page = await browser.newPage();

    console.log('Chargement...');
    await page.goto(url);
    console.log('Page chargée');

    await page.locator(seConnecter).wait();
    await page.locator(seConnecter).click();
    console.log('Connexion...');

    await page.locator(connexionMesservicesEtudiant).wait();
    await page.locator(connexionMesservicesEtudiant).hover();
    await page.locator(connexionMesservicesEtudiant).click();
    console.log('Connexion en cours...');
    await page.locator('#username').wait();
    await page.type('#username', email);
    await page.type('#password', pwd);
    await page.locator(connectBtn).click();
    console.log('Connexion réussie');

    await page.locator(searchVille).wait();
    await page.type(searchVille, ville);
    console.log(`Recherche de logement à ${ville}`);

    await page.locator(paris).wait();
    await page.locator(paris).click();
    console.log(`Recherche de logement à ${ville} sélectionnée`);

    await page.locator(logementIndividuel).click();
    await page.locator(lancerUneRechercheBtn).wait();
    await page.locator(lancerUneRechercheBtn).click();
    console.log('Recherche en cours...');

    if (withZoom) {
        await page.locator(openMap).wait();
        await page.locator(openMap).click();
        console.log('Ouverture de la carte');

        await page.locator(zoomIn).wait();
        await page.locator(zoomIn).click();
        console.log('Zoom sur la carte');

        await page.locator(reloadSearch).wait();
        await page.locator(reloadSearch).click();
        console.log('Recherche en cours...');
    }

    let logements;
    try {
        await page.locator(logement).wait();
        logements = await page.$$(logement);
        console.log('Récupération des logements');
    } catch (e) {
        console.log('Aucun logement disponible');
        await browser.close();
        return 'Aucun logement disponible';
    }

    const logementsData = [];
    for (const logement of logements) {
        const titre = await logement.$eval('.fr-card__title>a', node => node.innerText);
        const prix = await logement.$eval('.fr-badge', node => node.innerText);
        const adresse = await logement.$eval('.fr-card__desc', node => node.innerText);
        const taille = await logement.$eval('.fr-card__detail', node => node.innerText);
        const url = await logement.$eval('.fr-card__title > a', node => node.href);
        console.log({titre, prix, adresse, taille, url});
        logementsData.push({titre, prix, adresse, taille, url});
    }

    console.log('Récupération des logements terminée');
    await browser.close();

    const logementsActuels = logementsData; // Les logements actuels

    // Charger les logements précédents depuis un fichier JSON (s'il existe)
    let logementsPrecedents = [];

    logementsPrecedents = {...global_logements_precedents};

    console.log(`logementsPrecedents: ${JSON.stringify(logementsPrecedents)}`)
    // Comparer les logements actuels avec les logements précédents
    const nouveauxLogements = logementsActuels.filter((logement) => {
        if (!logementsPrecedents[ville]) {
            return [];
        }
        else return !logementsPrecedents[ville].some((prevLogement) => prevLogement.url === logement.url);
    });

    if (nouveauxLogements.length > 0) {
        console.log('Envoi des données par mail...');
        // Il y a de nouveaux logements, envoyez un e-mail
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.NODEMAILER_USER,
                pass: process.env.NODEMAILER_PASS
            },
        });

        let emailContent = '';
        let emailContentHtml = ``;
        nouveauxLogements.forEach((logement, index) => {
            emailContent += `Nom: ${logement.titre}\n`;
            emailContent += `Prix: ${logement.prix}\n`;
            emailContent += `Adresse: ${logement.adresse}\n`;
            emailContent += `Taille: ${logement.taille}\n`;
            emailContent += `URL: ${logement.url}\n\n`;

            emailContentHtml += `
            <div style="margin-bottom: 18px; margin-top: 0; padding: 8px 16px; box-sizing: border-box; border-radius: 20px; background: #DEDEDE;">
                <h2 style="color: #101820;font-family: 'Arial', sans-serif; font-size: 18px; font-weight: bold; margin-bottom: 8px;">${logement.titre}</h2>
                <p style="color: #101820;font-family: 'Arial', sans-serif; font-size: 14px; margin: 0; padding:0;">
                    <b>Prix</b>
                    <span style="color: #101820; background: white; padding: 3px 12px; border-radius: 25px; box-sizing: border-box; margin-left: 4px;"> ${logement.prix}</span>
                </p>
                <p style="color: #101820;font-family: 'Arial', sans-serif; font-size: 14px; margin: 0; padding: 0;">
                    <b>Adresse</b>
                    <span style="color: #101820; background: white; padding: 3px 12px; border-radius: 25px; box-sizing: border-box; margin-left: 4px;"> ${logement.adresse}</span>
                </p>
                <p style="color: #101820;font-family: 'Arial', sans-serif; font-size: 14px; margin: 0; padding: 0;">
                    <b>Taille</b>
                    <span style="color: #101820; background: white; padding: 3px 12px; border-radius: 25px; box-sizing: border-box; margin-left: 4px;"> ${logement.taille}</span>
                </p>
                <p style="color: #101820;font-family: 'Arial', sans-serif; font-size: 14px; margin: 0; padding: 0;">
                    <b>URL</b>
                    <a style="color: #101820; font-weight: bold; text-decoration: underline; background: white; padding: 3px 12px; border-radius: 25px; box-sizing: border-box; margin-left: 4px;" href="${logement.url}">Accéder au logement</a>
                </p>
            </div>
        `;
        });

        const mailOptions = {
            from: process.env.NODEMAILER_USER,
            to: `${destinataire}`,
            subject: `Nouveaux logements disponibles à ${ville} 🏙`,
            text: emailContent,
            html: emailContentHtml
        };

        await transporter.sendMail(mailOptions);
        logementsPrecedents[ville] = logementsActuels;
        global_logements_precedents = logementsPrecedents;
        console.log('Envoi des données terminé');
        return nouveauxLogements;
    } else {
        console.log('Pas de nouveaux logements');
        return 'Pas de nouveaux logements';
    }
};
