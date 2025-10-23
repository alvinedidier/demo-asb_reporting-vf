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

    // Récupére l'ID de la campagne
    let campaignId = campaign.campaign_id;
    let campaignName = campaign.campaign_name;
    // const templateSuffix = campaignName.startsWith("DV") ? 'adweb' : 'arsb';
    const templateSuffix = /^(DV|AUDIOADS)/i.test(campaignName ?? '') ? 'adweb' : 'arsb';

    // Suppression du cache
    let mode = req.query.mode;
    if (mode && (mode === 'delete')) {
      // si le local storage expire; on supprime les precedents cache et les taskid   

      // Appeler la fonction deleteAllCampaignData pour supprimer toutes les données associées à la campagne
      const deleteResult = deleteAllCampaignData(campaignId);

      if (deleteResult) {
        logger.info(`Suppression réussie du cache de la campagne : ${campaignId}`);
      } else {
        logger.error(`Échec de la suppression du cache de la campagne : ${campaignId}`);
      }

      // Redirection vers le bilan
      return res.redirect(`/r/${campaigncrypt}`);
    }


    // Gestion des dates avec date-fns
    const dateNow = new Date();
    const campaignStartDate = parseISO(campaign.campaign_start_date);
    const campaignEndDate = parseISO(campaign.campaign_end_date);
    const campaignDuration = differenceInDays(campaignEndDate, campaignStartDate);
    const formattedStartDate = format(campaignStartDate, 'dd/MM/yyyy', {
      locale: frLocale
    });
    const formattedEndDate = format(campaignEndDate, 'dd/MM/yyyy', {
      locale: frLocale
    });
    const remainingDays = differenceInDays(campaignEndDate, dateNow);
    const daysBeforeStart = differenceInDays(campaignStartDate, dateNow);

    const campaignDates = {
      now: dateNow,
      start: campaignStartDate,
      end: campaignEndDate,
      duration: campaignDuration,
      formatted_start_date: formattedStartDate,
      formatted_end_date: formattedEndDate,
      remainingDays: remainingDays,
      daysBeforeStart: daysBeforeStart
    };






    // Conditions basées sur la durée de diffusion  && (campaignDates.daysBeforeStart >= -40)  && (campaignDates.daysBeforeStart < 0)
    if ((campaignDates.duration <= 31)) {
      logger.info(`La campagne ${campaignId} est courte, récupération des Visiteurs Uniques (VU).`);
      // Logique pour lancer l'instance de récupération des VU
    } else {
      logger.info(`La campagne ${campaignId} dépasse 31 jours et il y a plus de 40 jours du début, pas de récupération des VU.`);
    }

    if (campaignDates.remainingDays > 365) {
      logger.info(`Plus de 365 jours après la diffusion, prise de contact avec la régie recommandée.`);
    }
    if (campaignDates.remainingDays > 0) {
      logger.info(`La campagne ${campaignId} est encore active, affichage du bilan si disponible.`);
    } else {
      logger.info(`La campagne ${campaignId} est terminée, lancement des requêtes pour le rapport final.`);
    }

    if (campaignDates.remainingDays < -40) {
      logger.warn(`⚠️ La date de début ${campaignDates.start} dépasse les 40 jours autorisés par l'API Smart. La requête risque d'échouer.`);
    }

    if (campaignDates.daysBeforeStart > 0) {
      logger.info(`La campagne ${campaignId} n'a pas encore commencé, lancement des requêtes.`);
    } else {
      logger.info(`La campagne ${campaignId} est en attente, message d'attente affiché.`);
    }

    // Affichage de la barre de progression
    // La barre de progression est affichée si la campagne n'est pas encore commencée,  
    // si elle est terminée depuis moins de 400 jours, ou si elle a commencé il y a moins de 9999 jours
    const showProgressBar = !(
      campaignDates.daysBeforeStart > 0 || // campagne pas encore commencée
      campaignDates.remainingDays < -40 || // +400 jours depuis la fin
      campaignDates.daysBeforeStart < -9999 // sécurité logique large
    );

    // Récupére le cache de campaignID    
    let reportingData = getCampaignId(campaignId);

    if (reportingData) {
      logger.info(`Affichage des données en cache pour la campagne ${campaignId}`);

      const advertiser_name = reportingData.advertiser_name;
      logger.info(`Nom de l'annonceur : ${advertiser_name}`);
     
      // Vérifier si advertiser_name commence par "ADWEB"
      if (campaignName.startsWith("DV")) {
        // Afficher le template pour "ADWEB"
        return res.render('report.arsb/reporting.adweb.ejs', {
          campaignDates: campaignDates,
          campaign: campaign,
          reporting: reportingData,
          showProgressBar // nouveau
        });
      }

      return res.render('report.arsb/reporting.ejs', {
        campaignDates: campaignDates,
        campaign: campaign,
        reporting: reportingData,
        showProgressBar // nouveau
      });

    } else {
    
         // ⚙️ STUB "reporting" pour éviter les erreurs EJS quand il n'y a pas encore de données
      const reportingStub = {
        advertiser_name: campaign?.ModelAdvertiser?.advertiser_name || '', // adapte selon ton include
        campaign_name: campaign.campaign_name,
        campaign_crypt: campaign.campaign_crypt,
        campaign_start_date_formatted: formattedStartDate,
        campaign_end_date_formatted: formattedEndDate,
        campaign_end_date: campaignEndDate,
        reporting_dates: {
          // valeurs par défaut lisibles par le template
          reporting_start_date: dateNow,
          reporting_end_date: dateNow
        },
        globalMetrics: {
          totalImpressions: 0,
          totalClics: 0,
          ctrGlobal: 0,
          completionRateGlobal: 0,
          uniqueVisitors: 0,
          repetition: 0
        },
        metrics: {
          byFormat: {},
          byFormatAndSite: {},
          byCreatives: {},
          bySite: {}
        }
      }
      // ✅ Rendre le template "generate" avec le stub
      res.render(`report.arsb/generate.${templateSuffix}.ejs`, {
        campaign,
        campaignDates,
        reporting: reportingStub,
        showProgressBar
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
    // 1. Validation de l'entrée
    if (!campaigncrypt || typeof campaigncrypt !== 'string') {
      logger.warn('Paramètre campaigncrypt invalide');
      return Utilities.handleCampaignNotFound(res, 400, campaigncrypt);
    }

    // 2. Récupération de la campagne
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
      include: [ModelAdvertisers, ModelInsertions],
    });

    if (!campaign) {
      logger.error(`Campagne non trouvée: ${campaigncrypt}`);
      return Utilities.handleCampaignNotFound(res, 404, campaigncrypt);
    }

    const campaignId = campaign.campaign_id;
   
    // 3. Gestion des dates
    const dateNow = new Date();
    const campaignStartDate = parseISO(campaign.campaign_start_date);
    const campaignEndDate = parseISO(campaign.campaign_end_date);

    const campaignDates = {
      now: dateNow,
      start: campaignStartDate,
      end: campaignEndDate,
      request_start_date: format(campaignStartDate, "yyyy-MM-dd'T'HH:mm:ss"),
      request_end_date: format(campaignEndDate, "yyyy-MM-dd'T'HH:mm:ss"),
      duration: differenceInDays(campaignEndDate, campaignStartDate),
      formatted_start_date: format(campaignStartDate, 'dd/MM/yyyy', { locale: frLocale }),
      formatted_end_date: format(campaignEndDate, 'dd/MM/yyyy', { locale: frLocale }),
      remainingDays: differenceInDays(campaignEndDate, dateNow),
      daysBeforeStart: differenceInDays(campaignStartDate, dateNow),
    };

    // 4. Vérification de la validité de la campagne pour l'API
    if (campaignDates.remainingDays < -40) {
      logger.warn(`⚠️ La campagne ${campaignId} dépasse les 40 jours autorisés par l'API Smart.`);
      return res.status(400).json({
        error: "La campagne est trop ancienne pour générer un rapport.",
        details: "Plus de 40 jours depuis la fin de la campagne.",
      });
    }

    // 5. Récupération des données en cache
    let cachedCampaignId = getCampaignId(campaignId);
    if (cachedCampaignId) {
      logger.info(`Rapport en cache trouvé pour la campagne ${campaignId}`);
      return res.json(cachedCampaignId);
    }

    // 6. Récupération des reportIds (si non en cache)
    let cachedReportIds = getReportIds(campaignId);
    if (!cachedReportIds) {
      logger.info(`Récupération des reportIds pour la campagne ${campaignId}`);

      // Récupération du reportId principal
      const reportId = await ReportService.fetchReportId(
        campaignDates.request_start_date,
        campaignDates.request_end_date,
        campaignId
      );

      if (!reportId) {
        logger.error(`Échec de la récupération du reportId pour la campagne ${campaignId}`);
        return Utilities.handleCampaignNotFound(res, 500, "Impossible de générer un reportId");
      }

      // Récupération du reportIdVU si la campagne est courte (<= 31 jours)
      let reportIdVU = null;
      if (campaignDates.duration <= 31) {
        reportIdVU = await ReportService.fetchReportId(
          campaignDates.request_start_date,
          campaignDates.request_end_date,
          campaignId,
          true // Paramètre pour VU
        );
        if (!reportIdVU) {
          logger.warn(`Échec de la récupération du reportIdVU pour la campagne ${campaignId}`);
        }
      }

      // Sauvegarde dans le cache
      setReportIdsWithExpiry(campaignId, reportId, reportIdVU);
      cachedReportIds = { reportId, reportIdVU };
    }

    // 7. Récupération des instanceIds (si non en cache)
    let cachedInstanceIds = getInstanceIds(campaignId);
    console.log(' cachedInstanceIds:', cachedInstanceIds);

    if (!cachedInstanceIds) {
      logger.info(`Récupération des instanceIds pour la campagne ${campaignId}`);

      // Récupération des détails du rapport
      const instanceIdData = await ReportService.fetchReportDetails(cachedReportIds.reportId);
      if (!instanceIdData) {
        logger.error(`Échec de la récupération des détails du rapport pour la campagne ${campaignId}`);
        return Utilities.handleCampaignNotFound(res, 500, "Impossible de récupérer les détails du rapport");
      }

      // Récupération des données CSV pour instanceId
      const instanceId = await ReportService.fetchCsvData(instanceIdData);
      if (!instanceId) {
        logger.error(`Échec de la récupération de l'instanceId pour la campagne ${campaignId}`);
        return Utilities.handleCampaignNotFound(res, 500, "Impossible de récupérer l'instanceId");
      }

      // Récupération des données CSV pour instanceIdVU (si applicable)
      let instanceIdVU = null;
      if (cachedReportIds.reportIdVU) {
        const instanceIdVUData = await ReportService.fetchReportDetails(cachedReportIds.reportIdVU);
        if (instanceIdVUData) {
          instanceIdVU = await ReportService.fetchCsvData(instanceIdVUData);
          if (!instanceIdVU) {
            logger.warn(`Avertissement : instanceIdVU est null pour la campagne ${campaignId}`);
          }
        }
      }

      // Sauvegarde dans le cache
      setInstanceIdsWithExpiry(campaignId, instanceId, instanceIdVU);
      cachedInstanceIds = { instanceId, instanceIdVU };
    }

    // 8. Génération du rapport JSON
    try {
      logger.info(`Génération du rapport JSON pour la campagne ${campaignId}`);
      const reportData = await ReportBuildJson(campaignId, cachedInstanceIds.instanceId, cachedInstanceIds.instanceIdVU);

      // 9. Sauvegarde dans le cache et retour du résultat
      setCampaignIdWithExpiry(campaignId, reportData);
      return res.json(reportData);
    } catch (error) {
      logger.error(`Erreur lors de la génération du rapport JSON pour la campagne ${campaignId}: ${error.message}`);
      return Utilities.handleCampaignNotFound(res, 500, "Erreur lors de la génération du rapport JSON");
    }

  } catch (error) {
    logger.error(`Erreur dans exports.report pour la campagne ${campaigncrypt}: ${error.message}`);
    return Utilities.handleCampaignNotFound(res, 500, "Erreur lors de la génération du rapport");
  }
};

/*
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
      now: dateNow,
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

    if (campaignDates.remainingDays < -40) {
      logger.warn(`⚠️ La date de début ${campaignDates.start} dépasse les 40 jours autorisés par l'API Smart. La requête risque d'échouer.`);
    } else {
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

          // Si la campagne dure 31 jours ou moins, récupérer également le reportId VU  && (campaignDates.daysBeforeStart >= -40) && (campaignDates.daysBeforeStart < 0)
          if ((campaignDates.duration <= 31)) {
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

        if (!cachedInstanceIds) {
          logger.info(`Récupére reportId (${cachedReportIds.reportId}) et reportIdVU (${cachedReportIds.reportIdVU}) via le cache pour la campagne ${campaignId}`);

          // Récupérer les détails du rapport à partir des instanceId et instanceIdVU
          const instanceIdData = await ReportService.fetchReportDetails(cachedReportIds.reportId);
          const instanceIdVUData = cachedReportIds.reportIdVU ?
            await ReportService.fetchReportDetails(cachedReportIds.reportIdVU) :
            null;

          // Si vous avez besoin des données CSV à partir des instanceId et instanceIdVU
          const instanceId = await ReportService.fetchCsvData(instanceIdData);
          let instanceIdVU = null;

          if (instanceIdVUData) {
            instanceIdVU = await ReportService.fetchCsvData(instanceIdVUData);
          }

          // Sauvegarde les données CSV
          setInstanceIdsWithExpiry(campaignId, instanceId, instanceIdVU);
          cachedInstanceIds = {
            campaignId,
            instanceId,
            instanceIdVU
          };
        }

        // Affiche le rapport json    
        const ReportBuildJsonTemplate = ReportBuildJson(campaignId, cachedInstanceIds.instanceId, cachedInstanceIds.instanceIdVU)
          .then(result => {
            logger.info(`Affiche le résultat du rapport json de la campagne ${campaignId}`);
            return res.json(result);
          })
          .catch(error => {
            logger.error(`Affiche erreur résultat du rapport json :`, error);
          });

      } else {
        logger.info(`Affiche le résultat du cache json de la campagne ${campaignId}`);
        return res.json(cachedCampaignId);
      }
    }


  } catch (error) {
    logger.error(`Erreur lors de la génération du rapport Report : ${error.message}`);
    return Utilities.handleCampaignNotFound(res, 500, "Erreur lors de la génération du rapport", "json");
  }
}
*/

exports.download = async (req, res) => {
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
    // return res.json(campaignId);

    // Récupére le cache de campaignID    
    let reportingData = getCampaignId(campaignId);

    if (reportingData) {

      // Gestion des dates avec date-fns
      let dateDownload = format(reportingData.reporting_dates.reporting_start_date, 'yyyyMMddHHmm', {
        locale: frLocale
      });
      let campaignNameExcel = reportingData.campaign_name.replace(' ', '-');

      // Définir les styles pour les feuilles
      let styles = {
        header: {
          font: {
            color: {
              rgb: 'FFFFFF'
            },
            sz: 13,
            bold: false,
            underline: false
          },
          fill: {
            fgColor: {
              rgb: '1d2b66'
            }
          },
        },
        cell: {
          font: {
            color: {
              rgb: '000000'
            },
            sz: 12
          }
        }
      };

      // Structure de la campagne générale
      const campaignSpec = {
        field: 'Campagne',
        advertiser_name: {
          displayName: 'Annonceur',
          headerStyle: styles.header,
          width: 300
        },
        campaign_name: {
          displayName: 'Nom de la campagne',
          headerStyle: styles.header,
          width: 300
        },
        campaign_start_date_formatted: {
          displayName: 'Date de début',
          headerStyle: styles.header,
          width: 150
        },
        campaign_end_date_formatted: {
          displayName: 'Date de fin',
          headerStyle: styles.header,
          width: 150
        },
      };

      const campaignSpecData = [{
        advertiser_name: reportingData.advertiser_name,
        campaign_name: reportingData.campaign_name,
        campaign_start_date_formatted: reportingData.campaign_start_date_formatted,
        campaign_end_date_formatted: reportingData.campaign_end_date_formatted,
      }];

      // Structure de "globalMetricsSpec" sans "completionRateGlobal" par défaut
      const globalMetricsSpec = {
        totalImpressions: {
          displayName: 'Impressions',
          headerStyle: styles.header,
          width: 150
        },
        totalClics: {
          displayName: 'Clics',
          headerStyle: styles.header,
          width: 150
        },
        ctrGlobal: {
          displayName: 'CTR Global',
          headerStyle: styles.header,
          width: 150
        },
        uniqueVisitors: {
          displayName: 'Visiteurs uniques',
          headerStyle: styles.header,
          width: 150
        },
        repetition: {
          displayName: 'Répétition',
          headerStyle: styles.header,
          width: 150
        }
      };

      // Ajouter "completionRateGlobal" à "globalMetricsSpec" si "INSTREAM" est présent dans "reportingData.metrics.byFormat"
      if (reportingData.metrics.byFormat && reportingData.metrics.byFormat['INSTREAM']) {
        globalMetricsSpec.completionRateGlobal = {
          displayName: 'Taux de complétion',
          headerStyle: styles.header,
          width: 150
        };
      }

      // Création de "globalMetricsData"
      const globalMetricsData = [{
        totalImpressions: reportingData.globalMetrics.totalImpressions,
        totalClics: reportingData.globalMetrics.totalClics,
        ctrGlobal: reportingData.globalMetrics.ctrGlobal.replace('.', ',') + '%',
        uniqueVisitors: reportingData.globalMetrics.uniqueVisitors,
        repetition: reportingData.globalMetrics.repetition.replace('.', ',')
      }];

      // Ajouter "completionRateGlobal" à "globalMetricsData" si "INSTREAM" est présent dans "reportingData.metrics.byFormat"
      if (reportingData.metrics.byFormat && reportingData.metrics.byFormat['INSTREAM']) {
        globalMetricsData[0].completionRateGlobal = reportingData.globalMetrics.completionRateGlobal.replace('.', ',') + '%';
      }

      // Structure de "bySiteSpec" sans "vtr" par défaut
      const bySiteSpec = {
        site: {
          displayName: 'Nom du site',
          headerStyle: styles.header,
          width: 150
        },
        impressions: {
          displayName: 'Impressions',
          headerStyle: styles.header,
          width: 150
        },
        clics: {
          displayName: 'Clics',
          headerStyle: styles.header,
          width: 150
        },
        ctr: {
          displayName: 'Taux de clics',
          headerStyle: styles.header,
          width: 150
        }
      };

      // Ajouter "vtr" à "bySiteSpec" si la métrique "INSTREAM" est présente dans "reportingData.metrics.byFormat"
      if (reportingData.metrics.byFormat && reportingData.metrics.byFormat['INSTREAM']) {
        bySiteSpec.vtr = {
          displayName: 'Taux de complétion',
          headerStyle: styles.header,
          width: 150
        };
      }

      // Création de "bySiteData"
      const bySiteData = Object.entries(reportingData.metrics.bySite).map(([siteName, values]) => {
        // Structure de base sans "vtr"
        const siteData = {
          site: siteName,
          impressions: values.impressions,
          clics: values.clics,
          ctr: values.ctr.replace('.', ',') + '%'
        };

        // Ajouter "vtr" seulement si la métrique "INSTREAM" est présente dans "reportingData.metrics.byFormat"
        if (reportingData.metrics.byFormat && reportingData.metrics.byFormat['INSTREAM'] && values.vtr) {
          siteData.vtr = values.vtr.replace('.', ',') + '%';
        }

        return siteData;
      });

      // Structure de "byFormatSpec" sans "vtr" par défaut
      const byFormatSpec = {
        format: {
          displayName: 'Format',
          headerStyle: styles.header,
          width: 150
        },
        impressions: {
          displayName: 'Impressions',
          headerStyle: styles.header,
          width: 150
        },
        clics: {
          displayName: 'Clics',
          headerStyle: styles.header,
          width: 150
        },
        ctr: {
          displayName: 'Taux de clics',
          headerStyle: styles.header,
          width: 150
        }
      };

      // Ajouter "vtr" à "byFormatSpec" si la métrique "INSTREAM" est présente dans les données
      if (reportingData.metrics.byFormat && reportingData.metrics.byFormat['INSTREAM']) {
        byFormatSpec.vtr = {
          displayName: 'Taux de complétion',
          headerStyle: styles.header,
          width: 150
        };
      }

      // Création de "byFormatData"
      const byFormatData = Object.entries(reportingData.metrics.byFormat).map(([formatName, values]) => {
        // Structure de base sans "vtr"
        const formatData = {
          format: formatName,
          impressions: values.impressions,
          clics: values.clics,
          ctr: values.ctr.replace('.', ',') + '%'
        };

        // Ajouter "vtr" seulement si la métrique "INSTREAM" est présente dans "reportingData.metrics.byFormat"
        if (reportingData.metrics.byFormat['INSTREAM'] && values.vtr) {
          formatData.vtr = values.vtr.replace('.', ',') + '%';
        }

        return formatData;
      });

      // Structure de "byFormatAndSiteSpec" sans "vtr" par défaut
      const byFormatAndSiteSpec = {
        format: {
          displayName: 'Format',
          headerStyle: styles.header,
          width: 150
        },
        site: {
          displayName: 'Nom du site',
          headerStyle: styles.header,
          width: 150
        },
        impressions: {
          displayName: 'Impressions',
          headerStyle: styles.header,
          width: 150
        },
        clics: {
          displayName: 'Clics',
          headerStyle: styles.header,
          width: 150
        },
        ctr: {
          displayName: 'Taux de clics',
          headerStyle: styles.header,
          width: 150
        }
      };

      // Ajouter "vtr" à "byFormatAndSiteSpec" si la métrique "INSTREAM" est présente dans les données
      if (reportingData.metrics.byFormat && reportingData.metrics.byFormat['INSTREAM']) {
        byFormatAndSiteSpec.vtr = {
          displayName: 'Taux de complétion',
          headerStyle: styles.header,
          width: 150
        };
      }

      // Création de "byFormatAndSiteData"
      const byFormatAndSiteData = Object.entries(reportingData.metrics.byFormatAndSite).flatMap(([formatName, sites]) =>
        Object.entries(sites).map(([siteName, values]) => {
          // Structure de base sans "vtr"
          const formatAndSiteData = {
            format: formatName,
            site: siteName,
            impressions: values.impressions,
            clics: values.clics,
            ctr: values.ctr.replace('.', ',') + '%'
          };

          // Ajouter "vtr" seulement si la métrique "INSTREAM" est présente dans "reportingData.metrics.byFormat"
          if (reportingData.metrics.byFormat['INSTREAM'] && values.vtr) {
            formatAndSiteData.vtr = values.vtr.replace('.', ',') + '%';
          }

          return formatAndSiteData;
        })
      );

      // Structure de "byCreatives" (Creatives de campagne)
      const byCreativesSpec = {
        creative: {
          displayName: 'Créative',
          headerStyle: styles.header,
          width: 150
        },
        impressions: {
          displayName: 'Impressions',
          headerStyle: styles.header,
          width: 150
        },
        clics: {
          displayName: 'Clics',
          headerStyle: styles.header,
          width: 150
        },
        ctr: {
          displayName: 'Taux de clics',
          headerStyle: styles.header,
          width: 150
        }
      };

      const byCreativesData = Object.entries(reportingData.metrics.byCreatives).map(([creativeName, values]) => ({
        creative: creativeName, // Nom de la créative
        impressions: values.impressions, // Formate les impressions en ajoutant un séparateur de milliers
        clics: values.clics, // Formate les clics avec un séparateur de milliers
        ctr: values.ctr.replace('.', ',') + '%', // Remplace le point décimal par une virgule
      }));

      // Construire l'export avec des feuilles pour chaque section
      const report = excel.buildExport([{
          name: 'Campagne',
          specification: campaignSpec,
          data: campaignSpecData
        },
        {
          name: 'Données Globales',
          specification: globalMetricsSpec,
          data: globalMetricsData
        },
        {
          name: 'Formats',
          specification: byFormatSpec,
          data: byFormatData
        },
        {
          name: 'Créatives',
          specification: byCreativesSpec,
          data: byCreativesData
        },
        {
          name: 'Par formats et sites',
          specification: byFormatAndSiteSpec,
          data: byFormatAndSiteData
        }

      ]);

      // rapport_antennesb-202105031152-ESPACE_DECO-67590.xls
      res.attachment(`${dateDownload}-rapport_asb-${campaignNameExcel}.xlsx`);
      return res.send(report);
    } else {
      logger.error(`Campagne non trouvé : ${campaignId}`);
      return Utilities.handleCampaignNotFound(res, 500, "Erreur lors de la récupération du rapport");
    }

  } catch (error) {
    logger.error(`Erreur lors de la génération du rapport Report : ${error.message}`);
    return Utilities.handleCampaignNotFound(res, 500, "Erreur lors de la génération du rapport", "json");
  }
}