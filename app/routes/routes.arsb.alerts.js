const router = require("express").Router();
const alerts = require("../controllers/controllers.arsb.alerts");

// Gestion du reporting de l'API
router.get("/", (req, res) => res.status(403).render('error.ejs', {
  statusCoded: 404,
  message: 'Accès refusé',
}) );

router.get("/campaigns", alerts.campaigns);

module.exports = router;
