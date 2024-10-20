// Initialise le module
const excel = require('node-excel-export');
const { Op, and, QueryTypes } = require('sequelize');
const logger = require('../utils/logger');
const { check, query } = require('express-validator');

// Charge l'ensemble des functions de l'API
const AxiosFunction = require('../functions/functions.axios');
const SmartFunction = require('../functions/functions.smartadserver.api');
const Utilities = require('../functions/functions.utilities');
const ReportService = require('../services/reportWorkflowService');

// Initialise les models
const ModelAdvertisers = require('../models/models.advertisers');
const ModelCampaigns = require('../models/models.campaigns');
/*
const ModelInsertions = require('../models/models.insertions');
const ModelFormats = require('../models/models.formats');
const ModelSites = require('../models/models.sites');
*/

const LocalStorage = require('node-localstorage').LocalStorage;
const localStorage = new LocalStorage('data/reporting/');
const localStorageTasks = new LocalStorage('data/taskID/');

const { getAvailableFormats } = require('../utils/report'); // Importe la fonction du fichier utils/reports.js

// Gestion des rejets asynchrones non capturés
process.on('unhandledRejection', (error) => {
  logger.error(`unhandledRejection: ${error.message}`);
});

const { differenceInDays, isAfter, isBefore, parseISO, format } = require('date-fns');
const { fr: frLocale } = require('date-fns/locale');
/*
exports.index = async (req, res) => {
  logger.warn('Accès refusé à la route index');
  res.status(403).render('error.ejs', {
    statusCoded: 403,
    message: 'Accès refusé',
  });
};
*/

exports.generate = async (req, res) => {
  const campaigncrypt = req.params.campaigncrypt;

  try {
    // Validation de l'entrée
    if (!campaigncrypt || typeof campaigncrypt !== 'string') {
      logger.warn('Paramètre campaigncrypt invalide');
      return Utilities.handleCampaignNotFound(res, 400, campaigncrypt);
    }

    // Récupération de la campagne
    const campaign = await ModelCampaigns.findOne({
      attributes: [
        'campaign_id',
        'campaign_name',
        'campaign_crypt',
        'advertiser_id',
        'campaign_start_date',
        'campaign_end_date',
      ],
      where: { campaign_crypt: campaigncrypt },
      include: [{ model: ModelAdvertisers }],
    });

    if (!campaign) {
      logger.error(`Erreur lors de la récupération de la campagne avec le crypt: ${campaigncrypt}`);
      return Utilities.handleCampaignNotFound(res, 404, campaigncrypt);
    }

    // Gestion des dates avec date-fns
    const dateNow = new Date();
    const campaignDates = {
      start: parseISO(campaign.campaign_start_date),
      end: parseISO(campaign.campaign_end_date),
      duration: differenceInDays(parseISO(campaign.campaign_end_date), parseISO(campaign.campaign_start_date)),
      formatted_start_date: format(parseISO(campaign.campaign_start_date), 'dd/MM/yyyy', { locale: frLocale }),
      formatted_end_date: format(parseISO(campaign.campaign_end_date), 'dd/MM/yyyy', { locale: frLocale }),
      remainingDays: differenceInDays(parseISO(campaign.campaign_end_date), dateNow),
      daysBeforeStart: differenceInDays(parseISO(campaign.campaign_start_date), dateNow),
    };
      
    // Conditions basées sur la durée de diffusion
    if (campaignDates.duration <= 31) {
      logger.info(`La campagne est courte, récupération des Visiteurs Uniques (VU).`);
      // Logique pour lancer l'instance de récupération des VU
    } else {
      logger.info(`La campagne dépasse 31 jours, pas de récupération des VU.`);
    }

    if (campaignDates.remainingDays > 365) {
      logger.info(`Plus de 365 jours après la diffusion, prise de contact avec la régie recommandée.`);
    }
    if (campaignDates.remainingDays > 0) {
      logger.info(`La campagne est encore active, affichage du bilan si disponible.`);
    } else {
      logger.info(`La campagne est terminée, lancement des requêtes pour le rapport final.`);
    }

    if (campaignDates.daysBeforeStart > 0) {
      logger.info(`La campagne n'a pas encore commencé, lancement des requêtes.`);
    } else {
      logger.info(`La campagne est en attente, message d'attente affiché.`);
    }

    // Gestion du cache
    const cacheStorageID = `campaignID-${campaign.campaign_id}`;
    const reportingData = Utilities.getReportingDataFromCache(cacheStorageID);
   
    if (reportingData) {

      // Obtenir les formats disponibles en fonction des données de reporting
     const availableFormats = getAvailableFormats(reportingData);

      logger.info(`Affichage des données en cache pour la campagne: ${campaign.campaign_id}`);
      return res.render('report/template.ejs', {
        campaign,
        campaignDates,
        utilities: Utilities,
        reporting: reportingData,
        availableFormats: availableFormats
      });
    } else {
     
      logger.info(`Génération du rapport pour la campagne: ${campaign.campaign_id}`);
      return res.render('report/generate.ejs', {
        campaign,
        campaignDates
      });
    }

} catch (error) {
    logger.error(`Erreur lors de la génération du rapport: ${error.message}`);
    return Utilities.handleCampaignNotFound(res, 500, campaigncrypt);
  }
};

exports.report = async (req, res) => {
  const campaigncrypt = req.params.campaigncrypt;
  
  try {
    
     // Validation de l'entrée
     if (!campaigncrypt || typeof campaigncrypt !== 'string') {
      logger.warn('Paramètre campaigncrypt invalide');
      return Utilities.handleCampaignNotFound(res, 400, campaigncrypt);
    }

    // Récupération de la campagne
    const campaign = await ModelCampaigns.findOne({
      attributes: [
        'campaign_id',
        'campaign_name',
        'campaign_crypt',
        'advertiser_id',
        'campaign_start_date',
        'campaign_end_date',
      ],
      where: { campaign_crypt: campaigncrypt },
      include: [{ model: ModelAdvertisers }],
    });

    if (!campaign) {
      logger.error(`Erreur lors de la récupération de la campagne avec le crypt: ${campaigncrypt}`);
      return Utilities.handleCampaignNotFound(res, 404, campaigncrypt);
    }

    // Gestion des dates avec date-fns
    const dateNow = new Date();

    // Utilisez parseISO pour convertir les dates ISO en objets Date
    const campaignStartDate = parseISO(campaign.campaign_start_date);
    const campaignEndDate = parseISO(campaign.campaign_end_date);

    const campaignDates = {
      start: parseISO(campaign.campaign_start_date),
      end: parseISO(campaign.campaign_end_date),
      request_start_date: format(campaignStartDate, "yyyy-MM-dd'T'HH:mm:ss"),
      request_start_end: format(campaignEndDate, "yyyy-MM-dd'T'HH:mm:ss"),
      duration: differenceInDays(parseISO(campaign.campaign_end_date), parseISO(campaign.campaign_start_date)),
      formatted_start_date: format(parseISO(campaign.campaign_start_date), 'dd/MM/yyyy', { locale: frLocale }),
      formatted_end_date: format(parseISO(campaign.campaign_end_date), 'dd/MM/yyyy', { locale: frLocale }),
      remainingDays: differenceInDays(parseISO(campaign.campaign_end_date), dateNow),
      daysBeforeStart: differenceInDays(parseISO(campaign.campaign_start_date), dateNow),
    };
   
  // Récupére les instances pour le reporting de la campagne et la partie VU
   const reportId = await ReportService.fetchReportId(campaignDates.request_start_date, campaignDates.request_start_end, campaign.campaign_id, false);
   const reportIdVU = await ReportService.fetchReportId(campaignDates.request_start_date, campaignDates.request_start_end, campaign.campaign_id, true);
   
   res.json({ reportId,reportIdVU });

  } catch (error) {
    logger.error(`Erreur lors de la génération du rapport: ${error.message}`);
    return Utilities.handleCampaignNotFound(res, 500, campaigncrypt);
  }
}