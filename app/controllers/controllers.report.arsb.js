// Initialise le module
const excel = require('node-excel-export');

const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

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
    const campaignDates = {
      now: dateNow,
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

    console.log(campaignDates);

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
      logger.info(`Génération du rapport pour la campagne: ${campaign.campaign_id}`);

      if (campaignName.startsWith("DV")) {
        // Afficher le template pour "ADWEB"
        return res.render('report.arsb/generate.adweb.ejs', {
          campaign,
          campaignDates,
          showProgressBar // nouveau
        });
      }

      return res.render('report.arsb/generate.ejs', {
        campaign,
        campaignDates,
        showProgressBar // nouveau
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


exports.download = async (req, res) => {
  const campaigncrypt = req.params.campaigncrypt;

  try {
    if (!campaigncrypt || typeof campaigncrypt !== 'string') {
      logger.warn('Paramètre campaigncrypt invalide');
      return Utilities.handleCampaignNotFound(res, 400, campaigncrypt);
    }

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
      include: [{ model: ModelAdvertisers }, { model: ModelInsertions }],
    });

    if (!campaign) {
      logger.error(`Erreur lors de la récupération de la campagne avec le crypt: ${campaigncrypt}`);
      return Utilities.handleCampaignNotFound(res, 404, campaigncrypt);
    }

    const campaignId = campaign.campaign_id;
    let reportingData = getCampaignId(campaignId);

    if (!reportingData) {
      logger.error(`Campagne non trouvée en cache : ${campaignId}`);
      return Utilities.handleCampaignNotFound(res, 500, "Erreur lors de la récupération du rapport");
    }

    // -------------------------------
    // Détection de la régie + couleur
    // -------------------------------
    const advertiserName = reportingData.advertiser_name?.toUpperCase() || "";
    let themeColor = "#1d2b66"; // bleu ARSB
    let regie = "ARSB";
    let logoPath = path.join(__dirname, '../public/assets/images/logo.png');

    if (advertiserName.startsWith("ADWEB")) {
      themeColor = "#116dff"; // bleu ciel ADWEB
      regie = "ADWEB";
      logoPath = path.join(__dirname, '../public/assets/images/adweb-logo.png');
    }

    logger.info(`🎨 Rapport ExcelJS pour ${regie} (${themeColor})`);

    // ------------------------------------------------
    // INITIALISATION EXCELJS
    // ------------------------------------------------
    const workbook = new ExcelJS.Workbook();
    const sheetCampagne = workbook.addWorksheet('Campagne');
    const now = new Date();

    // ----------------------------------------------------
    // BANDEAU ENTÊTE
    // ----------------------------------------------------
    sheetCampagne.mergeCells('A1:F1');
    sheetCampagne.mergeCells('A3:F3');

    sheetCampagne.getCell('A1').value = '';
    sheetCampagne.getCell('A3').value = '';

    const bannerTitle = sheetCampagne.getCell('A1');
    const bannerSubtitle = sheetCampagne.getCell('A3');

    const bannerFill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: themeColor.replace('#', '') },
    };

    bannerTitle.value = `RAPPORT DE CAMPAGNE ${regie}`;
    bannerTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    bannerTitle.font = {
      color: { argb: 'FFFFFF' },
      bold: true,
      size: 22,
      name: 'Century Gothic',
    };
    bannerTitle.fill = bannerFill;

    const dateString = now.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeString = now.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    bannerSubtitle.value = `Généré automatiquement le ${dateString} à ${timeString}`;
    bannerSubtitle.alignment = { horizontal: 'center', vertical: 'middle' };
    bannerSubtitle.font = {
      color: { argb: 'ffffff' },
      italic: true,
      size: 12,
      name: 'Century Gothic',
    };
    bannerSubtitle.fill = bannerFill;

    if (fs.existsSync(logoPath)) {
      const logoId = workbook.addImage({
        filename: logoPath,
        extension: 'png',
      });
      sheetCampagne.addImage(logoId, {
        tl: { col: 5.5, row: 0.5 },
        ext: { width: 120, height: 60 },
      });
    }

    sheetCampagne.getRow(1).height = 25;
    sheetCampagne.getRow(2).height = 25;
    sheetCampagne.getRow(3).height = 20;
    const startRow = 5;
    sheetCampagne.getRow(startRow).values = [];

    // ------------------------------------------------
    // INFOS CAMPAGNE (ordre corrigé)
    // ------------------------------------------------
    sheetCampagne.columns = [{ width: 30 }, { width: 60 }];

    sheetCampagne.addRow(['Annonceur', reportingData.advertiser_name]);
    sheetCampagne.addRow(['Nom de la campagne', reportingData.campaign_name]);
    sheetCampagne.addRow(['Date de début', reportingData.campaign_start_date_formatted]);
    sheetCampagne.addRow(['Date de fin', reportingData.campaign_end_date_formatted]);

    sheetCampagne.eachRow((row, idx) => {
      row.eachCell((cell) => {
        cell.font = idx <= 3 ? { bold: true } : { size: 12 };
      });
    });

    // ------------------------------------------------
    // FEUILLE Données Globales
    // ------------------------------------------------
    const sheetGlobal = workbook.addWorksheet('Données Globales');
    sheetGlobal.columns = regie === 'ARSB'
      ? [
          { header: 'Impressions', key: 'totalImpressions', width: 15 },
          { header: 'Clics', key: 'totalClics', width: 15 },
          { header: 'CTR Global (%)', key: 'ctrGlobal', width: 20 },
          { header: 'Visiteurs uniques', key: 'uniqueVisitors', width: 20 },
          { header: 'Répétition', key: 'repetition', width: 15 },
          { header: 'Taux de complétion (%)', key: 'completionRateGlobal', width: 25 },
        ]
      : [
          { header: 'Impressions', key: 'totalImpressions', width: 15 },
          { header: 'Clics', key: 'totalClics', width: 15 },
          { header: 'CTR Global (%)', key: 'ctrGlobal', width: 20 },
          { header: 'Taux de complétion (%)', key: 'completionRateGlobal', width: 25 },
        ];

    const globalRow = regie === 'ARSB'
      ? reportingData.globalMetrics
      : {
          totalImpressions: reportingData.globalMetrics.totalImpressions,
          totalClics: reportingData.globalMetrics.totalClics,
          ctrGlobal: reportingData.globalMetrics.ctrGlobal,
          completionRateGlobal: reportingData.globalMetrics.completionRateGlobal,
        };

    sheetGlobal.addRow(globalRow);

    // ------------------------------------------------
    // FEUILLE Formats
    // ------------------------------------------------
    const sheetFormat = workbook.addWorksheet('Formats');
    const hasVideoFormat = Object.keys(reportingData.metrics.byFormat || {}).some(fmt =>
      fmt.toUpperCase().includes('VIDEO') || fmt.toUpperCase().includes('INSTREAM')
    );
    const baseFormatColumns = [
      { header: 'Format', key: 'format', width: 30 },
      { header: 'Impressions', key: 'impressions', width: 15 },
      { header: 'Clics', key: 'clics', width: 15 },
      { header: 'CTR (%)', key: 'ctr', width: 15 },
    ];
    if (hasVideoFormat) baseFormatColumns.push({ header: 'VTR (%)', key: 'vtr', width: 15 });
    sheetFormat.columns = baseFormatColumns;

    Object.entries(reportingData.metrics.byFormat || {}).forEach(([format, val]) => {
      const row = { format, impressions: val.impressions, clics: val.clics, ctr: val.ctr };
      if (hasVideoFormat && val.vtr) row.vtr = val.vtr;
      sheetFormat.addRow(row);
    });

    // ------------------------------------------------
    // FEUILLE Appareils (ADWEB uniquement)
    // ------------------------------------------------
    if (regie === 'ADWEB' && reportingData.metrics.byDevices) {
      const sheetDevices = workbook.addWorksheet('Appareils');
      sheetDevices.columns = [
        { header: 'Appareil', key: 'device', width: 20 },
        { header: 'Impressions', key: 'impressions', width: 15 },
        { header: 'Clics', key: 'clics', width: 15 },
        { header: 'CTR (%)', key: 'ctr', width: 15 },
        { header: 'VTR (%)', key: 'vtr', width: 15 },
        { header: 'Poids par impressions (%)', key: 'poidsImpressions', width: 15 },
      ];

      Object.entries(reportingData.metrics.byDevices).forEach(([device, val]) => {
        sheetDevices.addRow({
          device,
          impressions: val.impressions,
          clics: val.clics,
          ctr: val.ctr,
          vtr: val.vtr,
          poidsImpressions: val.poidsImpressions,
        });
      });
      styleSheet(sheetDevices, themeColor);
    }

    // ------------------------------------------------
    // FEUILLE Créatives
    // ------------------------------------------------
    const sheetCreatives = workbook.addWorksheet('Créatives');
    const creativesCols = [
      { header: 'Créative', key: 'creative', width: 50 },
      { header: 'Impressions', key: 'impressions', width: 15 },
      { header: 'Clics', key: 'clics', width: 15 },
      { header: 'CTR (%)', key: 'ctr', width: 15 },
    ];
    if (hasVideoFormat) creativesCols.push({ header: 'VTR (%)', key: 'vtr', width: 15 });
    sheetCreatives.columns = creativesCols;

    Object.entries(reportingData.metrics.byCreatives || {}).forEach(([creative, val]) => {
      const row = { creative, impressions: val.impressions, clics: val.clics, ctr: val.ctr };
      if (hasVideoFormat && val.vtr) row.vtr = val.vtr;
      sheetCreatives.addRow(row);
    });

    // ------------------------------------------------
    // Mise en forme uniforme
    // ------------------------------------------------
    [sheetGlobal, sheetFormat, sheetCreatives].forEach((s) => styleSheet(s, themeColor));
    styleSheet(sheetCampagne, themeColor, false);

    // ------------------------------------------------
    // ENVOI DU FICHIER
    // ------------------------------------------------
    const fileName = `${format(new Date(), 'yyyyMMddHHmm')}-rapport-${regie.toLowerCase()}-${reportingData.campaign_name.replace(/\s+/g, '-')}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    logger.error(`Erreur lors de la génération du rapport Excel : ${error.message}`);
    return Utilities.handleCampaignNotFound(res, 500, "Erreur lors de la génération du rapport", "json");
  }
};

// ----------------------------------------------------
// FONCTION DE STYLE UNIFORME (version robuste)
// ----------------------------------------------------
function styleSheet(sheet, themeColor, zebra = true) {
  try {
    if (!sheet) return;
    if (sheet.rowCount === 0) return;

    const header = sheet.getRow(1);
    if (!header || typeof header.eachCell !== 'function') return;

    header.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: themeColor.replace('#', '') },
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
        bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
      };
    });

    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    sheet.columns?.forEach((col) => {
      if (!col.width || col.width < 10) col.width = 15;
    });

    if (zebra && sheet.rowCount > 2) {
      sheet.eachRow((row, idx) => {
        if (idx > 1 && idx % 2 === 0) {
          row.eachCell((cell) => {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF6F6F6' },
            };
          });
        }
      });
    }

    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.alignment = cell.alignment || {};
        cell.alignment.vertical = 'middle';
      });
    });

  } catch (err) {
    logger.error(`❌ Erreur styleSheet sur "${sheet?.name || 'unknown'}" : ${err.message}`);
  }
}

/*
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

*/