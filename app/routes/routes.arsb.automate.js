const { validateParam } = require('../utils/validationRoute');
const router = require("express").Router();
const Sequelize = require('sequelize');
const ReportService = require('../services/reportWorkflowService'); // Supposons que vous avez un service de workflow

const automate = require("../controllers/controllers.arsb.automate");

const {
    getReportIds,
    setReportIdsWithExpiry,
    getInstanceIds,
    setInstanceIdsWithExpiry,
    getCampaignId,
    setCampaignIdWithExpiry
  } = require('../utils/localStorageHelper'); // Import des fonctions de gestion du cache
  
// Utilisation de la fonction utilitaire pour valider les paramètres
const validateCampaignCrypt = validateParam('campaigncrypt', 'string');
const validateCampaignId = validateParam('campaignid', 'int');
const validateAdvertisterId = validateParam('advertiserid', 'int');

router.get("/campaigns", automate.campaigns);
router.get("/campaign/:campaignid",validateCampaignId, automate.campaign);
router.get("/advertiser/:advertiserid",validateAdvertisterId, automate.advertiser);

// Endpoint pour générer le rapport et envoyer la progression

/*
router.get("/agencies", automate.agencies);
router.get("/advertisers", automate.advertisers);

router.get("/advertisers/campaigns", automate.advertisersCampaigns);
router.get("/advertiser", automate.advertiser);

router.get("/campaign/report", automate.campaignReport);

router.get("/campaign/report/tv", automate.campaignReportTv);

router.get("/campaign/epilot", automate.campaignEpilot);
router.get("/campaigns/insertions", automate.campaignsInsertions);
router.get("/campaigns/creatives", automate.campaignsCreatives);
router.get("/campaigns/days", automate.campaignsDays);

router.get("/epilot/campaigns", automate.epilotCampaigns);
router.get("/epilot/insertions", automate.epilotInsertions);

router.get("/formats", automate.formats);

router.get("/sites", automate.sites);
router.get("/templates", automate.templates);
router.get("/platforms", automate.platforms);
router.get("/deliverytypes", automate.deliverytypes);
router.get("/insertions_status", automate.insertions_status);

router.get("/insertions", automate.insertions);
router.get("/insertion", automate.insertion);

router.get("/insertions_templates", automate.insertions_templates);
router.get("/insertions_priorities", automate.insertions_priorities);
router.get("/creatives", automate.creatives);
router.get("/countries", automate.countries);
router.get("/reports", automate.reports);
router.get("/packs", automate.packs);

router.get("/forecast",automate.forecast)

router.get("/delete/storage_forecast",automate.delete_localStorageForecast)
router.get("/delete/storage_task",automate.delete_localStorageTask)
*/

module.exports = router;