// utils/apiBuilder.js

// Définition des URLs de base pour chaque type d'API
const apiBaseUrls = {
  manage: 'https://manage.smartadserverapis.com/2044/',
  reporting: 'https://supply-api.eqtv.io/insights/report-async/',
  forecast: 'https://forecast.smartadserverapis.com/2044/forecast',
};

// Endpoints spécifiques à l'API "manage"
const manageApiUrlMap = {
  agencies: `Agencies/`,
  advertisers: `Advertisers`,
  advertiser: (params) => `Advertisers/${params?.advertiser_id}`,
  advertiserCampaigns: (params) => `Advertisers/${params?.advertiser_id}/Campaigns`,
  campaigns: `Campaigns/`,
  campaign: (params) => `Campaigns/${params?.campaign_id}`,
  campaignInsertions: (params) => `Campaigns/${params?.campaign_id}/Insertions`,
  formats: `Formats`,
  sites: `Sites`,
  packs: `Packs`,
  templates: `Templates`,
  platforms: `Platforms`,
  deliverytypes: `Deliverytypes`,
  countries: `Countries`,
  insertions: `Insertions`,
  insertion: (params) => `Insertions/${params?.insertion_id}`,
  insertionsTemplates: (params) => `Insertions/${params?.insertion_id}/insertiontemplates`,
  insertionsStatus: `Insertions_status`,
  insertionsPriorities: `Insertionspriorities`,
  creatives: (params) => `Insertions/${params?.insertion_id}/creatives`,
};

// Classe ApiBuilder
class ApiBuilder {
  constructor() {
    this.baseUrls = apiBaseUrls;
    this.urlMaps = {
      manage: manageApiUrlMap,
      // Ajoutez d'autres mappings si nécessaire dans le futur
    };
  }

  // Fonction pour obtenir l'URL de base en fonction de la méthode
  getBaseUrlForMethod(method) {
    if (method === 'report') {
      return this.baseUrls.reporting;
    } else if (method === 'forecast') {
      return this.baseUrls.forecast;
    }
    return this.baseUrls.manage;
  }

  // Fonction pour construire l'URL API complète
  buildApiUrl(method, params = {}) {
    const baseUrl = this.getBaseUrlForMethod(method);

    if (!baseUrl) {
      return null;
    }

    // Gestion des endpoints pour "manage"
    if (baseUrl === this.baseUrls.manage) {
      const endpoint = this.urlMaps.manage[method];
      if (typeof endpoint === 'function') {
        return `${baseUrl}${endpoint(params)}`;
      }
      return endpoint ? `${baseUrl}${endpoint}` : null;
    }

    // Gestion pour les autres APIs ("reporting", "forecast")
    return baseUrl; // L'URL est déjà complète pour "reporting" et "forecast"
  }
}

// Exportation de l'instance de la classe ApiBuilder
module.exports = new ApiBuilder();
