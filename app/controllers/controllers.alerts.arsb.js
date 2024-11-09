const {
  Op,
  and,
  QueryTypes
} = require('sequelize');
const logger = require('../utils/logger');
const {
  check,
  query
} = require('express-validator');

// Charge l'ensemble des functions de l'API
const AxiosFunction = require('../functions/functions.axios');
const SmartFunction = require('../functions/functions.smartadserver.api');
const Utilities = require('../functions/functions.utilities');
const ReportService = require('../services/reportWorkflowService');

// Initialise les models
const ModelAdvertisers = require('../models/models.advertisers');
const ModelCampaigns = require('../models/models.campaigns');
const ModelInsertions = require('../models/models.insertions');

const {
  differenceInDays,
  isAfter,
  isBefore,
  parseISO,
  startOfDay,
  format
} = require('date-fns');
const {
  fr: frLocale
} = require('date-fns/locale');

const currentDate = new Date(); // Obtenez la date actuelle
const formattedDate = format(currentDate, 'yyyy/MM/dd'); // Formater la date comme souhaité

const LocalStorage = require('node-localstorage').LocalStorage;
const localStorage = new LocalStorage('data/reporting/');
// const localStorageReportIds = new LocalStorage(`data/instanceIds/${formattedDate}/`);

const {
  getAvailableFormats
} = require('../utils/report'); // Importe la fonction du fichier utils/reports.js
const {
  getReportIds,
  setReportIdsWithExpiry,
  getInstanceIds,
  setInstanceIdsWithExpiry,
  getCampaignId,
  setCampaignIdWithExpiry,
  deleteAllCampaignData
} = require('../utils/localStorageHelper'); // Import des fonctions de gestion du cache

const {
  ReportBuildJson
} = require('../utils/reportHelper');

// Gestion des rejets asynchrones non capturés
process.on('unhandledRejection', (error) => {
  logger.error(`unhandledRejection: ${error.message}`);
});

   /*
   1. Analyse les campagnes du jours : Extrait un rapport avec les campagnes du jour - Api Report

  // 2. Recherche l'ensemble des campagnes du jours pour récupérer les infos - Api Manage
 
   - Recherche l'ensemble des campagnes
   - Recherche l'ensemble des insertions
   - Recherche l'ensemble des templates 
  */

   exports.campaigns = async (req, res) => {
    // Formatage de la date de début à aujourd'hui à minuit (UTC)
    const startDate = format(startOfDay(new Date()), "yyyy-MM-dd'T'HH:mm:ss");
    const endDate = 'NOW';
   
    try {
      // Récupération de l'ID du rapport via fetchReportId
      const reportResponse = await ReportService.fetchReportId(startDate, endDate);
      console.log(reportResponse);
      // Journalisation et envoi de la réponse au client
      logger.info('Rapport de campagne récupéré avec succès');
      res.status(200).json({ success: true, data: reportResponse });
  
    } catch (error) {
      logger.error('Erreur lors de la récupération des alertes :', error.message);
      res.status(500).json({ success: false, message: 'Erreur lors de la récupération des alertes' });
    }
  };