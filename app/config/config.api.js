// Initialise les identifiants de connexion à l'api
const dotenv = require("dotenv");
dotenv.config({path:"./config.env"})

module.exports = {
  SMART_login: process.env.SMARTADSERVER_LOGIN,
  SMART_password: process.env.SMARTADSERVER_PASSWORD
};
