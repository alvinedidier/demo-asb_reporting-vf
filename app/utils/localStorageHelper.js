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

  localStorageReportIds.setItem(`reportIds-${campaignId}`, JSON.stringify(data));
}

// Récupérer les deux reportId depuis le cache et vérifier l'expiration
function getReportIds(campaignId) {
  const storedData = localStorageReportIds.getItem(`reportIds-${campaignId}`);

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
    localStorageReportIds.removeItem(`reportIds-${campaignId}`); // Supprimer le cache expiré
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

  localStorageInstanceIds.setItem(`instanceIds-${campaignId}`, JSON.stringify(data));
}

// Récupérer les deux instanceId depuis le cache et vérifier l'expiration
function getInstanceIds(campaignId) {
  const storedData = localStorageInstanceIds.getItem(`instanceIds-${campaignId}`);

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
    localStorageInstanceIds.removeItem(`instanceIds-${campaignId}`); // Supprimer le cache expiré
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

  localStorage.setItem(`campaignID-${campaignId}`, JSON.stringify(data));
}

// Récupérer la campagne depuis le cache et vérifier l'expiration
function getCampaignId(campaignId) {
  const storedData = localStorage.getItem(`campaignID-${campaignId}`);

  if (!storedData) {
    return null; // Pas de données en cache
  }

  const { reportData, expiryTime } = JSON.parse(storedData);
  const now = Date.now();

  // Vérifie si le cache a expiré et que la campagne est toujours en cours par rapport aux dates de reporting
  // now > expiryTime && 
  if (new Date(reportData.campaign_end_date) < new Date(reportData.reporting_dates.reporting_start_date)) {
    localStorage.removeItem(`campaignID-${campaignId}`); // Supprime le cache expiré
    return null;
  }

  // Sinon, retourner les données de la campagne
  return reportData;
}

module.exports = {
  setReportIdsWithExpiry,
  getReportIds,
  setInstanceIdsWithExpiry,
  getInstanceIds,
  setCampaignIdWithExpiry,
  getCampaignId
};