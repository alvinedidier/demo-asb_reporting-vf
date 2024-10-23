
  const formats = [
    { name: 'habillage', title: 'HABILLAGE' },
    { name: 'interstitiel', title: 'INTERSTITIEL' },
    { name: 'interstitielvideo', title: 'INTERSTITIEL VIDEO' },
    { name: 'instream', title: 'INSTREAM' },
    { name: 'masthead', title: 'MASTHEAD' },
    { name: 'grandangle', title: 'GRAND ANGLE' },
    { name: 'rectanglevideo', title: 'RECTANGLE VIDEO' },
    { name: 'rectangle', title: 'RECTANGLE' },
    { name: 'logo', title: 'LOGO' },
    { name: 'native', title: 'NATIVE' },
    { name: 'slider', title: 'SLIDER' },
    { name: 'mea', title: 'MEA' },
    { name: 'slidervideo', title: 'SLIDER VIDEO' },
    { name: 'clickcommand', title: 'CLICK COMMAND' },
    { name: 'footer', title: 'FOOTER' },
    { name: 'inread', title: 'INREAD' }
];

  /**
   * Fonction pour gérer les formats disponibles dans les données.
   * @param {Object} reportingData - Les données de reporting
   * @returns {Array} - Un tableau de formats disponibles
   */
  function getAvailableFormats(reportingData) {
    return formats.filter(format => reportingData[format.name]);
  }

// Sauvegarder les deux reportId avec expiration :
  function setReportIdsWithExpiry(campaignId, reportId, reportIdVU, ttl = 2 * 60 * 60 * 1000) {
    const now = Date.now();
    const expiryTime = now + ttl; // Délai d'expiration (TTL) de 2 heures
    const data = { reportId, reportIdVU, expiryTime };
  
    localStorage.setItem(`reportIds-${campaignId}`, JSON.stringify(data));
  }
  
  // Récupérer les deux reportId depuis le cache et vérifier l'expiration
  function getReportIds(campaignId) {
    const storedData = localStorage.getItem(`reportIds-${campaignId}`);
  
    if (!storedData) {
      return null; // Pas de données en cache
    }
  
    const { reportId, reportIdVU, expiryTime } = JSON.parse(storedData);
    const now = Date.now();
  
    // Si le cache est expiré
    if (now > expiryTime) {
      localStorage.removeItem(`reportIds-${campaignId}`); // Supprimer le cache expiré
      return null;
    }
  
    // Sinon, retourner les reportId et reportIdVU
    return { reportId, reportIdVU };
  }
  
  module.exports = { getAvailableFormats };
  