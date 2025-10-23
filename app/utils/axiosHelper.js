
const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const logger = require('../utils/logger');

// Appliquer axios-retry à axios
axiosRetry(axios, {
  retries: 3,
  retryDelay: (retryCount) => {
    logger.warn(`Tentative ${retryCount} après une erreur...`);
    return retryCount * 1000;
  },
  retryCondition: (error) => {
    return error.response && error.response.status >= 500;
  }
});

// 🔐 Récupération du token Smart via OAuth2
const getSmartToken = async () => {
  try {
    const response = await axios.post(
      'https://login.eqtv.io/oauth2/token',
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.SMARTADSERVER_CLIENT_ID,
        client_secret: process.env.SMARTADSERVER_CLIENT_SECRET
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );


    console.log('- Request TOKEN SMART:', response.data.access_token);
    console.log('- SMARTADSERVER_CLIENT_ID:', process.env.SMARTADSERVER_CLIENT_ID);
    console.log('- SMARTADSERVER_CLIENT_SECRET:', process.env.SMARTADSERVER_CLIENT_SECRET);

    return response.data.access_token;
  } catch (error) {
    logger.error(`Erreur lors de la récupération du token SMART: ${error.message}`);
    throw error;
  }
};

const buildRequestOptions = (method, apiUrl, body, token) => {
  const options = {
    method,
    url: apiUrl,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  };

  

  if (method === 'POST' && body) {
    options.data = body;
  }

  return options;
};

const makeApiRequest = async (method, apiUrl, body = null) => {
  try {
    if (!['GET', 'POST'].includes(method)) {
      throw new Error(`Méthode HTTP invalide : ${method}`);
    }

    if (!apiUrl) {
      throw new Error('L’URL de l’API est requise');
    }

    const token = await getSmartToken();
    const options = buildRequestOptions(method, apiUrl, body, token);
    const response = await axios(options);

    if (response.status >= 400) {
      throw new Error(`L’appel API a échoué avec le code ${response.status}`);
    }

    return response.data;
  } catch (error) {
    logger.error(`Erreur lors de la requête ${method} vers ${apiUrl}: ${error.message}`);
    logger.error(error.stack);
    throw error;
  }
};

module.exports = {
  makeApiRequest
};
