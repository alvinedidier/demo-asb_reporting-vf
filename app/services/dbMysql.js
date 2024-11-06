// utils/dbUtils.js
const logger = require('../utils/logger');

/**
 * Ajoute ou met à jour une entité dans la base de données.
 * Si l'entité existe, elle est mise à jour ; sinon, elle est ajoutée.
 * 
 * @param {Object} model - Le modèle Sequelize pour l'entité (par ex: ModelCampaigns)
 * @param {Object} entityData - Données de l'entité à ajouter ou mettre à jour
 * @param {string} entityIdField - Nom du champ identifiant l'entité (par ex: 'campaign_id')
 * @returns {Object} - L'entité mise à jour ou nouvellement créée.
 */
const upsertEntity = async (Model, entityData, uniqueKey) => {
    try {
        const [entity, created] = await Model.upsert(entityData);

        if (created) {
            logger.info(`Nouvelle entité ajoutée : ${entityData[uniqueKey]}`);
        } else {
            logger.info(`Entité mise à jour : ${entityData[uniqueKey]}`);
        }

        return entity;
    } catch (error) {
        logger.error(`Erreur lors de l'ajout ou mise à jour de l'entité : ${error.message}`);
        logger.error(`Erreur lors de l'ajout ou mise à jour de l'entité Model : ${Model}`);
        logger.error(`Erreur lors de l'ajout ou mise à jour de l'entité entityData : ${JSON.stringify(entityData)}`);
        logger.error(`Erreur lors de l'ajout ou mise à jour de l'entité uniqueKey : ${uniqueKey}`);
        throw error;
    }
};

module.exports = {
    upsertEntity
};
