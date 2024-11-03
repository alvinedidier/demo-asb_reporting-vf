const { validateParam } = require('../utils/validationRoute');
const router = require("express").Router();
const Sequelize = require('sequelize');
const report = require("../controllers/controllers.report.arsb");

// Utilisation de la fonction utilitaire pour valider les paramètres
const validateCampaignCrypt = validateParam('campaigncrypt', 'string');
const validateCampaignId = validateParam('campaignid', 'int');
const logger = require('../utils/logger');
const {
  getAvailableFormats
} = require('../utils/report'); // Importe la fonction du fichier utils/reports.js
const {
  getReportIds,
  setReportIdsWithExpiry,
  getInstanceIds,
  setInstanceIdsWithExpiry,
  getCampaignId,
  setCampaignIdWithExpiry
} = require('../utils/localStorageHelper'); // Import des fonctions de gestion du cache

const {
  ReportBuildJson
} = require('../utils/reportHelper');

// Gestion du reporting de l'API
router.get("/", (req, res) => res.status(403).render('error.ejs', {
  statusCoded: 404,
  message: 'Accès refusé',
}) );

// Endpoint pour générer le rapport et envoyer la progression
const fs = require('fs');
const path = require('path');

const {
  differenceInDays,
  isAfter,
  isBefore,
  parseISO,
  format
} = require('date-fns');
const {
  fr: frLocale
} = require('date-fns/locale');

const currentDate = new Date(); // Obtenez la date actuelle
const formattedDate = format(currentDate, 'yyyy/MM/dd'); // Formater la date comme souhaité

router.get('/verify/:campaignid', validateCampaignId, async (req, res) => {
  try {
    const campaignId = req.params.campaignid;

    // Fonction utilitaire pour générer un pourcentage de progression aléatoire
    function getRandomProgress(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Fonction utilitaire pour générer un délai aléatoire en millisecondes
    function delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Vérifie l'existence d'un fichier de données JSON
    function fileExists(filePath) {
      return new Promise((resolve) => {
        fs.access(filePath, fs.constants.F_OK, (err) => {
          resolve(!err);
        });
      });
    }

    // Envoie chaque étape avec un délai
    async function sendProgress(step, minProgress, maxProgress) {
      const progress = getRandomProgress(minProgress, maxProgress);
      res.write(JSON.stringify({ step, progress }) + '\n');
      await delay(getRandomProgress(300, 700));
    }

    // Envoie la progression des étapes
    await sendProgress('initialisation', 5, 15);

    // Vérifie si le report JSON est disponible
    const reportFilePath = path.join(__dirname, `data/reportIds/${formattedDate}/reportIds-${campaignId}.json`);
    const reportExists = await fileExists(reportFilePath);
    if (reportExists) {
      await sendProgress('reportDataRetrieved', 20, 30);
    } 

    // Vérifie si les instances JSON sont disponibles
    const instanceFilePath = path.join(__dirname, `data/instanceIds/${formattedDate}/instanceIds-${campaignId}.json`);
    const instanceExists = await fileExists(instanceFilePath);
    if (instanceExists) {
      await sendProgress('instanceDataRetrieved', 40, 60);
    } 

    // Vérifie si la campagne JSON est disponible
    const campaignFilePath = path.join(__dirname, `data/reporting/${formattedDate}/campaignID-${campaignId}.json`);
    const campaignExists = await fileExists(campaignFilePath);
    if (campaignExists) {
      await sendProgress('campaignDataRetrieved', 70, 85);
    } 

    // Fin du processus
    await sendProgress('completed', 100, 100);
    res.end();

  } catch (error) {
    console.error('Erreur lors de la génération du rapport :', error);
    if (!res.headersSent) {
      res.status(500).send('Erreur lors de la génération du rapport.');
    }
  }
});

router.get("/:campaigncrypt", validateCampaignCrypt, report.generate);
router.post("/:campaigncrypt/report", validateCampaignCrypt, report.report);

/*
//router.get("/report/:campaigncrypt", validateCampaignCrypt, report.report);

router.get("/:campaigncrypt/export", validateCampaignCrypt, (req, res) => {
  res.send(`Export report for campaign: ${req.params.campaigncrypt}`);
});

router.get("/automate/:campaignid/", validateCampaignId, (req, res) => {
  res.send(`Automate report for campaign: ${req.params.campaignid}`);
});
*/
module.exports = router;
