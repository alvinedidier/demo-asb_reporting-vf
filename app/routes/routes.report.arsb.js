const { check, param, validationResult } = require('express-validator');
const router = require("express").Router();
const Sequelize = require('sequelize');
const report = require("../controllers/controllers.report.arsb");

// Middleware de validation des paramètres
const validateCampaignCrypt = [
  param('campaigncrypt')
    .isString().withMessage('Le paramètre campaigncrypt doit être une chaîne de caractères.')
    .notEmpty().withMessage('Le paramètre campaigncrypt ne doit pas être vide.'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

const validateCampaignId = [
  param('campaignid')
    .isInt().withMessage('Le paramètre campaignid doit être un entier.')
    .notEmpty().withMessage('Le paramètre campaignid ne doit pas être vide.'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

// Gestion du reporting de l'API
router.get("/", (req, res) => res.status(403).render('error.ejs', {
  statusCoded: 404,
  message: 'Accès refusé',
}) );

router.get("/:campaigncrypt", validateCampaignCrypt, report.generate);
router.get("/:campaigncrypt/report", validateCampaignCrypt, report.report);
//router.get("/report/:campaigncrypt", validateCampaignCrypt, report.report);
/*
router.get("/:campaigncrypt/export", validateCampaignCrypt, (req, res) => {
  res.send(`Export report for campaign: ${req.params.campaigncrypt}`);
});

router.get("/automate/:campaignid/", validateCampaignId, (req, res) => {
  res.send(`Automate report for campaign: ${req.params.campaignid}`);
});
*/
module.exports = router;
