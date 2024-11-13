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
const validateAgencyId = validateParam('agencyid', 'int');

router.get("/campaigns", automate.campaigns);
router.get("/campaign/:campaignid",validateCampaignId, automate.campaign);
router.get("/advertiser/:advertiserid",validateAdvertisterId, automate.advertiser);
router.get("/agency/:agencyid",validateAgencyId, automate.agency);

// router.post("/reporting", automate.reporting);

module.exports = router;