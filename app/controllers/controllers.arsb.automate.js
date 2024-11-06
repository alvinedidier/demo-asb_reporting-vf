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
const SmartFunction = require('../functions/functions.smartadserver.api');
const Utilities = require('../functions/functions.utilities');
const ReportService = require('../services/reportWorkflowService');

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

const {
    differenceInDays,
    isAfter,
    isBefore,
    parseISO,
    format
} = require('date-fns');
const {
    fr: frLocale
} = require('date-fns/locale');

const LocalStorage = require('node-localstorage').LocalStorage;
const localStorage = new LocalStorage('data/reporting/');
// const localStorageReportIds = new LocalStorage(`data/instanceIds/${formattedDate}/`);

const {
  getAvailableFormats
} = require('../utils/report'); // Importe la fonction du fichier utils/reports.js
const {
  getReportIds,
  setReportIdsWithExpiry,
  getInstanceIds,
  setInstanceIdsWithExpiry,
  getCampaignId,
  setCampaignIdWithExpiry
} = require('../utils/localStorageHelper'); // Import des fonctions de gestion du cache

const {
  ReportBuildJson
} = require('../utils/reportHelper');

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

/*
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
        */
        // Génération d’un identifiant unique pour chaque campagne
        const campaign_crypt = crypto.createHash('md5').update(dataCampaign.id.toString()).digest("hex");

        // Mapper les données de campagne et d'insertion
        const campaignData = mapApiFieldsToDb(dataCampaign, campaignFieldMapping);
        campaignData.campaign_crypt = campaign_crypt; // Généré manuellement
        logger.info(`campaignData : ${JSON.stringify(campaignData)}`);
 console.log(dataCampaign); process.exit(0);
      /*  await upsertEntity(ModelCampaigns, campaignData, 'campaign_id');
        
        // Gestion des insertions associées à la campagne
        const apiUrlInsertions = apiBuilder.buildApiUrl('campaignInsertions', {
            campaign_id: campaignid
        });
        const dataInsertions = await makeApiRequest('GET', apiUrlInsertions);

        if (dataInsertions) {
            for (const insertion of dataInsertions) {
                const insertionData = mapApiFieldsToDb(insertion, insertionFieldMapping);
                await upsertEntity(ModelInsertions, insertionData, 'insertion_id');
            }
        }

        // Envoyer les données en réponse
        return res.status(200).json({
            message: 'Campagne récupérée et sauvegardée avec succès',
            campaign: campaignData,
            campaignData: dataCampaign,
            campaignInsertionsData: dataInsertions,
        });
*/
    } catch (error) {
        logger.error(`Erreur lors de la récupération des données : ${error.message}`);
        return Utilities.handleCampaignNotFound(res, 500, `Erreur lors de la récupération des données : ${error.message}`, 'json');
    }
};

exports.campaigns = async (req, res) => {
    try {

        logger.info(`Récupération des données pour les campagnes`);

        // Construire l'URL de l'API pour récupérer toutes les campagnes
        const apiUrl = apiBuilder.buildApiUrl('campaigns', {
            campaignStatusId: '3'
        });
        if (!apiUrl) {
            throw new Error('URL de l\'API introuvable.');
        }

        // Utilisation de la fonction utilitaire pour faire la requête GET avec retry
        const dataCampaigns = await makeApiRequest('GET', apiUrl);

        // Vérification si les données existent
        if (!dataCampaigns) {
            throw new Error('Données de campagne non trouvées');
        }

        // Boucle sur toutes les campagnes pour gérer chaque campagne
        for (const dataCampaign of dataCampaigns) {
            try {
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
                    logger.info(`Aucune agence associée ou agencyId invalide pour la campagne : ${dataCampaign.id}`);
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
                    campaign_id: dataCampaign.id
                });
                const dataInsertions = await makeApiRequest('GET', apiUrlInsertions);

                if (dataInsertions) {
                    for (const insertion of dataInsertions) {
                        const insertionData = mapApiFieldsToDb(insertion, insertionFieldMapping);
                        await upsertEntity(ModelInsertions, insertionData, 'insertion_id');
                    }
                }

                logger.info(`Campagne ${dataCampaign.id} récupérée et sauvegardée avec succès`);

            } catch (innerError) {
                // Gérer les erreurs spécifiques à une campagne particulière sans interrompre tout le processus
                logger.error(`Erreur lors de la récupération des données pour la campagne ${dataCampaign.id} : ${innerError.message}`);
            }
        }

        // Envoyer les données en réponse
        return res.status(200).json({
            message: 'Toutes les campagnes ont été récupérées et sauvegardées avec succès'
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

exports.agency = async (req, res) => {
    const agencyid = req.params.agencyid;
    try {
        logger.info(`Récupération des données pour annonceur : ${agencyid}`);

        const apiUrl = apiBuilder.buildApiUrl('agencies', {
            agency_id: agencyid
        });
        if (!apiUrl) {
            throw new Error('URL de l\'API introuvable.');
        }

        // Utilisation de la fonction utilitaire pour faire la requête GET avec retry
        const data = await makeApiRequest('GET', apiUrl);

        // Vérification si les données existent
        if (!data || !data.id) {
            throw new Error('Données agence non trouvées');
        }

        // Mapper les données de campagne et d'insertion
        const agencyData = mapApiFieldsToDb(data, agencyFieldMapping);
        await upsertEntity(ModelAgencies, agencyData, 'agency_id');

        // Envoyer les données en réponse
        return res.status(200).json({
            message: 'Agence récupérée et sauvegardée avec succès',
            agency: agencyData,
            agencyData: data
        });

    } catch (error) {
        logger.error(`Erreur lors de la récupération des données : ${error.message}`);
        return Utilities.handleCampaignNotFound(res, 500, `Erreur lors de la récupération des données`, 'json');
    }
};

exports.reporting = async (req, res) => {
    try {

        const dateNow = new Date();
        const dateNowMysql = format(dateNow, 'yyyy-MM-dd');
        const advertisersExclus = [
            320778, 409707, 411820, 412328, 414097, 417243, 417716, 418935,
            421871, 425912, 425914, 427952, 438979, 439470, 439506, 439511,
            439512, 439513, 439514, 439515, 440117, 440118, 440121, 440122,
            440124, 440126, 445117, 455371, 455384, 459132, 464862, 471802, 497328, 508227, 416446,417243
          ];
        const campaigns = await ModelCampaigns.findAll({
            where: {
                campaign_end_date: {
                    [Op.gt]: dateNowMysql + ' 23:59:00'
                },
                advertiser_id: {
                    [Op.notIn]: advertisersExclus
                }
            },
            order: sequelize.literal('RAND()') // Ordre aléatoire
        });

        if (campaigns.length === 0) {
            logger.error("Aucune campagne trouvée avec une date de fin après " + dateNowMysql + " 23:59:00");
            return res.status(404).json({ message: "Aucune campagne trouvée" });
        }

        for (const campaign of campaigns) {
            console.log("Nom de la campagne :", campaign.campaign_name, " | Annonceur : ", campaign.advertiser_id);

             // Gestion des dates avec date-fns
                const dateNow = new Date();
                const campaignDates = {
                now: dateNow,
                start: parseISO(campaign.campaign_start_date),
                end: parseISO(campaign.campaign_end_date),
                duration: differenceInDays(parseISO(campaign.campaign_end_date), parseISO(campaign.campaign_start_date)),
                formatted_start_date: format(parseISO(campaign.campaign_start_date), 'dd/MM/yyyy', {
                    locale: frLocale
                }),
                formatted_end_date: format(parseISO(campaign.campaign_end_date), 'dd/MM/yyyy', {
                    locale: frLocale
                }),
                remainingDays: differenceInDays(parseISO(campaign.campaign_end_date), dateNow),
                daysBeforeStart: differenceInDays(parseISO(campaign.campaign_start_date), dateNow),
                };

            let campaignId = campaign.campaign_id;
            let cachedCampaignId = getCampaignId(campaignId);

            if (!cachedCampaignId) {
                let cachedReportIds = getReportIds(campaignId);

                if (!cachedReportIds) {
                    const reportId = await ReportService.fetchReportId(campaignDates.request_start_date, campaignDates.request_start_end, campaignId);
                    if (!reportId) {
                        logger.error(`Erreur: reportId non attribué pour la campagne ID: ${campaignId}`);
                        continue;
                    }

                    let reportIdVU = "";
                    if ((campaignDates.duration <= 31) && (campaignDates.daysBeforeStart >= -40) && (campaignDates.daysBeforeStart < 0)) {
                        reportIdVU = await ReportService.fetchReportId(campaignDates.request_start_date, campaignDates.request_start_end, campaignId, true);
                        if (!reportIdVU) {
                            logger.error(`Erreur: reportIdVU non attribué pour la campagne ID: ${campaignId}`);
                            continue;
                        }
                    }

                    setReportIdsWithExpiry(campaignId, reportId, reportIdVU);
                    cachedReportIds = { reportId, reportIdVU };
                }

                let cachedInstanceIds = getInstanceIds(campaignId);
                if (!cachedInstanceIds) {
                    const instanceIdData = await ReportService.fetchReportDetails(cachedReportIds.reportId);
                    const instanceIdVUData = cachedReportIds.reportIdVU ? await ReportService.fetchReportDetails(cachedReportIds.reportIdVU) : null;

                    const instanceId = await ReportService.fetchCsvData(instanceIdData);
                    let instanceIdVU = instanceIdVUData ? await ReportService.fetchCsvData(instanceIdVUData) : null;

                    setInstanceIdsWithExpiry(campaignId, instanceId, instanceIdVU);
                    cachedInstanceIds = { campaignId, instanceId, instanceIdVU };
                }

                const result = await ReportBuildJson(campaignId, cachedInstanceIds.instanceId, cachedInstanceIds.instanceIdVU);
                logger.info(`Affiche le résultat du rapport json de la campagne ${campaignId}`);
                return res.json(result);
            }
        }
    } catch (error) {
        logger.error(`Erreur lors de l'automatisation du reporting : ${error.message}`);
        return Utilities.handleCampaignNotFound(res, 500, "Erreur lors de la récupération des données", 'json');
    }
};