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
const localStorageReportIds = new LocalStorage(`data/reportIds/${formattedDate}/`);
const localStorageInstanceIds = new LocalStorage(`data/instanceIds/${formattedDate}/`);

// Sauvegarder les deux reportId avec expiration :
function setReportIdsWithExpiry(campaignId, reportId, reportIdVU, ttl = 2 * 60 * 60 * 1000) {
  const now = Date.now();
  const expiryTime = now + ttl; // Délai d'expiration (TTL) de 2 heures
  const data = {
    reportId,
    reportIdVU,
    expiryTime
  };

  localStorageReportIds.setItem(`reportIds-${campaignId}.json`, JSON.stringify(data));
}

// Récupérer les deux reportId depuis le cache et vérifier l'expiration
function getReportIds(campaignId) {
  const storedData = localStorageReportIds.getItem(`reportIds-${campaignId}.json`);

  if (!storedData) {
    return null; // Pas de données en cache
  }

  const {
    reportId,
    reportIdVU,
    expiryTime
  } = JSON.parse(storedData);
  const now = Date.now();

  // Si le cache est expiré
  if (now > expiryTime) {
    localStorageReportIds.removeItem(`reportIds-${campaignId}.json`); // Supprimer le cache expiré
    return null;
  }

  // Sinon, retourner les reportId et reportIdVU
  return {
    reportId,
    reportIdVU
  };
}

// Sauvegarder les deux instanceId avec expiration :
function setInstanceIdsWithExpiry(campaignId, instanceId, instanceIdVU, ttl = 2 * 60 * 60 * 1000) {
  const now = Date.now();
  const expiryTime = now + ttl; // Délai d'expiration (TTL) de 2 heures
  const data = {
    instanceId,
    instanceIdVU,
    expiryTime
  };

  localStorageInstanceIds.setItem(`instanceIds-${campaignId}.json`, JSON.stringify(data));
}

// Récupérer les deux instanceId depuis le cache et vérifier l'expiration
function getInstanceIds(campaignId) {
  const storedData = localStorageInstanceIds.getItem(`instanceIds-${campaignId}.json`);

  if (!storedData) {
    return null; // Pas de données en cache
  }

  const {
    instanceId,
    instanceIdVU,
    expiryTime
  } = JSON.parse(storedData);
  const now = Date.now();

  // Si le cache est expiré
  if (now > expiryTime) {
    localStorageInstanceIds.removeItem(`instanceIds-${campaignId}.json`); // Supprimer le cache expiré
    return null;
  }

  // Sinon, retourner les instanceId et instanceIdVU
  return {
    instanceId,
    instanceIdVU
  };
}

// Sauvegarder les deux instanceId avec expiration :
function setCampaignIdWithExpiry(campaignId, reportData, ttl = 2 * 60 * 60 * 1000) {
  const now = Date.now();
  const expiryTime = now + ttl; // Délai d'expiration (TTL) de 2 heures
  const data = {
    campaignId,
    reportData,
    expiryTime
  };

  localStorage.setItem(`campaignID-${campaignId}.json`, JSON.stringify(data));
}

// Récupérer la campagne depuis le cache et vérifier l'expiration
function getCampaignId(campaignId) {
  const storedData = localStorage.getItem(`campaignID-${campaignId}.json`);

  if (!storedData) {
    return null; // Pas de données en cache
  }

  const { reportData, expiryTime } = JSON.parse(storedData);
  const now = Date.now();

  // Récupération des dates nécessaires
  const campaignEndDate = new Date(reportData.campaign_end_date);
  const reportingStartDate = new Date(reportData.reporting_dates.reporting_start_date);

  // Vérifier si la campagne est terminée et que le reporting est valide
  if (now > campaignEndDate && reportingStartDate > campaignEndDate) {
    // La campagne est terminée ET le reporting a été généré après la fin de la campagne
    console.log('La campagne est terminée et le reporting est généré après la fin de la campagne, données conservées.');
    return reportData;
  }

  // Vérifier si le cache a expiré
  if (now > expiryTime) {
    console.log('Cache expiré, suppression des données...');
    localStorage.removeItem(`campaignID-${campaignId}.json`); // Supprimer le cache expiré
    return null;
  }

  // Sinon, retourner les données de la campagne
  return reportData;
}

function deleteAllCampaignData(campaignId) {
  try {
    // Supprimer les reportIds associés à la campagne
    localStorageReportIds.removeItem(`reportIds-${campaignId}.json`);

    // Supprimer les instanceIds associés à la campagne
    localStorageInstanceIds.removeItem(`instanceIds-${campaignId}.json`);

    // Supprimer les données de campagne associées au campaignId
    localStorage.removeItem(`campaignID-${campaignId}.json`);

    console.log(`Toutes les données associées à la campagne ${campaignId} ont été supprimées.`);
    return true; // Retourner true pour indiquer que la suppression a réussi
  } catch (error) {
    console.error(`Erreur lors de la suppression des données de la campagne ${campaignId}:`, error);
    return false; // Retourner false en cas d'erreur
  }
}

module.exports = {
  setReportIdsWithExpiry,
  getReportIds,
  setInstanceIdsWithExpiry,
  getInstanceIds,
  setCampaignIdWithExpiry,
  getCampaignId,
  deleteAllCampaignData
};