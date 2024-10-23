const apiBuilder = require('../utils/apiBuilder'); // Intégration de l'apiBuilder
const logger = require('../utils/logger');
const { makeApiRequest } = require('../utils/axiosHelper');

// Gestion des dates
const { differenceInDays, isAfter, isBefore, parseISO, format } = require('date-fns');
const { fr: frLocale } = require('date-fns/locale');

// Initialise les identifiants de connexion à l'api
const dotenv = require("dotenv");
const { CsvParserStream } = require('fast-csv');
dotenv.config({path:"./config.env"})

// Crée une requête pour la campagne
const createRequestCampaign = (startDate, endDate, campaignId) => ({
  startDate,
  endDate,
  metrics: [
    { field: 'Impressions', outputName: 'Impressions', emptyValue: '0' },
    { field: 'Clicks', outputName: 'Clics', emptyValue: '0' },
    { field: 'ClickRate', outputName: 'ClickRate', emptyValue: '0' },
    { field: 'VideoComplete', outputName: 'VideoComplete', emptyValue: '0' },
  ],
  dimensions: [
    { field: 'AdvertiserId', outputName: 'AdvertiserId', emptyValue: '0' },
    { field: 'AdvertiserName', outputName: 'AdvertiserName', emptyValue: '0' },
    { field: 'CampaignId', outputName: 'CampaignId', emptyValue: '0' },
    { field: 'CampaignName', outputName: 'CampaignName', emptyValue: '0' },
    { field: 'InsertionId', outputName: 'InsertionId', emptyValue: '0' },
    { field: 'InsertionName', outputName: 'InsertionName', emptyValue: '0' },
    { field: 'FormatId', outputName: 'FormatId', emptyValue: '0' },
    { field: 'FormatName', outputName: 'FormatName', emptyValue: '0' },
    { field: 'AppOrSiteId', outputName: 'AppOrSiteId', emptyValue: '0' },
    { field: 'AppOrSiteName', outputName: 'AppOrSiteName', emptyValue: '0' },
    { field: 'AdservingCreativeName', outputName: 'AdservingCreativeName', emptyValue: '0' }
  ],
  filters: [[{ field: 'CampaignId', operator: 'IN', values: [campaignId] }]],
  useCaseId: 'AdServing',
  dateFormat: "yyyy-MM-dd'T'HH:mm:ss",
  timezone: 'UTC',
  reportName: `Report Campaign ${campaignId} - Date ${new Date().toISOString()}`,
});

// Crée une requête pour la campagne avec Visiteurs Uniques (VU)
const createRequestCampaignVU = (startDate, endDate, campaignId) => ({
  startDate,
  endDate,
  metrics: [
    { field: 'Impressions', outputName: 'Impressions', emptyValue: '0' },
    { field: 'Clicks', outputName: 'Clics', emptyValue: '0' },
    { field: 'ClickRate', outputName: 'ClickRate', emptyValue: '0' },
    { field: 'VideoComplete', outputName: 'VideoComplete', emptyValue: '0' },
    { field: 'UniqueVisitors', outputName: 'UniqueVisitors', emptyValue: '0' },
  ],
  dimensions: [
    { field: 'AdvertiserId', outputName: 'AdvertiserId', emptyValue: '0' },
    { field: 'AdvertiserName', outputName: 'AdvertiserName', emptyValue: '0' },
    { field: 'CampaignId', outputName: 'CampaignId', emptyValue: '0' },
    { field: 'CampaignName', outputName: 'CampaignName', emptyValue: '0' },
  ],
  filters: [[{ field: 'CampaignId', operator: 'IN', values: [campaignId] }]],
  useCaseId: 'AdServing',
  dateFormat: "yyyy-MM-dd'T'HH:mm:ss",
  timezone: 'UTC',
  reportName: `Report Campaign ${campaignId} VU - Date ${new Date().toISOString()}`,
});

// Fonction pour envoyer la requête et obtenir l'instanceId
async function fetchReportId(startDate, endDate, campaignId, useVu = false) {
  // Utilisation de apiBuilder pour générer l'URL de reporting
  const apiUrl = apiBuilder.buildApiUrl('report');
  const body = useVu
    ? createRequestCampaignVU(startDate, endDate, campaignId)
    : createRequestCampaign(startDate, endDate, campaignId);

  try {   
    // Utilisation de la fonction utilitaire pour faire la requête GET avec retry
    const response = await makeApiRequest('POST', apiUrl, body);
    return response; // reportId ou objet similaire
  } catch (error) {
    console.error('Erreur lors de la récupération du reportId dans la fct fetchReportId:', error);
    throw new Error('Erreur lors de la création du reporting');
  }
}

// Fonction pour récupérer les détails du rapport avec le instanceId
async function fetchReportDetails(reportId, retryCount = 0, maxRetries = 10, delay = 10000) {
  // Utilisation de apiBuilder pour générer l'URL du détail du rapport
  const apiUrl = `${apiBuilder.buildApiUrl('report')}${reportId}`;
  
  try { 
     // Utilisation de la fonction utilitaire pour faire la requête GET avec retry
    const response = await makeApiRequest('GET', apiUrl);
    const reportInstanceID = response;

    // Si l'instanceId n'est pas trouvé, on relance
    if (!reportInstanceID.instanceId && retryCount < maxRetries) {
      logger.warn(`Instance ID du ReportID ${reportId} non trouvé, nouvelle tentative dans ${delay}ms... Tentative ${retryCount + 1}`);
      
      // Attendre le délai avant de relancer
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Relance de la fonction
      return fetchReportDetails(reportId, retryCount + 1, maxRetries, delay);
    }

    // Si l'instanceId est trouvé ou si le nombre de tentatives est dépassé, on retourne le résultat
    if (reportInstanceID.instanceId) {
      logger.info(`Instance ID du ReportID ${reportId} trouvé avec succès ${reportInstanceID.instanceId}.`);
      return reportInstanceID.instanceId;
    } else {
      throw new Error('Nombre maximum de tentatives atteint, instance ID introuvable.');
    }

  } catch (error) {
    logger.error('Erreur lors de la récupération des détails du rapport:', error);
    throw new Error('Erreur lors de la récupération des détails du reporting');
  }
}

// Fonction pour récupérer les données CSV à partir d'une instance ID
async function fetchCsvData(instanceId) {  
  try {
    
    const response = await makeApiRequest('GET', instanceId); 
    if (!response) {
      throw new Error('Erreur lors de la récupération du fichier CSV');
    }

    return response; // Contenu CSV
  } catch (error) {
    logger.error('Erreur lors de la récupération du CSV:', error);
    throw new Error('Erreur lors de la récupération du fichier CSV');
  }
}

// Fonction pour sauvegarder le format JSON
async function saveJson(reportData, reportDataVU) {
  
  try {
    
    const response = await makeApiRequest('GET', instanceId); 
    if (!response) {
      throw new Error('Erreur lors de la récupération');
    }

    return response; // Contenu CSV
  } catch (error) {
    logger.error('Erreur lors de la récupération du CSV:', error);
    throw new Error('Erreur lors de la récupération du fichier CSV');
  }
}

// Fonction pour formater les données brutes dans le format JSON attendu
async function formatReportData(reportData, reportDataVU) {
  const mastheadData = extractDataForFormat(reportData, 'masthead');
  const grandAngleData = extractDataForFormat(reportData, 'grandangle');

  return {
      masthead: mastheadData,
      grandangle: grandAngleData,
      campaign: extractCampaignData(reportData),
      creatives: extractCreativeData(reportData),
      creative: formatCreativeDetails(reportData),
      reporting_start_date: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      reporting_end_date: format(new Date(), 'yyyy-MM-dd HH:mm:ss')
  };
}

// Fonction utilitaire pour extraire les données d'un format spécifique
async function extractDataForFormat(data, formatName) {
  const formatData = data.filter(item => item.format === formatName);
  return {
      siteList: formatData.reduce((acc, site, index) => {
          acc[index] = {
              site: site.site_name,
              impressions: site.impressions,
              clicks: site.clicks,
              ctr: (site.clicks / site.impressions * 100).toFixed(2),
              complete: site.complete || 0,
              ctrComplete: (site.complete / site.impressions * 100).toFixed(2)
          };
          return acc;
      }, {}),
      impressions: formatData.reduce((sum, item) => sum + item.impressions, 0),
      clicks: formatData.reduce((sum, item) => sum + item.clicks, 0),
      ctr: (formatData.reduce((sum, item) => sum + item.clicks, 0) / formatData.reduce((sum, item) => sum + item.impressions, 0) * 100).toFixed(2),
      complete: 0,
      ctrComplete: "0.00"
  };
}

module.exports = {
  fetchReportId,
  fetchReportDetails,
  fetchCsvData,
  formatReportData,
  extractDataForFormat
};
