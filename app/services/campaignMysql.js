const ModelCampaigns = require('../models/models.campaigns');
const logger = require('../utils/logger');

/**
 * Ajoute ou met à jour une campagne dans la base de données.
 * Si la campagne existe, elle est mise à jour ; sinon, elle est ajoutée.
 * 
 * @param {Object} campaignData - Données de la campagne (id, name, dates, etc.)
 * @returns {Object} - La campagne mise à jour ou nouvellement créée.
 */
const upsertCampaign = async (campaignData) => {
    try {
        const [campaign, created] = await ModelCampaigns.upsert(campaignData);

        if (created) {
            logger.info(`Nouvelle campagne ajoutée : ${campaignData.campaign_id}`);
        } else {
            logger.info(`Campagne mise à jour : ${campaignData.campaign_id}`);
        }

        return campaign;
    } catch (error) {
        logger.error(`Erreur lors de l'ajout ou mise à jour de la campagne : ${error.message}`);
        throw error;
    }
};

module.exports = {
    upsertCampaign
};
