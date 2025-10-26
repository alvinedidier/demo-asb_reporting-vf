/******************************************************************
 * reportHelper.js — Version finale et stable
 * Fusion entre _reportHelper.js (calculs complets)
 * et reportHelper.js (nettoyage CSV + validations modernes)
 * Ajout : regrouperParDevice
 ******************************************************************/

const csv = require('csv-parser');
const { Readable } = require('stream');
const { differenceInDays, parseISO, format, addHours } = require('date-fns');
const { fr: frLocale } = require('date-fns/locale');

const { setCampaignIdWithExpiry } = require('./localStorageHelper');
const logger = require('../utils/logger');
const ModelAdvertisers = require('../models/models.advertisers');
const ModelCampaigns = require('../models/models.campaigns');

// ---------------------------------------------------------------
// 1. Tableau des formats standards
// ---------------------------------------------------------------
const formats = [
  { name: 'habillage', title: 'HABILLAGE' },
  { name: 'interstitiel', title: 'INTERSTITIEL' },
  { name: 'interstitielvideo', title: 'INTERSTITIEL VIDEO' },
  { name: 'instream', title: 'INSTREAM' },
  { name: 'masthead', title: 'MASTHEAD' },
  { name: 'grandangle-pave', title: 'GRAND ANGLE - PAVE' },
  { name: 'grandangle', title: 'GRAND ANGLE' },
  { name: 'rectanglevideo', title: 'RECTANGLE VIDEO' },
  { name: 'rectangle', title: 'RECTANGLE' },
  { name: 'pavevideo', title: 'PAVE VIDEO' },
  { name: 'pave', title: 'PAVE' },
  { name: 'logo', title: 'LOGO' },
  { name: 'native', title: 'NATIVE' },
  { name: 'slider', title: 'SLIDER' },
  { name: 'mea', title: 'MEA' },
  { name: 'slidervideo', title: 'SLIDER VIDEO' },
  { name: 'clickcommand', title: 'CLICK COMMAND' },
  { name: 'footer', title: 'FOOTER' },
  { name: 'inread', title: 'INREAD' },
  { name: 'inreadvideo', title: 'INREAD VIDEO' },
  { name: 'billboard', title: 'BILLBOARD' },
  { name: 'instream', title: 'PREROLL' },
  { name: 'instream', title: 'PREROLL / MIDROLL' },
];

// ---------------------------------------------------------------
// 2. Utilitaires de parsing CSV
// ---------------------------------------------------------------
function stringToStream(text) {
  const stream = new Readable();
  stream.push(text);
  stream.push(null);
  return stream;
}

function parseCsvString(csvString) {
  return new Promise((resolve, reject) => {
    const results = [];
    const stream = stringToStream(csvString);
    stream
      .pipe(
        csv({
          separator: ';',
          headers: true,
          skipEmptyLines: true,
          mapValues: ({ value }) => {
            if (!value) return null;
            let clean = value.toString().trim().replace(/\r|\n/g, '');
            if (/^-?\d+,\d+$/.test(clean)) clean = clean.replace(',', '.');
            if (clean.endsWith('%')) clean = clean.replace(',', '.');
            return clean;
          },
        })
      )
      .on('data', (row) => results.push(row))
      .on('end', () => resolve(results))
      .on('error', (err) => reject(err));
  });
}

// ---------------------------------------------------------------
// 3. Calculs des métriques
// ---------------------------------------------------------------
function calculateCtr(clicks, impressions) {
  return impressions > 0 ? (clicks / impressions * 100).toFixed(2) : '0.00';
}

function calculateGlobalMetrics(data, dataVU) {
  let totalImpressions = 0;
  let totalClics = 0;
  let totalVideoComplete = 0;
  let uniqueVisitors = 0;

  data.slice(1).forEach((row) => {
    const impressions = parseInt(row._12, 10) || 0;
    const clics = parseInt(row._13, 10) || 0;
    const videoComplete = parseInt(row._15, 10) || 0;
    totalImpressions += impressions;
    totalClics += clics;
    totalVideoComplete += videoComplete;
  });

  if (dataVU && dataVU.length > 1) {
    const vuData = dataVU[1];
    uniqueVisitors = parseInt(vuData['_8'], 10) || 0;
  }

  const ctrGlobal = totalImpressions > 0 ? (totalClics / totalImpressions * 100).toFixed(2) : '0.00';
  const completionRateGlobal = totalImpressions > 0 ? (totalVideoComplete / totalImpressions * 100).toFixed(2) : '0.00';
  const repetition = uniqueVisitors > 0 ? (totalImpressions / uniqueVisitors).toFixed(2) : '0.00';

  return {
    totalImpressions,
    totalClics,
    ctrGlobal,
    totalVideoComplete,
    completionRateGlobal,
    uniqueVisitors,
    repetition,
  };
}

// ---------------------------------------------------------------
// 4. Regroupements par format, site, créative et device
// ---------------------------------------------------------------
/*
function regrouperParFormat(data) {
  const resultat = {};
  data.slice(1).forEach((row) => {
    const insertionName = row._5 || '';
    const impressions = parseInt(row._12, 10) || 0;
    const clics = parseInt(row._13, 10) || 0;
    const videoComplete = parseInt(row._15, 10) || 0;
    const formatTrouve = formats.find((f) => insertionName.toUpperCase().includes(f.title));
    if (!formatTrouve) return;
    const key = formatTrouve.title;
    if (!resultat[key]) resultat[key] = { impressions: 0, clics: 0, completions: 0, ctr: 0, vtr: 0 };
    resultat[key].impressions += impressions;
    resultat[key].clics += clics;
    resultat[key].completions += videoComplete;
  });
  for (const format in resultat) {
    const r = resultat[format];
    r.ctr = calculateCtr(r.clics, r.impressions);
    r.vtr = calculateCtr(r.completions, r.impressions);
  }
  return resultat;
}
*/

function normalizeFormatName(name) {
  return name
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // retire les accents
    .replace(/[-_/]/g, " ") // uniformise tirets et underscores
    .replace(/\s+/g, " ")
    .trim();
}

function regrouperParFormat(data) {
  const resultat = {};

  data.slice(1).forEach((row) => {
    const insertionName = normalizeFormatName(row._5 || '');
    const impressions = parseInt(row._12, 10) || 0;
    const clics = parseInt(row._13, 10) || 0;
    const completions = parseInt(row._15, 10) || 0;

    // 🔍 Trouver le format le plus spécifique (titre le plus long qui match)
    const formatTrouve = formats
      .filter(f => insertionName.includes(normalizeFormatName(f.title)))
      .sort((a, b) => b.title.length - a.title.length)[0];

    if (!formatTrouve) return;

    const key = formatTrouve.title;

    if (!resultat[key]) {
      resultat[key] = { impressions: 0, clics: 0, completions: 0, ctr: '0.00', vtr: '0.00' };
    }

    const f = resultat[key];
    f.impressions += impressions;
    f.clics += clics;
    f.completions += completions;
  });

  // Calcul des CTR/VTR
  for (const key in resultat) {
    const f = resultat[key];
    f.ctr = calculateCtr(f.clics, f.impressions);
    f.vtr = calculateCtr(f.completions, f.impressions);
  }

  return resultat;
}

function regrouperParSite(data) {
  const resultat = {};
  data.slice(1).forEach((row) => {
    let site = row._9 || '';
    if (site === 'SM_LINFO-IOS' || site === 'SM_LINFO-ANDROID') site = 'SM_LINFO-APPLI';
    const impressions = parseInt(row._12, 10) || 0;
    const clics = parseInt(row._13, 10) || 0;
    const completions = parseInt(row._15, 10) || 0;
    if (!resultat[site]) resultat[site] = { impressions: 0, clics: 0, completions: 0, ctr: 0, vtr: 0 };
    const s = resultat[site];
    s.impressions += impressions;
    s.clics += clics;
    s.completions += completions;
  });
  for (const site in resultat) {
    const s = resultat[site];
    s.ctr = calculateCtr(s.clics, s.impressions);
    s.vtr = calculateCtr(s.completions, s.impressions);
  }
  return resultat;
}

function regrouperParCreatives(data) {
  const resultat = {};
  data.slice(1).forEach((row) => {
    const creative = row._10 || '';
    const impressions = parseInt(row._12, 10) || 0;
    const clics = parseInt(row._13, 10) || 0;
    const completions = parseInt(row._15, 10) || 0;
    if (!resultat[creative]) resultat[creative] = { impressions: 0, clics: 0, completions: 0, ctr: 0, vtr: 0 };
    const c = resultat[creative];
    c.impressions += impressions;
    c.clics += clics;
    c.completions += completions;
  });
  for (const creative in resultat) {
    const c = resultat[creative];
    c.ctr = calculateCtr(c.clics, c.impressions);
    c.vtr = calculateCtr(c.completions, c.impressions);
  }
  return resultat;
}

// ---------------------------------------------------------------
// 5. Regroupement par device
// ---------------------------------------------------------------
function toNumber(value) {
  const num = parseFloat(value);
  return isNaN(num) ? 0 : num;
}

function regrouperParDevice(data) {
  const resultat = {};
  let totalCompletions = 0;
  let totalImpressions = 0;

  // 1️⃣ Parcours des lignes
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;

    const deviceName = row._11 ? String(row._11).trim() : '';
    const impressions = toNumber(row._12);
    const clics = toNumber(row._13);
    const completions = toNumber(row._15);

    if (!deviceName) continue;

    // Initialise le device si absent
    if (!resultat[deviceName]) {
      resultat[deviceName] = {
        impressions: 0,
        clics: 0,
        completions: 0,
        ctr: '0.00',
        vtr: '0.00',
        poidsImpressions: '0.00', // ✅ nouveau champ
      };
    }

    const d = resultat[deviceName];
    d.impressions += impressions;
    d.clics += clics;
    d.completions += completions;

    totalCompletions += completions;
    totalImpressions += impressions; // ✅ on cumule le total global
  }

  // 2️⃣ Calcul des métriques par device
  for (const device in resultat) {
    const d = resultat[device];
    d.ctr = d.impressions > 0 ? (d.clics / d.impressions * 100).toFixed(2) : '0.00';
    d.vtr = d.impressions > 0 ? (d.completions / d.impressions * 100).toFixed(2) : '0.00';
    d.poidsImpressions = totalImpressions > 0 ? ((d.impressions / totalImpressions) * 100).toFixed(2) : '0.00'; // ✅ poids %
  }

  // 3️⃣ Retour du résultat complet
  return {
    resultat,
    totalCompletions,
    totalImpressions, // ✅ utile pour le reporting global
  };
}

// ---------------------------------------------------------------
// 6. Fonction principale : ReportBuildJson
// ---------------------------------------------------------------
async function ReportBuildJson(campaignId, csvData1String, csvData2String) {
  try {
    logger.info(`➡️ Génération du rapport pour la campagne ${campaignId}`);

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
      include: [{ model: ModelAdvertisers }],
    });

    if (!campaign) throw new Error(`Campagne ${campaignId} introuvable.`);

    const parsedCsv1 = await parseCsvString(csvData1String);
    const parsedCsv2 = csvData2String ? await parseCsvString(csvData2String) : [];

    const globalMetrics = calculateGlobalMetrics(parsedCsv1, parsedCsv2);
    const metricsByFormat = regrouperParFormat(parsedCsv1);
    const metricsBySite = regrouperParSite(parsedCsv1);
    const metricsByCreatives = regrouperParCreatives(parsedCsv1);
    const { resultat: metricsByDevice, totalCompletions: devicesTotalCompletions } = regrouperParDevice(parsedCsv1);

    const report = {
      campaign_id: campaign.campaign_id,
      campaign_name: campaign.campaign_name,
      campaign_crypt: campaign.campaign_crypt,
      advertiser_id: campaign.advertiser_id,
      advertiser_name: campaign.advertiser?.advertiser_name || 'N/A',
      campaign_start_date: campaign.campaign_start_date,
      campaign_end_date: campaign.campaign_end_date,
      campaign_start_date_formatted: format(parseISO(campaign.campaign_start_date), 'dd/MM/yyyy', { locale: frLocale }),
      campaign_end_date_formatted: format(parseISO(campaign.campaign_end_date), 'dd/MM/yyyy', { locale: frLocale }),
      campaign_duration: differenceInDays(parseISO(campaign.campaign_end_date), parseISO(campaign.campaign_start_date)),
      globalMetrics,
      metrics: {
        byFormat: metricsByFormat,
        bySite: metricsBySite,
        byCreatives: metricsByCreatives,
        byDevices: metricsByDevice,
      },
      devicesTotals: { totalCompletions: devicesTotalCompletions },
      reporting_dates: {
        reporting_start_date: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
        reporting_end_date: format(addHours(new Date(), 2), 'yyyy-MM-dd HH:mm:ss'),
      },
    };

    setCampaignIdWithExpiry(campaignId, report);
    logger.info(`✅ Rapport JSON sauvegardé pour ${campaignId}`);
    return report;
  } catch (error) {
    logger.error(`❌ Erreur dans ReportBuildJson (${campaignId}): ${error.message}`);
    throw error;
  }
}

// ---------------------------------------------------------------
module.exports = { ReportBuildJson, regrouperParDevice };
