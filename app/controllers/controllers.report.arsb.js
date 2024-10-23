// Initialise le module
const excel = require('node-excel-export');
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
/*

const ModelFormats = require('../models/models.formats');
const ModelSites = require('../models/models.sites');
*/

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

const LocalStorage = require('node-localstorage').LocalStorage;
const localStorage = new LocalStorage('data/reporting/');
//const localStorageReportIds = new LocalStorage(`data/instanceIds/${formattedDate}/`);

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

// Gestion des rejets asynchrones non capturés
process.on('unhandledRejection', (error) => {
  logger.error(`unhandledRejection: ${error.message}`);
});

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
      where: {
        campaign_crypt: campaigncrypt
      },
      include: [{
        model: ModelAdvertisers
      }],
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
      formatted_start_date: format(parseISO(campaign.campaign_start_date), 'dd/MM/yyyy', {
        locale: frLocale
      }),
      formatted_end_date: format(parseISO(campaign.campaign_end_date), 'dd/MM/yyyy', {
        locale: frLocale
      }),
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
    logger.error(`Erreur lors de la génération du rapport Generate : ${error.message}`);
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
      where: {
        campaign_crypt: campaigncrypt
      },
      include: [{
        model: ModelAdvertisers,
        model: ModelInsertions
      }]
    });

    if (!campaign) {
      logger.error(`Erreur lors de la récupération de la campagne avec le crypt: ${campaigncrypt}`);
      return Utilities.handleCampaignNotFound(res, 404, campaigncrypt);
    }

    const campaignId = campaign.campaign_id;

    // Gestion des dates avec date-fns
    const dateNow = new Date();

    // Utilisez parseISO pour convertir les dates ISO en objets Date
    const campaignStartDate = parseISO(campaign.campaign_start_date);
    const campaignEndDate = parseISO(campaign.campaign_end_date);

    const campaignDates = {
      start: campaignStartDate,
      end: campaignEndDate,
      request_start_date: format(campaignStartDate, "yyyy-MM-dd'T'HH:mm:ss"),
      request_start_end: format(campaignEndDate, "yyyy-MM-dd'T'HH:mm:ss"),
      duration: differenceInDays(parseISO(campaign.campaign_end_date), parseISO(campaign.campaign_start_date)),
      formatted_start_date: format(parseISO(campaign.campaign_start_date), 'dd/MM/yyyy', {
        locale: frLocale
      }),
      formatted_end_date: format(parseISO(campaign.campaign_end_date), 'dd/MM/yyyy', {
        locale: frLocale
      }),
      remainingDays: differenceInDays(parseISO(campaign.campaign_end_date), dateNow),
      daysBeforeStart: differenceInDays(parseISO(campaign.campaign_start_date), dateNow),
    };

    // Récupére le cache de campaignID
    let cachedCampaignId = getCampaignId(campaignId);
  
    if (!cachedCampaignId) {
      // D'abord, vérifiez dans le cache si les instanceId existent déjà
      // Vérifier d'abord si les instanceId existent déjà dans le cache
      let cachedReportIds = getReportIds(campaignId);
     
      // Récupération des ReportIds
      if (!cachedReportIds) {
        // Récupérer les reports pour le reporting de la campagne et la partie VU
        const reportId = await ReportService.fetchReportId(campaignDates.request_start_date, campaignDates.request_start_end, campaignId);
        logger.info(`ReportID : ${reportId}`);

        // Vérification que reportId est attribué
        if (!reportId) {
          logger.error(`Erreur: reportId non attribué pour la campagne ID: ${campaignId}`);
          return Utilities.handleCampaignNotFound(res, 500, "Impossible de générer un reportId pour la campagne", "json");
        }

        // Initialiser reportIdVU (Vide si non applicable)
        let reportIdVU = "";

        // Si la campagne dure 31 jours ou moins, récupérer également le reportId VU
        if (campaignDates.duration <= 31) {
          reportIdVU = await ReportService.fetchReportId(campaignDates.request_start_date, campaignDates.request_start_end, campaignId, true);
          logger.info(`ReportIDVU : ${reportIdVU}`);

          if (!reportIdVU) {
            logger.error(`Erreur: reportIdVU non attribué pour la campagne ID: ${campaignId}`);
            return Utilities.handleCampaignNotFound(res, 500, "Impossible de générer un reportIdVU pour la campagne", "json");
          }
        }

        // Sauvegarder dans le cache avec expiration de 2 heures
        setReportIdsWithExpiry(campaignId, reportId, reportIdVU);
        logger.info(`ReportId et ReportIdVU sauvegardés dans le cache pour la campagne ${campaignId}`);

        // Mettre à jour le cache local
        cachedReportIds = {
          reportId,
          reportIdVU
        };
        logger.info(`Sauvegarde reportId (${reportId}) et reportIdVU (${reportIdVU}) sauvegardés dans le cache pour la campagne ${campaignId}`);
      }

      // Récupére les instances pour cette campagne
      let cachedInstanceIds = getInstanceIds(campaignId);
      if (!cachedReportIds || !cachedInstanceIds) {
          logger.info(`Récupére reportId (${cachedReportIds.reportId}) et reportIdVU (${cachedReportIds.reportIdVU}) via le cache pour la campagne ${campaignId}`);

          // Récupérer les détails du rapport à partir des instanceId et instanceIdVU
          const instanceIdData = await ReportService.fetchReportDetails(cachedReportIds.reportId);
          const instanceIdVUData = cachedReportIds.reportIdVU ?
            await ReportService.fetchReportDetails(cachedReportIds.reportIdVU) :
            null;

          // Si vous avez besoin des données CSV à partir des instanceId et instanceIdVU
          const reportCsvData = await ReportService.fetchCsvData(instanceIdData);
          let reportCsvDataVU = null;

          if (instanceIdVUData) {
            reportCsvDataVU = await ReportService.fetchCsvData(instanceIdVUData);
          }

          // Sauvegarde les données CSV
          setInstanceIdsWithExpiry(campaignId, reportCsvData, reportCsvDataVU);
          cachedInstanceIds = { campaignId, reportCsvData, reportCsvDataVU };
      }

      // Affiche le rapport json

       const ReportBuildJsonTemplate = ReportBuildJson(campaignId, cachedInstanceIds.reportCsvData, cachedInstanceIds.reportCsvDataVU)
        .then(result => {
          logger.info(JSON.stringify(result, null, 2));
        })
        .catch(error => {
          logger.error('Erreur ReportBuildJsonTemplate :', error.message);
          console.log(error);
        });
/*
          setCampaignIdWithExpiry(campaignId, {
              ReportBuildJsonTemplate
            });
      
      return res.json({
        cachedReportIds,
        reportCsvData,
        reportCsvDataVU,
        ReportBuildJsonTemplate
      });
*/
    }

    /*
      // let cachedCampaignId2 = getCampaignId("2480960");
      const storedData = JSON.parse(localStorage.getItem(`ReportIdDATA-2570084`));
      csvData1Path = storedData.reportCsvData;
      csvData2Path = storedData.reportCsvDataVU;
      console.log("csvData2Path :"+csvData2Path);

      const ReportBuildJsonTemplate = ReportBuildJson(campaignId, csvData1Path, csvData2Path)
      .then(result => {
      console.log(JSON.stringify(result, null, 2));
      })
      .catch(error => {
      console.error('Erreur :', error.message);
      });

      localStorage.setItem(`campaignID-2570084`, JSON.stringify(ReportBuildJsonTemplate));

      return ReportBuildJsonTemplate;
    */
    // const report = getCampaignId(campaignId);-${campaignId}
    // const reportJson = await ReportService.formatReportData(reportCsvData, reportCsvDataVU);
    // Retourner les résultats dans la réponse, y compris les données CSV
    // console.log(report)
    // return res.json({cachedInstanceIds, instanceIdData, instanceIdVUData});

  } catch (error) {
    logger.error(`Erreur lors de la génération du rapport Report : ${error.message}`);
    return Utilities.handleCampaignNotFound(res, 500, "Erreur lors de la génération du rapport", "json");
  }
}