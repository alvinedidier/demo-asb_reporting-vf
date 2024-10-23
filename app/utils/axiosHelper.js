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

// Fonction utilitaire pour effectuer une requête GET ou POST avec axios et les en-têtes appropriés
const makeApiRequest = async (method, apiUrl, body = null) => {
    try {
        const options = {
            method: method,
            url: apiUrl,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${Buffer.from(`${process.env.SMARTADSERVER_LOGIN}:${process.env.SMARTADSERVER_PASSWORD}`).toString('base64')}`,
            },
        };

        // Ajouter le body si la méthode est POST
        if (method === 'POST' && body) {
            options.data = body;
        }

        // Faire la requête via axios
        const response = await axios(options);
        return response.data;
    } catch (error) {
        logger.error(`Erreur lors de la requête ${method} à ${apiUrl}: ${error.message}`);
        throw error; // Relancer l'erreur pour la gestion dans les appels
    }
};

module.exports = {
    makeApiRequest
};
