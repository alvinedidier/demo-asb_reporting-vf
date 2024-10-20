// utils/apiBuilder.js

// Définition des URLs de base pour chaque type d'API
const apiBaseUrls = {
  manage: 'https://manage.smartadserverapis.com/2044/',
  reporting: 'https://supply-api.eqtv.io/insights/report-async/',
  forecast: 'https://forecast.smartadserverapis.com/2044/forecast',
};

// Endpoints spécifiques à l'API "manage"
const manageApiUrlMap = {
  agencies: 'agencies/',
  advertisers: 'Advertisers',
  advertiser: (params) => `advertisers/${params?.advertiser_id}`,
  advertisersCampaigns: (params) => `Advertisers/${params?.advertiser_id}/campaigns`,
  campaigns: 'Campaigns/',
  campaign: (params) => `campaigns/${params?.campaign_id}`,
  formats: 'formats',
  sites: 'sites',
  packs: 'packs',
  templates: 'templates',
  platforms: 'platforms',
  deliverytypes: 'deliverytypes',
  countries: 'countries',
  insertions: 'insertions',
  insertion: (params) => `insertions/${params?.insertion_id}`,
  insertions_templates: (params) => `insertions/${params?.insertion_id}/insertiontemplates`,
  insertions_status: 'insertions_status',
  insertions_priorities: 'insertionpriorities',
  creatives: (params) => `insertions/${params?.insertion_id}/creatives`,
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
