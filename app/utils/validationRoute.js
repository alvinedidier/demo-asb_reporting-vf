const { param, validationResult } = require('express-validator');

// Fonction utilitaire pour valider les paramètres
const validateParam = (paramName, type, customMessage) => {
  let validationChain;

  switch (type) {
    case 'string':
      validationChain = param(paramName)
        .isString().withMessage(customMessage || `Le paramètre ${paramName} doit être une chaîne de caractères.`);
      break;
    case 'int':
      validationChain = param(paramName)
        .isInt().withMessage(customMessage || `Le paramètre ${paramName} doit être un entier.`);
      break;
    default:
      throw new Error(`Type de validation non supporté: ${type}`);
  }

  return [
    validationChain.notEmpty().withMessage(`Le paramètre ${paramName} ne doit pas être vide.`),
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      next();
    }
  ];
};

module.exports = {
  validateParam
};
