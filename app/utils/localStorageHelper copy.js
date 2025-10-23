const { differenceInDays, isAfter, isBefore, parseISO, format } = require('date-fns');
const { fr: frLocale } = require('date-fns/locale');
const { LocalStorage } = require('node-localstorage');
const fs = require('fs');
const path = require('path');

const currentDate = new Date();
const formattedDate = format(currentDate, 'yyyy/MM/dd');

// Créer les dossiers s'ils n'existent pas
function ensureDirectoryExistence(filePath) {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  fs.mkdirSync(dirname, { recursive: true });
  return true;
}

// Initialiser les stockages locaux
ensureDirectoryExistence(path.join(__dirname, `data/reporting/`));
ensureDirectoryExistence(path.join(__dirname, `data/reportIds/${formattedDate}/`));
ensureDirectoryExistence(path.join(__dirname, `data/instanceIds/${formattedDate}/`));

const localStorage = new LocalStorage('data/reporting/');
const localStorageReportIds = new LocalStorage(`data/reportIds/${formattedDate}/`);
const localStorageInstanceIds = new LocalStorage(`data/instanceIds/${formattedDate}/`);

// Fonction générique pour sauvegarder des données avec expiration
function setWithExpiry(storage, key, data, ttl = 2 * 60 * 60 * 1000) {
  if (!key || !data) {
    console.error('Paramètres invalides pour setWithExpiry');
    return false;
  }
  try {
    const now = Date.now();
    const expiryTime = now + ttl;
    storage.setItem(key, JSON.stringify({ ...data, expiryTime }));
    return true;
  } catch (error) {
    console.error(`Erreur lors de la sauvegarde des données pour la clé ${key}:`, error);
    return false;
  }
}

// Fonction générique pour récupérer des données avec expiration
function getWithExpiry(storage, key) {
  if (!key) {
    console.error('Paramètre key invalide pour getWithExpiry');
    return null;
  }
  try {
    const storedData = storage.getItem(key);
    if (!storedData) return null;

    const { expiryTime, ...data } = JSON.parse(storedData);
    const now = Date.now();

    if (now > expiryTime) {
      storage.removeItem(key);
      return null;
    }

    return data;
  } catch (error) {
    console.error(`Erreur lors de la récupération des données pour la clé ${key}:`, error);
    return null;
  }
}

// Sauvegarder les deux reportId avec expiration
function setReportIdsWithExpiry(campaignId, reportId, reportIdVU, ttl = 2 * 60 * 60 * 1000) {
  return setWithExpiry(localStorageReportIds, `reportIds-${campaignId}.json`, { reportId, reportIdVU }, ttl);
}

// Récupérer les deux reportId depuis le cache et vérifier l'expiration
function getReportIds(campaignId) {
  return getWithExpiry(localStorageReportIds, `reportIds-${campaignId}.json`);
}

// Sauvegarder les deux instanceId avec expiration
function setInstanceIdsWithExpiry(campaignId, instanceId, instanceIdVU, ttl = 2 * 60 * 60 * 1000) {
  return setWithExpiry(localStorageInstanceIds, `instanceIds-${campaignId}.json`, { instanceId, instanceIdVU }, ttl);
}

// Récupérer les deux instanceId depuis le cache et vérifier l'expiration
function getInstanceIds(campaignId) {
  return getWithExpiry(localStorageInstanceIds, `instanceIds-${campaignId}.json`);
}

// Sauvegarder les données de campagne avec expiration
function setCampaignIdWithExpiry(campaignId, reportData, ttl = 2 * 60 * 60 * 1000) {
  return setWithExpiry(localStorage, `campaignID-${campaignId}.json`, { reportData }, ttl);
}

// Récupérer la campagne depuis le cache et vérifier l'expiration
function getCampaignId(campaignId) {
  const storedData = getWithExpiry(localStorage, `campaignID-${campaignId}.json`);
  if (!storedData) return null;

  const { reportData } = storedData;
  const now = Date.now();
  const campaignEndDate = new Date(reportData.campaign_end_date);
  const reportingStartDate = new Date(reportData.reporting_dates.reporting_start_date);

  // Vérifier si la campagne est terminée et que le reporting est valide
  if (now > campaignEndDate && reportingStartDate > campaignEndDate) {
    console.log('La campagne est terminée et le reporting est généré après la fin de la campagne, données conservées.');
    return reportData;
  }

  return reportData;
}

// Supprimer toutes les données associées à une campagne
function deleteAllCampaignData(campaignId) {
  try {
    localStorageReportIds.removeItem(`reportIds-${campaignId}.json`);
    localStorageInstanceIds.removeItem(`instanceIds-${campaignId}.json`);
    localStorage.removeItem(`campaignID-${campaignId}.json`);
    console.log(`Toutes les données associées à la campagne ${campaignId} ont été supprimées.`);
    return true;
  } catch (error) {
    console.error(`Erreur lors de la suppression des données de la campagne ${campaignId}:`, error);
    return false;
  }
}

// Nettoyer les données expirées
function cleanupExpiredData() {
  [localStorage, localStorageReportIds, localStorageInstanceIds].forEach(storage => {
    try {
      const keys = Object.keys(storage._data);
      const now = Date.now();

      keys.forEach(key => {
        try {
          const storedData = storage.getItem(key);
          if (!storedData) return;

          const { expiryTime } = JSON.parse(storedData);
          if (now > expiryTime) {
            storage.removeItem(key);
          }
        } catch (error) {
          console.error(`Erreur lors du nettoyage des données pour la clé ${key}:`, error);
        }
      });
    } catch (error) {
      console.error('Erreur lors du nettoyage des données expirées:', error);
    }
  });
}

module.exports = {
  setReportIdsWithExpiry,
  getReportIds,
  setInstanceIdsWithExpiry,
  getInstanceIds,
  setCampaignIdWithExpiry,
  getCampaignId,
  deleteAllCampaignData,
  cleanupExpiredData
};
