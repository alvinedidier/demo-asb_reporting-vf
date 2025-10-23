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
        name: 'grandangle-pave',
        title: 'GRAND ANGLE - PAVE'
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
        name: 'pavevideo',
        title: 'PAVE VIDEO'
    },
    {
        name: 'pave',
        title: 'PAVE'
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
        name: 'instream',
        title: 'PREROLL'
    },
    {
        name: 'instream',
        title: 'PREROLL / MIDROLL'
    }
];

// Fonction pour créer un stream à partir d'une chaîne de caractères
function stringToStream(text) {
    const stream = new Readable();
    stream.push(text);
    stream.push(null); // Signale la fin des données
    return stream;
}

/**
 * Vérifie et nettoie un objet JSON avant de l’envoyer
 * - Supprime les caractères invisibles (\r, \n, BOM, etc.)
 * - Vérifie que les nombres sont valides
 * - Vérifie que les strings n’ont pas de guillemets non échappés
 */
function validateJsonObject(obj, path = "") {
    const errors = [];

    function checkValue(value, keyPath) {
        if (value === null || value === undefined) return;

        if (typeof value === "string") {
            // Nettoyage de base
            const clean = value.replace(/[\r\n\t]/g, "").trim();

            // Vérifie si guillemets non échappés
            if (/["']{2,}/.test(clean)) {
                errors.push(`⚠️ Chaîne suspecte à ${keyPath}: "${clean}"`);
            }

            // Vérifie si pourcentage ou virgule numérique
            if (/^\d+,\d+%?$/.test(clean)) {
                errors.push(`⚠️ Nombre avec virgule trouvé à ${keyPath}: "${clean}" (utilise un point)`);
            }
        } else if (typeof value === "number") {
            if (Number.isNaN(value)) {
                errors.push(`⚠️ NaN détecté à ${keyPath}`);
            }
        } else if (typeof value === "object") {
            for (const [k, v] of Object.entries(value)) {
                checkValue(v, `${keyPath}.${k}`);
            }
        }
    }

    checkValue(obj, path || "root");

    return errors;
}


// Fonction pour analyser une chaîne de caractères CSV avec csv-parser
function parseCsvString(csvString) {
    return new Promise((resolve, reject) => {
        const results = [];
        const stream = stringToStream(csvString); // Créer un stream à partir de la chaîne
        stream
            .pipe(csv({
                separator: ';',
                headers: true,
                skipEmptyLines: true, // ⚡ ignore les lignes vides
                mapValues: ({
                    header,
                    index,
                    value
                }) => {
                    if (!value) return null;

                    // Trim & nettoyer
                    let clean = value.toString().trim().replace(/\r|\n/g, "");

                    // Si c'est un nombre formaté "123,45" -> convertis en "123.45"
                    if (/^-?\d+,\d+$/.test(clean)) {
                        clean = clean.replace(',', '.');
                    }

                    // Si c'est un pourcentage -> garde en string normalisée
                    if (clean.endsWith('%')) {
                        return clean.replace(',', '.'); // "12,3%" => "12.3%"
                    }

                    return clean;
                }
            }))
            .on('data', (row) => results.push(row))
            .on('end', () => resolve(results))
            .on('error', (err) => reject(err));
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

/**
 * Génère un rapport JSON valide à partir des données de campagne et des instances.
 * @param {number} campaignId - ID de la campagne.
 * @param {object} instanceData - Données de l'instance principale.
 * @param {object|null} instanceVUData - Données de l'instance VU (optionnel).
 * @returns {Promise<object>} - Rapport JSON validé.
 */
const ReportBuildJson = async (campaignId, instanceData, instanceVUData) => {
  try {
    logger.info(`ReportBuildJson appelé avec : campaignId=${campaignId}, instanceId=${instanceData}, instanceIdVU=${instanceVUData}`);

    // 1. Valider les entrées
    if (!instanceData) {
      throw new Error(`instanceData manquante pour la campagne ${campaignId}`);
    }

    console.log(`Instance Data: ${JSON.stringify(instanceData)}`);
    console.log(`Instance advertiser_name: ${instanceData.advertiser_name}`);

    // 2. Structurer les données avec des valeurs par défaut
    const reportingData = {
      advertiser_name: instanceData.advertiser_name || '',
      campaign_name: instanceData.campaign_name || '',
      campaign_start_date_formatted: instanceData.start_date || '',
      campaign_end_date_formatted: instanceData.end_date || '',
      reporting_dates: {
        reporting_start_date: new Date(),
        reporting_end_date: new Date(),
      },
      globalMetrics: {
        totalImpressions: instanceData.impressions || 0,
        totalClics: instanceData.clics || 0,
        ctrGlobal: instanceData.ctr ? `${instanceData.ctr.toString().replace('.', ',')}%` : '0%',
        uniqueVisitors: instanceData.uniqueVisitors || 0,
        repetition: instanceData.repetition ? instanceData.repetition.toString().replace('.', ',') : '0',
      },
      metrics: {
        byFormat: instanceData.byFormat || {},
        byFormatAndSite: instanceData.byFormatAndSite || {},
        byCreatives: instanceData.byCreatives || {},
        bySite: instanceData.bySite || {},
      },
    };

    // 3. Ajouter les données VU si disponibles
    if (instanceVUData) {
      reportingData.metrics.byFormat.VU = {
        impressions: instanceVUData.impressions || 0,
        uniqueVisitors: instanceVUData.uniqueVisitors || 0,
      };
    }

    // 4. Valider et nettoyer les données
    Object.keys(reportingData.globalMetrics).forEach((key) => {
      if (reportingData.globalMetrics[key] === undefined || reportingData.globalMetrics[key] === null) {
        reportingData.globalMetrics[key] = '0';
      }
    });

    // 5. Nettoyer les métriques par format
    Object.keys(reportingData.metrics.byFormat).forEach((formatName) => {
      const formatData = reportingData.metrics.byFormat[formatName];
      Object.keys(formatData).forEach((metric) => {
        if (formatData[metric] === undefined || formatData[metric] === null) {
          formatData[metric] = 0;
        }
      });
    });

    // 6. Logger pour débogage
    logger.info(`Rapport JSON généré avec succès pour la campagne ${campaignId}`);

    return reportingData;
  } catch (error) {
    logger.error(`Erreur dans ReportBuildJson pour la campagne ${campaignId}: ${error.message}`);
    throw error;
  }
};

// Calcule les métriques globales 
function calculateGlobalMetrics(data, dataVU) {
    let totalImpressions = 0;
    let totalClics = 0;
    let totalVideoComplete = 0;
    let uniqueVisitors = 0;

    // Parcourir les lignes de données (ignorer la première ligne qui contient les noms de colonnes)
    data.slice(1).forEach(row => {
        // Convertir les valeurs en nombre, en vérifiant qu'elles existent et sont valides
        const impressions = parseInt(row._12, 10) || 0;
        const clics = parseInt(row._13, 10) || 0;
        const videoComplete = parseInt(row._15, 10) || 0;

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
        const impressions = parseInt(row._12, 10) || 0;
        const clics = parseInt(row._13, 10) || 0;
        const videoComplete = parseInt(row._15, 10) || 0;

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

/*
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
*/

// Fonction pour regrouper et calculer les métriques uniquement par format
function regrouperParFormat(data) {
    const resultat = {};

    data.slice(1).forEach(row => {
        // Vérifier que les valeurs nécessaires existent
        if (!row || !row._5 || !row._12 || !row._13 || !row._15) {
            console.warn("Ligne invalide ou données manquantes:", row);
            return;
        }

        // Extraire les valeurs
        const insertionName = row._5 || '';
        const impressions = parseInt(row._12, 10) || 0;
        const clics = parseInt(row._13, 10) || 0;
        const videoComplete = parseInt(row._15, 10) || 0;

        // Trouver le format correspondant en fonction du libellé d'insertion
        const formatTrouve = formats.find(format =>
            insertionName.toUpperCase().includes(format.title)
        );

        if (formatTrouve) {
            const formatTitle = formatTrouve.title; // Utiliser le titre du format

            // Initialiser le format dans le résultat s'il n'existe pas encore
            if (!resultat[formatTitle]) {
                resultat[formatTitle] = {
                    impressions: 0,
                    clics: 0,
                    completions: 0,
                    ctr: 0,
                    vtr: 0
                };
            }

            // Ajouter les valeurs au format approprié
            const result = resultat[formatTitle];
            result.impressions += impressions;
            result.clics += clics;
            result.completions += videoComplete;
        } else {
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
        const impressions = parseInt(row._12, 10) || 0;
        const clics = parseInt(row._13, 10) || 0;
        const videoComplete = parseInt(row._15, 10) || 0;

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
        const impressions = parseInt(row._12, 10) || 0;
        const clics = parseInt(row._13, 10) || 0;
        const videoComplete = parseInt(row._15, 10) || 0;

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

// Fonction pour regrouper et calculer les métriques uniquement par format
function regrouperParDevice(data) {
  let resultat = {};
  let totalCompletions = 0;

  // Saute l'en-tête
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row) continue; // Ignore les lignes vides

    // Récupère les valeurs de chaque colonne
    const deviceName = row._11 ? row._11 : ''; // Si row._11 existe, utilise-le, sinon chaîne vide
    const impressions = toNumber(row._12);
    const clics = toNumber(row._13);
    const completions = toNumber(row._15);

    if (!deviceName) continue; // Ignore les lignes sans nom de device

    // Initialise l'objet pour ce device s'il n'existe pas
    if (!resultat[deviceName]) {
      resultat[deviceName] = {
        impressions: 0,
        clics: 0,
        completions: 0,
      };
    }

    // Ajoute les valeurs au total pour ce device
    resultat[deviceName].impressions += impressions;
    resultat[deviceName].clics += clics;
    resultat[deviceName].completions += completions;

    // Ajoute aux totaux globaux
    totalCompletions += completions;
  }

  return { resultat, totalCompletions };
}

function toNumber(value) {
  const num = parseFloat(value);
  return isNaN(num) ? 0 : num;
}

// Exportation de la fonction pour réutilisation
module.exports = {
    ReportBuildJson
};