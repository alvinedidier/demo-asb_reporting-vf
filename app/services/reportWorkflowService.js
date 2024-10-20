const axios = require('axios');
const apiBuilder = require('../utils/apiBuilder'); // Intégration de l'apiBuilder
const logger = require('../utils/logger');
// Initialise les identifiants de connexion à l'api
const dotenv = require("dotenv");
dotenv.config({path:"./config.env"})

// Crée une requête pour la campagne
const createRequestCampaign = (startDate, endDate, campaignId) => ({
  startDate,
  endDate,
  metrics: [
    { field: 'Impressions', outputName: 'Impressions', emptyValue: '0' },
    { field: 'Clicks', outputName: 'Clics', emptyValue: '0' },
    { field: 'ClickRate', outputName: 'Taux de clics', emptyValue: '0' },
    { field: 'VideoComplete', outputName: 'Taux de completion', emptyValue: '0' },
  ],
  dimensions: [
    { field: 'AdvertiserId', outputName: 'Annonceur ID', emptyValue: '0' },
    { field: 'AdvertiserName', outputName: 'Annonceur', emptyValue: '0' },
    { field: 'CampaignId', outputName: 'Campagne ID', emptyValue: '0' },
    { field: 'CampaignName', outputName: 'Campagne', emptyValue: '0' },
    { field: 'InsertionId', outputName: 'Insertion ID', emptyValue: '0' },
    { field: 'InsertionName', outputName: 'Insertion', emptyValue: '0' },
    { field: 'FormatId', outputName: 'Format ID', emptyValue: '0' },
    { field: 'FormatName', outputName: 'Format', emptyValue: '0' },
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
    { field: 'ClickRate', outputName: 'Taux de clics', emptyValue: '0' },
    { field: 'VideoComplete', outputName: 'Taux de completion', emptyValue: '0' },
    { field: 'UniqueVisitors', outputName: 'Visiteurs uniques', emptyValue: '0' },
  ],
  dimensions: [
    { field: 'AdvertiserId', outputName: 'Annonceur ID', emptyValue: '0' },
    { field: 'AdvertiserName', outputName: 'Annonceur', emptyValue: '0' },
    { field: 'CampaignId', outputName: 'Campagne ID', emptyValue: '0' },
    { field: 'CampaignName', outputName: 'Campagne', emptyValue: '0' },
  ],
  filters: [[{ field: 'CampaignId', operator: 'IN', values: [campaignId] }]],
  useCaseId: 'AdServing',
  dateFormat: "yyyy-MM-dd'T'HH:mm:ss",
  timezone: 'UTC',
  reportName: `Report Campaign ${campaignId} VU - Date ${new Date().toISOString()}`,
});

// Fonction pour envoyer la requête et obtenir le reportId
async function fetchReportId(startDate, endDate, campaignId, useVu = false) {
  // Utilisation de apiBuilder pour générer l'URL de reporting
  const apiUrl = apiBuilder.buildApiUrl('report');
  const body = useVu
    ? createRequestCampaignVU(startDate, endDate, campaignId)
    : createRequestCampaign(startDate, endDate, campaignId);

  try {
   
   const response = await axios.post(apiUrl, body, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${process.env.SMARTADSERVER_LOGIN}:${process.env.SMARTADSERVER_PASSWORD}`).toString('base64')}`,
      },
    });
    
     return response.data; // reportId ou objet similaire
  } catch (error) {
    console.error('Erreur lors de la récupération du reportId:', error);
    throw new Error('Erreur lors de la création du reporting');
  }
}

// Fonction pour récupérer les détails du rapport avec le reportId
async function fetchReportDetails(reportId) {
  // Utilisation de apiBuilder pour générer l'URL du détail du rapport
  const apiUrl = `${apiBuilder.buildApiUrl('report')}${reportId}`;

  try {
    const response = await axios.get(apiUrl, {
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${process.env.SMARTADSERVER_LOGIN}:${process.env.SMARTADSERVER_PASSWORD}`
        ).toString('base64')}`,
      },
    });
    return response.data; // détails du rapport
  } catch (error) {
    logger.error('Erreur lors de la récupération des détails du rapport:', error);
    throw new Error('Erreur lors de la récupération des détails du reporting');
  }
}

// Fonction pour récupérer les données CSV à partir d'une instance ID
async function fetchCsvData(instanceId) {
  const apiUrl = "/api/equativ/csv";
  
  try {
    const response = await axios.post(apiUrl, { instanceId }, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.data) {
      throw new Error('Erreur lors de la récupération du fichier CSV');
    }
    return response.data.csvData; // Contenu CSV
  } catch (error) {
    logger.error('Erreur lors de la récupération du CSV:', error);
    throw new Error('Erreur lors de la récupération du fichier CSV');
  }
}

module.exports = {
  fetchReportId,
  fetchReportDetails,
  fetchCsvData,
};
