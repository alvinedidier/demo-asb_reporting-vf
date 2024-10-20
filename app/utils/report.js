
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
    { name: 'footer', title: 'FOOTER' }
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
  
  module.exports = { getAvailableFormats };
  