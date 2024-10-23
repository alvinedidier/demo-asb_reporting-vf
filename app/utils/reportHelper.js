const csv = require('csv-parser'); // Importation de csv-parser
const { Readable } = require('stream'); // Nécessaire pour créer un stream à partir d'une chaîne de caractères
const { format, addHours } = require('date-fns');
const { setCampaignIdWithExpiry } = require('./localStorageHelper'); // Import des fonctions localStorage
const logger = require('../utils/logger');
const ModelAdvertisers = require('../models/models.advertisers');
const ModelCampaigns = require('../models/models.campaigns');

// Tableau des formats
const formats = [
    { name: 'habillage', title: 'HABILLAGE' },
    { name: 'interstitiel', title: 'INTERSTITIEL' },
    { name: 'interstitielvideo', title: 'INTERSTITIEL VIDEO' },
    { name: 'instream', title: 'INSTREAM' },
    { name: 'masthead', title: 'MASTHEAD' },
    { name: 'grandangle', title: 'GRAND ANGLE' },
    { name: 'rectanglevideo', title: 'RECTANGLE VIDEO' },
    { name: 'rectangle', title: 'RECTANGLE' },
    { name: 'logo', title: 'LOGO' },
    { name: 'native', title: 'NATIVE' },
    { name: 'slider', title: 'SLIDER' },
    { name: 'mea', title: 'MEA' },
    { name: 'slidervideo', title: 'SLIDER VIDEO' },
    { name: 'clickcommand', title: 'CLICK COMMAND' },
    { name: 'footer', title: 'FOOTER' },
    { name: 'inread', title: 'INREAD' },
    { name: 'inreadvideo', title: 'INREAD VIDEO' }
];

// Fonction pour créer un stream à partir d'une chaîne de caractères
function stringToStream(text) {
    const stream = new Readable();
    stream.push(text);
    stream.push(null); // Signale la fin des données
    return stream;
}

// Fonction pour analyser une chaîne de caractères CSV avec csv-parser
function parseCsvString(csvString) {
    return new Promise((resolve, reject) => {
        const results = [];
        const stream = stringToStream(csvString); // Créer un stream à partir de la chaîne
        stream
            .pipe(csv({ separator: ';', headers: true })) // Traiter le CSV avec les entêtes
            .on('data', (row) => results.push(row)) // Ajouter chaque ligne analysée
            .on('end', () => resolve(results)) // Résoudre la promesse quand c'est terminé
            .on('error', (err) => reject(err)); // Rejeter en cas d'erreur
    });
}

// Fonction pour calculer le CTR
function calculateCtr(clicks, impressions) {
    return impressions > 0 ? (clicks / impressions * 100).toFixed(2) : "0.00";
}

// Fonction pour construire la structure des données pour chaque format
function buildFormatData(csvData, formatName) {
    let siteList = {};
    let formatData = {
        Impressions: 0,
        Clicks: 0,
        VideoComplete: 0 // Ajout pour compter les complétions totales
    };

    csvData.forEach((row, index) => {
        const site = row.AppOrSiteName;
        console.log("Site : " + site); process.exit(0);
        const impressions = parseInt(row.Impressions) || 0;
        const clicks = parseInt(row.Clics) || 0;
        const complete = parseInt(row.VideoComplete) || 0;
        const format = row.FormatName.toLowerCase();

        // Vérifier si le format correspond au format en cours d'analyse
        if (format === formatName.toLowerCase()) {
            const ctr = calculateCtr(clicks, impressions);
            const ctrComplete = calculateCtr(complete, impressions); // Calcul du CTR complet

            siteList[index] = {
                site,
                impressions,
                clicks,
                ctr,
                complete,
                ctrComplete // Ajouter le CTR complet pour chaque site
            };

            // Accumuler les valeurs pour le format
            formatData.Impressions += impressions;
            formatData.Clicks += clicks;
            formatData.VideoComplete += complete; // Additionner les complétions
        }
    });

    return {
        siteList,
        formatData
    };
}

// Fonction principale pour construire le JSON final
async function ReportBuildJson(campaignId, csvData1String, csvData2String) {
    try {
        // Récupération des informations de la campagne depuis la base de données
        const campaign = await ModelCampaigns.findOne({
            attributes: [
                'campaign_id',
                'campaign_name',
                'campaign_crypt',
                'advertiser_id',
                'campaign_start_date',
                'campaign_end_date',
            ],
            where: { campaign_id: campaignId },
            include: [{ model: ModelAdvertisers }]
        });

        if (!campaign) {
            throw new Error(`La campagne avec l'ID ${campaignId} n'existe pas.`);
        }

        // Conversion des chaînes CSV en objets
        const parsedCsv1 = await parseCsvString(csvData1String);
        const parsedCsv2 = await parseCsvString(csvData2String);
        buildFormatData(parsedCsv1, "title")
        process.exit(0);
        let result = {};

        // Traiter chaque format de manière dynamique
        formats.forEach(format => {
            console.log(format.name);

            /*const { siteList, formatData } = buildFormatData(parsedCsv1, format.name);

            // Vérifier si le format a soit des impressions, soit des clics avant de l'ajouter au résultat
            if (formatData.Impressions > 0 || formatData.Clicks > 0) {
                result[format.name.toLowerCase()] = {
                    siteList,
                    impressions: formatData.Impressions,
                    clicks: formatData.Clicks,
                    ctr: calculateCtr(formatData.Clicks, formatData.Impressions),
                    complete: formatData.VideoComplete,
                    ctrComplete: calculateCtr(formatData.VideoComplete, formatData.Impressions)
                };
            }*/
        });

        let vu = '';
        if (parsedCsv2 && parsedCsv2.length > 0) {
            const vuData = parsedCsv2[0];
            vu = parseInt(vuData['UniqueVisitors']) || 0; // Ajoutez une valeur par défaut pour éviter les erreurs
        }

        // Calcul de la répétition : impressions_totales / visiteurs_uniques
        const totalImpressions = Object.values(result).reduce((sum, format) => sum + format.impressions, 0);
        const repetition = (vu > 0) ? (totalImpressions / vu).toFixed(2) : "0.00";

        // Calcul des dates
        const reportingStartDate = format(new Date(), "yyyy-MM-dd HH:mm:ss");
        const reportingEndDate = format(addHours(new Date(), 2), "yyyy-MM-dd HH:mm:ss");

        // Ajouter les informations générales de la campagne
        result.campaign = {
            campaign_id: campaign.campaign_id,
            campaign_name: campaign.campaign_name,
            campaign_start_date: campaign.campaign_start_date,
            campaign_end_date: campaign.campaign_end_date,
            campaign_crypt: campaign.campaign_crypt,
            advertiser_id: campaign.advertiser_id,
            advertiser_name: campaign.advertiser_name,
            impressions: totalImpressions,
            clicks: Object.values(result).reduce((sum, format) => sum + format.clicks, 0),
            ctr: calculateCtr(
                Object.values(result).reduce((sum, format) => sum + format.clicks, 0),
                totalImpressions
            ),
            complete: 0,
            ctrComplete: "0.00",
            vu,
            repetition
        };

        result.reporting_start_date = reportingStartDate;
        result.reporting_end_date = reportingEndDate;

        // Sauvegarde du rapport JSON dans localStorage avec expiration (2 heures par défaut)
        setCampaignIdWithExpiry(campaignId, result);

        logger.info(`Rapport JSON pour la campagne ${campaignId} sauvegardé dans localStorage.`);

        return result;
    } catch (error) {
        logger.error('Erreur lors de la génération du rapport :', error.message);
        throw error;
    }
}

// Exportation de la fonction pour réutilisation
module.exports = {
    ReportBuildJson
};
