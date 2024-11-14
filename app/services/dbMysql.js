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
        // Ajouter la validation au début
        if (!Model || !entityData || !uniqueKey) {
            throw new Error('Tous les paramètres sont requis (Model, entityData, uniqueKey)');
        }

        if (!entityData[uniqueKey]) {
            throw new Error(`La clé unique ${uniqueKey} est manquante dans entityData`);
        }

        // Log des données avant upsert
        logger.info(`Données avant upsert : ${JSON.stringify(entityData)}`);

        const [entity, created] = await Model.upsert(entityData);

        if (created) {
            logger.info(`Nouvelle entité ajoutée : ${entityData[uniqueKey]}`);
        } else {
            logger.info(`Entité mise à jour : ${entityData[uniqueKey]}`);
        }

        return {
            entity,
            created,
            uniqueValue: entityData[uniqueKey]
        };
    } catch (error) {
        logger.error('Échec upsert entité :', {
            error: error.message,
            model: Model.name, // Plus propre que ${Model}
            data: entityData,
            uniqueKey,
            uniqueValue: entityData[uniqueKey]
        });
        throw error;
    }
};

module.exports = {
    upsertEntity
};
