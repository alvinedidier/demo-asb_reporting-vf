const logger = require('../utils/logger');

/**
 * Ajoute ou met à jour une entité dans la base de données.
 * Si l'entité existe, elle est mise à jour ; sinon, elle est ajoutée.
 * 
 * @param {Object} Model - Le modèle Sequelize pour l'entité (ex: ModelCampaigns)
 * @param {Object} entityData - Données de l'entité à ajouter ou mettre à jour
 * @param {string} uniqueKey - Nom du champ identifiant l'entité (ex: 'campaign_id')
 * @returns {Object} - L'entité mise à jour ou nouvellement créée.
 */
const upsertEntity = async (Model, entityData, uniqueKey) => {
    try {
        // Vérification des paramètres
        if (!entityData || typeof entityData !== 'object') {
            throw new Error("Données de l'entité invalides (null ou undefined)");
        }
        if (!Model || typeof Model.upsert !== 'function') {
            throw new Error("Le modèle Sequelize fourni est invalide ou non défini.");
        }

        // Exécution de l'upsert
        const entity = await Model.upsert(entityData);
        
        // Log et retour
        logger.info(`Entité ajoutée ou mise à jour : ${entityData[uniqueKey]}`);
        return entity;
        
    } catch (error) {
        logger.error(`Erreur lors de l'ajout ou mise à jour de l'entité : ${error.message}`);
        throw error;
    }
};

module.exports = {
    upsertEntity
};
