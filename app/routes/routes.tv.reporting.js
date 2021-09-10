const router = require("express").Router();
const Sequelize = require('sequelize');

const reportingTV = require("../controllers/controllers.tv.reporting");

// Gestion du reporting de l'API
router.get("/", reportingTV.index);

module.exports = router;