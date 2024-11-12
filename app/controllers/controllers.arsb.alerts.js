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
  format,
  subHours,
  subDays
} = require('date-fns');
const {
  fr: frLocale
} = require('date-fns/locale');

const currentDate = new Date(); // Obtenez la date actuelle
const formattedDate = format(currentDate, 'yyyy/MM/dd'); // Formater la date comme souhaité

const LocalStorage = require('node-localstorage').LocalStorage;
const localStorage = new LocalStorage('data/reporting/');
const localStorageAlerts = new LocalStorage(`data/alerts/${formattedDate}/`);

const {
  getAvailableFormats
} = require('../utils/report'); // Importe la fonction du fichier utils/reports.js
const {
  setReportWithExpiry,
  getReport,
  setInstanceWithExpiry,
  getInstance,
  setCampaignsWithExpiry,
  getCampaigns,
  deleteAllCampaignData
} = require('../utils/localStorageHelper'); // Import des fonctions de gestion du cache

const {
  ReportBuildJsonNow
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
    // const startDate = format(startOfDay(new Date()), "yyyy-MM-dd'T'HH:mm:ss");
    // Retarde startDate d'une heure
    const startDate = format(startOfDay(new Date()), "yyyy-MM-dd'T'00:00:00");
    const endDate = 'NOW';
  /*
   
    console.log(startDate,' --------------------------------', endDate);

    let instanceId = getInstance();
    if (instanceId) {
    const reportJsonResult = await ReportBuildJsonNow(instanceId.instanceId);
    return res.status(200).json(reportJsonResult);
    } else {
     return res.status(500).json("kfhsdfhsdljfmlksdj ");
    }
   */
 
  // try {
      // Récupération de l'ID du rapport
    let reportId = getReport();
      if (!reportId) {
        reportId = await ReportService.fetchReportId(startDate, endDate);
        if (!reportId) {
          logger.error(`Erreur: reportId non attribué pour les campagnes`);
          return res.status(500).json({ success: false, message: "Impossible de générer un reportId pour les campagnes du jour" });
        }
        setReportWithExpiry(reportId, 2 * 60 * 60 * 1000); // Cache pour 2 heures
        logger.info(`ReportId ${reportId} sauvegardé dans le cache pour la campagne`);
      }
  
      // Récupération de l'instance ID
      let instanceId = getInstance();
      if (!instanceId) {
        const instanceData = await ReportService.fetchReportDetails(reportId);
        instanceId = await ReportService.fetchCsvData(instanceData);
        setInstanceWithExpiry(instanceId, 24 * 60 * 60 * 1000);
      }
  
      // Construction du rapport JSON
      const reportJsonResult = await ReportBuildJsonNow(instanceId);
      logger.info(`Affiche le résultat du rapport json des campagnes`);
      return res.status(200).json({ success: true, data: instanceId });
     /*
      let instanceId = getInstance();
      if (instanceId) {
      const reportJsonResult = await ReportBuildJsonNow(instanceId);
      return res.status(200).json(reportJsonResult);
      } else {
       return res.status(500).json("kfhsdfhsdljfmlksdj ");
      }
     */
   /* } catch (error) {
      logger.error(`Erreur lors de la récupération des alertes :`, error);
      return res.status(500).json({ success: false, message: `Erreur lors de la récupération des alertes : ${error}` });
    }*/
  };
