// Initialise le module
const https = require('https');
const http = require('http');

const axios = require(`axios`);
var crypto = require('crypto');
const needle = require("needle");

const csv = require('csv-parser')
const {
    Op
} = require("sequelize");

process.on('unhandledRejection', error => {
    // Will print "unhandledRejection err is not defined"
    logger.error(`unhandledRejection : ${error.message}`);
});
const path = require('path');

const ExcelJS = require('exceljs');
const excel = require('node-excel-export');
var nodeoutlook = require('nodejs-nodemailer-outlook');
const {
    QueryTypes
} = require('sequelize');
const {
    check,
    query
} = require('express-validator');

const apiBuilder = require('../utils/apiBuilder');
const logger = require('../utils/logger');
const {
    makeApiRequest
} = require('../utils/axiosHelper');

// Charge l'ensemble des functions de l'API
const AxiosFunction = require('../functions/functions.axios');
const SmartFunction = require("../functions/functions.smartadserver.api");
const Utilities = require("../functions/functions.utilities");

// Initialise les models const ModelSite = require("../models/models.sites");
const ModelAgencies = require("../models/models.agencies");

const ModelCampaigns = require("../models/models.campaigns");
const ModelAdvertisers = require("../models/models.advertisers");
const ModelSites = require("../models/models.sites");
const ModelInsertions = require("../models/models.insertions");
const ModelInsertionsPriorities = require("../models/models.insertions_priorities");
const ModelInsertionsTemplates = require("../models/models.insertions_templates");
const ModelCreatives = require("../models/models.creatives");

const ModelUsers = require("../models/models.users");

const {
    resolve
} = require('path');
const {
    cpuUsage
} = require('process');
const fs = require('fs');

const {
    upsertCampaign
} = require('../services/campaignMysql'); // Importer la fonction
const {
    upsertEntity
} = require('../services/dbMysql');
const {
    agencyFieldMapping,
    advertiserFieldMapping,
    campaignFieldMapping,
    insertionFieldMapping,
} = require('../utils/mappingDbApi');
const {
    mapApiFieldsToDb
} = require('../utils/mappingHelper');

exports.campaign = async (req, res) => {
    const campaignid = req.params.campaignid;
    try {
        logger.info(`Récupération des données pour la campagne : ${campaignid}`);

        const apiUrl = apiBuilder.buildApiUrl('campaign', {
            campaign_id: campaignid
        });
        if (!apiUrl) {
            throw new Error('URL de l\'API introuvable.');
        }

        // Utilisation de la fonction utilitaire pour faire la requête GET avec retry
        const dataCampaign = await makeApiRequest('GET', apiUrl);

        // Vérification si les données existent
        if (!dataCampaign || !dataCampaign.id) {
            throw new Error('Données de campagne non trouvées');
        }

        // **Vérification du champ agencyId**
        if (dataCampaign.agencyId && dataCampaign.agencyId !== 0) {
            // Gestion de l'agence
            const apiUrlAgency = apiBuilder.buildApiUrl('agency', {
                agency_id: dataCampaign.agencyId
            });
            const dataAgency = await makeApiRequest('GET', apiUrlAgency);

            // Mapper les données de l'agence
            const agencyData = mapApiFieldsToDb(dataAgency, agencyFieldMapping);
            await upsertEntity(ModelAgencies, agencyData, 'agency_id');
        } else {
            logger.info(`Aucune agence associée ou agencyId invalide pour la campagne : ${campaignid}`);
        }

        // Gestion de l'annonceur
        const apiUrlAdvertiser = apiBuilder.buildApiUrl('advertiser', {
            advertiser_id: dataCampaign.advertiserId
        });
        const dataAdvertiser = await makeApiRequest('GET', apiUrlAdvertiser);
        // Mapper les données de campagne et d'insertion
        const advertiserData = mapApiFieldsToDb(dataAdvertiser, advertiserFieldMapping);
        await upsertEntity(ModelAdvertisers, advertiserData, 'advertiser_id');

        // Génération d’un identifiant unique pour chaque campagne
        const campaign_crypt = crypto.createHash('md5').update(dataCampaign.id.toString()).digest("hex");

        // Mapper les données de campagne et d'insertion
        const campaignData = mapApiFieldsToDb(dataCampaign, campaignFieldMapping);
        campaignData.campaign_crypt = campaign_crypt; // Généré manuellement
        await upsertEntity(ModelCampaigns, campaignData, 'campaign_id');

        // Gestion des insertions associées à la campagne
        const apiUrlInsertions = apiBuilder.buildApiUrl('campaignInsertions', {
            campaign_id: campaignid
        });
        const dataInsertions = await makeApiRequest('GET', apiUrlInsertions);
        if (dataInsertions) {
            dataInsertions.forEach(async (insertion) => {
                const insertionData = mapApiFieldsToDb(insertion, insertionFieldMapping);
                await upsertEntity(ModelInsertions, insertionData, 'insertion_id');
            });
        }

        // Envoyer les données en réponse
        return res.status(200).json({
            message: 'Campagne récupérée et sauvegardée avec succès',
            campaign: campaignData,
            campaignData: dataCampaign,
            campaignInsertionsData: dataInsertions,
        });

    } catch (error) {
        logger.error(`Erreur lors de la récupération des données : ${error.message}`);
        return Utilities.handleCampaignNotFound(res, 500, `Erreur lors de la récupération des données : ${error.message}`, 'json');
    }
};

exports.advertiser = async (req, res) => {
    const advertiserid = req.params.advertiserid;
    try {
        logger.info(`Récupération des données pour annonceur : ${advertiserid}`);

        const apiUrl = apiBuilder.buildApiUrl('advertiser', {
            advertiser_id: advertiserid
        });
        if (!apiUrl) {
            throw new Error('URL de l\'API introuvable.');
        }

        // Utilisation de la fonction utilitaire pour faire la requête GET avec retry
        const data = await makeApiRequest('GET', apiUrl);

        // Vérification si les données existent
        if (!data || !data.id) {
            throw new Error('Données de campagne non trouvées');
        }

        // Mapper les données de campagne et d'insertion
        const advertiserData = mapApiFieldsToDb(data, advertiserFieldMapping);
        await upsertEntity(ModelAdvertiser, advertiserData, 'advertiser_id');

        // Gestion des campagnes associées à annonceur
        const apiUrlCampaigns = apiBuilder.buildApiUrl('advertiserCampaigns', {
            advertiser_id: advertiserid
        });
        const dataCampaigns = await makeApiRequest('GET', apiUrlCampaigns);
        if (dataCampaigns) {
            dataCampaigns.forEach(async (campaign) => {
                const campaignData = mapApiFieldsToDb(campaign, campaignFieldMapping);
                await upsertEntity(ModelCampaigns, campaignData, 'campaign_id');
            });
        }

        // Envoyer les données en réponse
        return res.status(200).json({
            message: 'Annonceur récupérée et sauvegardée avec succès',
            advertiser: advertiserData,
            advertiserData: data,
            advertiserCampaignsData: dataCampaigns,
        });

    } catch (error) {
        logger.error(`Erreur lors de la récupération des données : ${error.message}`);
        return Utilities.handleCampaignNotFound(res, 500, `Erreur lors de la récupération des données`, 'json');
    }
};