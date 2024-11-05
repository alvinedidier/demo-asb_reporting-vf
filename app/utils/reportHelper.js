const csv = require('csv-parser'); // Importation de csv-parser
const {
    Readable
} = require('stream'); // Nécessaire pour créer un stream à partir d'une chaîne de caractères

const {
    setCampaignIdWithExpiry
} = require('./localStorageHelper'); // Import des fonctions localStorage

const {
    differenceInDays,
    isAfter,
    isBefore,
    parseISO,
    format,
    addHours
  } = require('date-fns');
  const {
    fr: frLocale
  } = require('date-fns/locale');
  
const logger = require('../utils/logger');
const ModelAdvertisers = require('../models/models.advertisers');
const ModelCampaigns = require('../models/models.campaigns');

// Tableau des formats
const formats = [{
        name: 'habillage',
        title: 'HABILLAGE'
    },
    {
        name: 'interstitiel',
        title: 'INTERSTITIEL'
    },
    {
        name: 'interstitielvideo',
        title: 'INTERSTITIEL VIDEO'
    },
    {
        name: 'instream',
        title: 'INSTREAM'
    },
    {
        name: 'masthead',
        title: 'MASTHEAD'
    },
    {
        name: 'grandangle',
        title: 'GRAND ANGLE'
    },
    {
        name: 'rectanglevideo',
        title: 'RECTANGLE VIDEO'
    },
    {
        name: 'rectangle',
        title: 'RECTANGLE'
    },
    {
        name: 'pave',
        title: 'PAVE'
    },
    {
        name: 'pavevideo',
        title: 'PAVE VIDEO'
    },
    {
        name: 'logo',
        title: 'LOGO'
    },
    {
        name: 'native',
        title: 'NATIVE'
    },
    {
        name: 'slider',
        title: 'SLIDER'
    },
    {
        name: 'mea',
        title: 'MEA'
    },
    {
        name: 'slidervideo',
        title: 'SLIDER VIDEO'
    },
    {
        name: 'clickcommand',
        title: 'CLICK COMMAND'
    },
    {
        name: 'footer',
        title: 'FOOTER'
    },
    {
        name: 'inread',
        title: 'INREAD'
    },
    {
        name: 'inreadvideo',
        title: 'INREAD VIDEO'
    },
    {
        name: 'billboard',
        title: 'BILLBOARD'
    },
 {
        name: 'preroll',
        title: 'INSTREAM'
    },
    {
        name: 'preroll / midroll',
        title: 'INSTREAM'
    }
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
            .pipe(csv({
                separator: ';',
                headers: true
            })) // Traiter le CSV avec les entêtes
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
    // Structure des données groupées
    let groupedInsertions = {};

    formats.forEach((format) => {
        const regex = new RegExp(format.title, 'i');
        if (regex.test(insertionName)) {
            if (!groupedInsertions[format.title]) {
                groupedInsertions[format.title] = [];
            }
            groupedInsertions[format.title].push(row);
        }
    });

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
            where: {
                campaign_id: campaignId
            },
            include: [{
                model: ModelAdvertisers
            }]
        });

        if (!campaign) {
            throw new Error(`La campagne avec l'ID ${campaignId} n'existe pas.`);
        }

        // Conversion des chaînes CSV en objets
        const parsedCsv1 = await parseCsvString(csvData1String);
        const parsedCsv2 = await parseCsvString(csvData2String);

        // Calcul des métriques globales
        const globalMetrics = calculateGlobalMetrics(parsedCsv1, parsedCsv2);

        // Calcul des métriques par format, créative et site
        const metricsByFormat = regrouperParFormat(parsedCsv1);
        const metricsByCreatives = regrouperParCreatives(parsedCsv1);
        const metricsBySite = regrouperParSite(parsedCsv1);
        const metricsByFormatAndSite = regrouperParFormatEtSiteAvecMetrics(parsedCsv1);

        // Structure du rapport JSON final
        const report = {
                campaign_id: campaign.campaign_id,
                campaign_name: campaign.campaign_name,
                campaign_crypt: campaign.campaign_crypt,
                advertiser_id: campaign.advertiser_id,
                advertiser_name: campaign.advertiser.advertiser_name ? campaign.advertiser.advertiser_name : 'N/A',
                campaign_start_date: campaign.campaign_start_date,
                campaign_end_date: campaign.campaign_end_date,
                campaign_start_date_formatted: format(parseISO(campaign.campaign_start_date), 'dd/MM/yyyy', {
                    locale: frLocale
                }),
                campaign_end_date_formatted: format(parseISO(campaign.campaign_end_date), 'dd/MM/yyyy', {
                    locale: frLocale
                }),
                campaign_duration: differenceInDays(parseISO(campaign.campaign_end_date), parseISO(campaign.campaign_start_date)),
                globalMetrics,
                metrics: {
                    byFormat: metricsByFormat,
                    bySite: metricsBySite,
                    byFormatAndSite: metricsByFormatAndSite,
                    byCreatives: metricsByCreatives
                },
                reporting_dates: {
                    reporting_start_date: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
                    reporting_end_date: format(addHours(new Date(), 2), "yyyy-MM-dd HH:mm:ss")
                }
        };

        // Sauvegarde du rapport JSON dans localStorage avec expiration
        setCampaignIdWithExpiry(campaignId, report);
        console.log("report : ",report)

        logger.info(`Rapport JSON pour la campagne ${campaignId} sauvegardé dans localStorage.`);

        return report;
    } catch (error) {
        logger.error('Erreur lors de la génération du rapport :', error.message);
        throw error;
    }
}

// Calcule les métriques globales 
function calculateGlobalMetrics(data, dataVU) {
    let totalImpressions = 0;
    let totalClics = 0;
    let totalVideoComplete = 0;
    let uniqueVisitors = 0;

    // Parcourir les lignes de données (ignorer la première ligne qui contient les noms de colonnes)
    data.slice(1).forEach(row => {
        // Convertir les valeurs en nombre, en vérifiant qu'elles existent et sont valides
        const impressions = parseInt(row._11, 10) || 0;
        const clics = parseInt(row._12, 10) || 0;
        const videoComplete = parseInt(row._14, 10) || 0;

        totalImpressions += impressions;
        totalClics += clics;
        totalVideoComplete += videoComplete;
    });

    // Vérifier que dataVU est fourni et contient une valeur pour UniqueVisitors
    if (dataVU && dataVU.length > 1) {
        const vuData = dataVU[1];
        uniqueVisitors = parseInt(vuData['_8'], 10) || 0; // Assure que la valeur est un nombre valide
    }

    // Calcul des métriques globales
    const ctrGlobal = totalImpressions > 0 ? (totalClics / totalImpressions * 100).toFixed(2) : 0;
    const completionRateGlobal = totalImpressions > 0 ? (totalVideoComplete / totalImpressions * 100).toFixed(2) : 0;

    // Calcul de la répétition : impressions_totales / visiteurs_uniques
    const repetition = uniqueVisitors > 0 ? (totalImpressions / uniqueVisitors).toFixed(2) : "0.00";

    return {
        totalImpressions,
        totalClics,
        ctrGlobal,
        totalVideoComplete,
        completionRateGlobal,
        uniqueVisitors,
        repetition
    };
}

// Calcule les métriques globales par formats et sites
/*
function groupMetricsByFormatAndSite(data) {
    const result = {};

    // Parcourir les lignes de données (ignorer la première ligne qui contient les noms de colonnes)
    data.slice(1).forEach(row => {
        const formatName = row._7; // Nom du format
        let siteName = row._9; // Nom de l'application ou du site

        // Normalisation du nom du site pour regrouper SM_LINFO-IOS et SM_LINFO-ANDROID sous SM_LINFO-APPLI
        if (siteName === 'SM_LINFO-IOS' || siteName === 'SM_LINFO-ANDROID') {
            siteName = 'SM_LINFO-APPLI';
        }

        const impressions = parseInt(row._11, 10) || 0; // Nombre d'impressions
        const clics = parseInt(row._12, 10) || 0; // Nombre de clics
        const videoComplete = parseInt(row._14, 10) || 0; // Nombre de vidéos complètes

        // Vérifier si le format existe déjà dans le résultat, sinon l'initialiser
        if (!result[formatName]) {
            result[formatName] = {};
        }

        // Vérifier si le site existe déjà sous le format, sinon l'initialiser
        if (!result[formatName][siteName]) {
            result[formatName][siteName] = {
                impressions: 0,
                clics: 0,
                ctr: 0,
                videoComplete: 0,
                vtr: 0
            };
        }

        // Ajouter les impressions, clics et vidéos complètes au site sous ce format
        result[formatName][siteName].impressions += impressions;
        result[formatName][siteName].clics += clics;
        result[formatName][siteName].videoComplete += videoComplete;
    });

    // Calculer le CTR et le VTR pour chaque format et site
    for (const format in result) {
        for (const site in result[format]) {
            const data = result[format][site];
            data.ctr = data.impressions > 0 ? data.clics / data.impressions : 0;
            data.vtr = data.impressions > 0 ? data.videoComplete / data.impressions : 0;
        }
    }

    return result;
}
*/
// Calcule les métriques globales par formats et sites
function groupMetricsByFormatAndSite(data) {
    const result = {};

    // Parcourir les lignes de données (ignorer la première ligne qui contient les noms de colonnes)
    data.slice(1).forEach(row => {
        const formatName = row._7; // Nom du format
        let siteName = row._9; // Nom de l'application ou du site

        // Normalisation du nom du site pour regrouper SM_LINFO-IOS et SM_LINFO-ANDROID sous SM_LINFO-APPLI
        if (siteName === 'SM_LINFO-IOS' || siteName === 'SM_LINFO-ANDROID') {
            siteName = 'SM_LINFO-APPLI';
        }

        const impressions = parseInt(row._11, 10) || 0; // Nombre d'impressions
        const clics = parseInt(row._12, 10) || 0; // Nombre de clics
        const videoComplete = parseInt(row._14, 10) || 0; // Nombre de vidéos complètes

        // Vérifier si le format existe déjà dans le résultat, sinon l'initialiser
        if (!result[formatName]) {
            result[formatName] = {};
        }

        // Vérifier si le site existe déjà sous le format, sinon l'initialiser
        if (!result[formatName][siteName]) {
            result[formatName][siteName] = {
                impressions: 0,
                clics: 0,
                videoComplete: 0,
                ctr: 0,
                vtr: 0
            };
        }

        // Ajouter les impressions, clics et vidéos complètes au site sous ce format
        result[formatName][siteName].impressions += impressions;
        result[formatName][siteName].clics += clics;
        result[formatName][siteName].videoComplete += videoComplete;
    });

    // Calculer le CTR et le VTR pour chaque format et site
    for (const format in result) {
        for (const site in result[format]) {
            const siteMetrics = result[format][site];
            siteMetrics.ctr = siteMetrics.impressions > 0 ? (siteMetrics.clics / siteMetrics.impressions).toFixed(4) : "0.00";
            siteMetrics.vtr = siteMetrics.impressions > 0 ? (siteMetrics.videoComplete / siteMetrics.impressions).toFixed(4) : "0.00";
        }
    }

    // Trier les formats par ordre alphabétique
    const sortedResult = Object.keys(result)
        .sort() // Trie les formats par ordre alphabétique
        .reduce((acc, key) => {
            acc[key] = result[key];
            return acc;
        }, {});

    return sortedResult;
}
/*
// Fonction mise à jour pour regrouper et calculer les métriques par format et site avec parseCsv1
function regrouperParFormatEtSiteAvecMetrics(results) {
    const resultat = {};

    results.forEach(row => {
        // Extraire les valeurs nécessaires
        const insertionName = row._5 || '';
        const siteName = row._9 || '';
        const impressions = parseInt(row._11, 10) || 0;
        const clics = parseInt(row._12, 10) || 0;
        const videoComplete = parseInt(row._14, 10) || 0;

        // Trouver le format correspondant en fonction du libellé d'insertion
        const formatTrouve = formats.find(format =>
            insertionName.toUpperCase().includes(format.title)
        );

        if (formatTrouve) {
            // Initialiser le site et le format dans le résultat s'ils n'existent pas
            if (!resultat[siteName]) {
                resultat[siteName] = {};
            }
            if (!resultat[siteName][formatTrouve.name]) {
                resultat[siteName][formatTrouve.name] = {
                    impressions: 0,
                    clics: 0,
                    completions: 0,
                    ctr: 0,
                    vtr: 0
                };
            }

            // Ajouter les valeurs au format et au site appropriés
            const data = resultat[siteName][formatTrouve.name];
            data.impressions += impressions;
            data.clics += clics;
            data.completions += videoComplete;
        } else {
            console.warn('Format non trouvé pour insertion:', insertionName);
        }
    });

    // Calcul des CTR et VTR pour chaque format et site
    for (const site in resultat) {
        for (const format in resultat[site]) {
            const data = resultat[site][format];
            data.ctr = data.impressions > 0 ? (data.clics / data.impressions * 100).toFixed(2) : "0.00";
            data.vtr = data.impressions > 0 ? (data.completions / data.impressions * 100).toFixed(2) : "0.00";
        }
    }

    return resultat;
}

*/

// Fonction mise à jour pour regrouper et calculer les métriques par format et site
function regrouperParFormatEtSiteAvecMetrics(results) {
    const resultat = {};

    results.forEach(row => {
        // Extraire les valeurs nécessaires
        const insertionName = row._5 || '';
        let siteName = row._9 || '';
        const impressions = parseInt(row._11, 10) || 0;
        const clics = parseInt(row._12, 10) || 0;
        const videoComplete = parseInt(row._14, 10) || 0;

        // Trouver le format correspondant en fonction du libellé d'insertion
        const formatTrouve = formats.find(format =>
            insertionName.toUpperCase().includes(format.title)
        );

        if (formatTrouve) {
            // Normalisation du nom du site pour regrouper SM_LINFO-IOS et SM_LINFO-ANDROID sous SM_LINFO-APPLI
            if (siteName === 'SM_LINFO-IOS' || siteName === 'SM_LINFO-ANDROID') {
                siteName = 'SM_LINFO-APPLI';
            }

            // Initialiser le format dans le résultat s'il n'existe pas
            if (!resultat[formatTrouve.title]) {
                resultat[formatTrouve.title] = {};
            }

            // Initialiser le site sous le format dans le résultat s'il n'existe pas
            if (!resultat[formatTrouve.title][siteName]) {
                resultat[formatTrouve.title][siteName] = {
                    impressions: 0,
                    clics: 0,
                    completions: 0,
                    ctr: 0,
                    vtr: 0
                };
            }

            // Ajouter les valeurs au site sous le format approprié
            const data = resultat[formatTrouve.title][siteName];
            data.impressions += impressions;
            data.clics += clics;
            data.completions += videoComplete;
        } else {
            console.warn('Format non trouvé pour insertion:', insertionName);
        }
    });

    // Calcul des CTR et VTR pour chaque format et site
    for (const format in resultat) {
        for (const site in resultat[format]) {
            const data = resultat[format][site];
            data.ctr = data.impressions > 0 ? (data.clics / data.impressions * 100).toFixed(2) : "0.00";
            data.vtr = data.impressions > 0 ? (data.completions / data.impressions * 100).toFixed(2) : "0.00";
        }
    }

    return resultat;
}

// Fonction pour regrouper et calculer les métriques uniquement par format
function regrouperParFormat(data) {
    const resultat = {};

    data.slice(1).forEach(row => {
        // Vérifier que les valeurs nécessaires existent
        if (!row || !row._5 || !row._11 || !row._12 || !row._14) {
            console.warn("Ligne invalide ou données manquantes:", row);
            return;
        }

        // Extraire les valeurs
        const insertionName = row._5 || '';
        const impressions = parseInt(row._11, 10) || 0;
        const clics = parseInt(row._12, 10) || 0;
        const videoComplete = parseInt(row._14, 10) || 0;
    
        // Trouver le format correspondant en fonction du libellé d'insertion
        const formatTrouve = formats.find(format =>
            insertionName.toUpperCase().includes(format.title)
        );

        if (formatTrouve) {
            // Initialiser le format dans le résultat s'il n'existe pas encore
            if (!resultat[formatTrouve.title]) {
                resultat[formatTrouve.title] = {
                    impressions: 0,
                    clics: 0,
                    completions: 0,
                    ctr: 0,
                    vtr: 0
                };
            }

            // Ajouter les valeurs au format approprié
            const result = resultat[formatTrouve.title];
            result.impressions += impressions;
            result.clics += clics;
            result.completions += videoComplete;
        } else {
            console.log('Format non trouvé pour insertion -- insertionName : ', row);
            console.warn('Format non trouvé pour insertion:', insertionName);
        }
    });

    // Calcul des CTR et VTR pour chaque format
    for (const format in resultat) {
        const result = resultat[format];
        result.ctr = result.impressions > 0 ? (result.clics / result.impressions * 100).toFixed(2) : "0.00";
        result.vtr = result.impressions > 0 ? (result.completions / result.impressions * 100).toFixed(2) : "0.00";
    }

    return resultat;
}

// Fonction pour regrouper et calculer les métriques par créative
function regrouperParCreatives(data) {
    const resultat = {};

    // Parcourir les lignes de données (ignorer la première ligne qui contient les noms de colonnes)
    data.slice(1).forEach(row => {
        // Extraire les valeurs nécessaires pour chaque créative
        const creativeName = row._10 || '';
        const impressions = parseInt(row._11, 10) || 0;
        const clics = parseInt(row._12, 10) || 0;
        const videoComplete = parseInt(row._14, 10) || 0;

        // Initialiser la créative dans le résultat si elle n'existe pas encore
        if (!resultat[creativeName]) {
            resultat[creativeName] = {
                impressions: 0,
                clics: 0,
                completions: 0,
                ctr: 0,
                vtr: 0
            };
        }

        // Ajouter les valeurs aux totaux de la créative
        const creativeMetrics = resultat[creativeName];
        creativeMetrics.impressions += impressions;
        creativeMetrics.clics += clics;
        creativeMetrics.completions += videoComplete;
    });

    // Calcul des CTR et VTR pour chaque créative
    for (const creative in resultat) {
        const metrics = resultat[creative];
        metrics.ctr = metrics.impressions > 0 ? (metrics.clics / metrics.impressions * 100).toFixed(2) : "0.00";
        metrics.vtr = metrics.impressions > 0 ? (metrics.completions / metrics.impressions * 100).toFixed(2) : "0.00";
    }

    return resultat;
}

// Fonction pour regrouper et calculer les métriques par site
function regrouperParSite(data) {
    const resultat = {};

    // Parcourir les lignes de données (ignorer la première ligne qui contient les noms de colonnes)
    data.slice(1).forEach(row => {
        // Extraire les valeurs nécessaires pour chaque site
        let siteName = row._9 || ''; // Nom du site
        const impressions = parseInt(row._11, 10) || 0;
        const clics = parseInt(row._12, 10) || 0;
        const videoComplete = parseInt(row._14, 10) || 0;

        // Regrouper SM_LINFO-ANDROID et SM_LINFO-IOS sous SM_LINFO-APPLI
        if (siteName === 'SM_LINFO-ANDROID' || siteName === 'SM_LINFO-IOS') {
            siteName = 'SM_LINFO-APPLI';
        }

        // Initialiser le site dans le résultat s'il n'existe pas encore
        if (!resultat[siteName]) {
            resultat[siteName] = {
                impressions: 0,
                clics: 0,
                completions: 0,
                ctr: 0,
                vtr: 0
            };
        }

        // Ajouter les valeurs aux totaux du site
        const siteMetrics = resultat[siteName];
        siteMetrics.impressions += impressions;
        siteMetrics.clics += clics;
        siteMetrics.completions += videoComplete;
    });

    // Calcul des CTR et VTR pour chaque site
    for (const site in resultat) {
        const metrics = resultat[site];
        metrics.ctr = metrics.impressions > 0 ? (metrics.clics / metrics.impressions * 100).toFixed(2) : "0.00";
        metrics.vtr = metrics.impressions > 0 ? (metrics.completions / metrics.impressions * 100).toFixed(2) : "0.00";
    }

    // Trier les résultats par ordre alphabétique des noms de sites
    let resultatTrie = Object.keys(resultat)
        .sort() // Trie les clés alphabétiquement
        .reduce((obj, key) => {
            obj[key] = resultat[key];
            return obj;
        }, {});

    return resultatTrie;
}

// Exportation de la fonction pour réutilisation
module.exports = {
    ReportBuildJson
};