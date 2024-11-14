const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const logger = require('../utils/logger');

// Appliquer axios-retry à axios
axiosRetry(axios, { 
    retries: 3, // Nombre de tentatives
    retryDelay: (retryCount) => {
        logger.warn(`Tentative ${retryCount} après une erreur...`);
        return retryCount * 1000; // Délai de 1 seconde entre les tentatives
    },
    retryCondition: (error) => {
        // Réessayer uniquement si l'erreur est liée à un problème réseau ou une réponse 5xx
        return error.response && error.response.status >= 500;
    }
});

const buildRequestOptions = (method, apiUrl, body) => {
    const options = {
      method,
      url: apiUrl,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${process.env.SMARTADSERVER_LOGIN}:${process.env.SMARTADSERVER_PASSWORD}`).toString('base64')}`,
      },
    };
  
    if (method === 'POST' && body) {
      options.data = body;
    }
  
    return options;
  };
  
  const makeApiRequest = async (method, apiUrl, body = null) => {
    try {
      // Valider les paramètres
      if (!['GET', 'POST'].includes(method)) {
        throw new Error(`Invalid HTTP method: ${method}`);
      }
  
      if (!apiUrl) {
        throw new Error('API URL is required');
      }
  
      const options = buildRequestOptions(method, apiUrl, body);
      const response = await axios(options);
  
      // Vérifier le code de statut HTTP
      if (response.status >= 400) {
        throw new Error(`API request failed with status code ${response.status}: ${response.statusText}`);
      }
  
      return response.data;
    } catch (error) {
      logger.error(`Error making ${method} request to ${apiUrl}: ${error.message}`);
      logger.error(`Error details: ${error.stack}`);
      throw error;
    }
  };

module.exports = {
    makeApiRequest
};
