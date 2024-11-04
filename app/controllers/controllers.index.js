// Récupére les données de configuration de l`API
const dbApi = require("../config/config.api");
// Initialise le module request 
const request = require('request');
// Initialise le module
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const validator = require('validator');
const axios = require(`axios`);
const fileGetContents = require('file-get-contents');

// Initiliase le module axios
const moment = require('moment');
moment.locale('fr');
const {
  Op
} = require("sequelize");

const logger = require('../utils/logger');
process.on('unhandledRejection', error => {
  // Will print "unhandledRejection err is not defined"
  logger.error(`unhandledRejection : ${error.message}`);
});

const {
  QueryTypes
} = require('sequelize');

const {
  check,
  query
} = require('express-validator');

const ModelRole = require("../models/models.roles")
const ModelUsers = require("../models/models.users")
const ModelRolesUsers = require("../models/models.roles_users")

const EMAIL_REGEX = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
const PASSWORD_REGEX = /^(?=.*\d).{4,12}$/;
const msal = require('@azure/msal-node');

// Initialise les identifiants de connexion à l'api
const dotenv = require("dotenv");
dotenv.config({path:"./config.env"})

exports.home_page = async (req, res) => {
  res.render('landing_page.ejs');
}

exports.signup = async (req, res) => {
  try {
    var roles = await ModelRole.findAll({
      where: {
        role_id: [2, 3]
      },
      attributes: ['role_id', 'label'],
      order: [
        ['role_id', 'ASC']
      ],
    })

    res.render('users/signup.ejs', {
      roles: roles
    });

  } catch (err) {
    res.status(500).json({
      'error': 'cannot fetch country'
    });
  }

}

exports.signup_add = async (req, res) => {

  const user_email = req.body.user_email;
  const user_password = req.body.user_password;
  const user_role = req.body.user_role;

  try {
    // verifier si les champs ne son pas vide
    if (user_email === '' || user_password === '' || user_role === '') {
      req.session.message = {
        type: 'danger',
        message: 'Les champs ne doivent pas être vide'
      }
      return res.redirect('/signup');
      // return res.render('users/signup.ejs')
    }

    // verifie si email est valide avec le regex
    if (!EMAIL_REGEX.test(user_email)) {
      req.session.message = {
        type: 'danger',
        intro: 'Erreur',
        message: 'Email invalide'
      }
      return res.redirect('/signup');
    }

    // verifie si le password contien entre min 4 et max 8 caratère + un number
    if (!PASSWORD_REGEX.test(user_password)) {
      req.session.message = {
        type: 'danger',
        message: 'Le mot de passe doit être compris entre 4 et 12 caractères avec 1 chiffre et un caratère spécial'
      }
      return res.redirect('/signup');
    }

    // search si email exsite déjà dans le bdd

    await ModelUsers.findOne({
      attributes: ['user_email'],
      where: {
        user_email: user_email
      }
    }).then(async function (userFound) {

      if (!userFound) {
        //validator + bycrypt
        const hashedPwd = await bcrypt.hash(user_password, 12);
        const user = await ModelUsers.create({
          user_email: validator.normalizeEmail(user_email),
          user_password: hashedPwd,
          user_role
        });

        console.log(user.user_id)

        await ModelRolesUsers.create({
          role_id: user_role,
          user_id: user.user_id
        });

        res.redirect('/login');

      } else {
        req.session.message = {
          type: 'danger',
          intro: 'Erreur',
          message: 'Email est déjà utilisé'
        }
        return res.redirect('/signup');
      }

    });

  } catch (error) {
    console.log(error);
    var statusCoded = error.response;
    res.render("error.ejs", {
      statusCoded: statusCoded
    });
  }

}

exports.login = async (req, res) => {
 res.render('users/login.ejs');
}

exports.login_add = async (req, res) => {
  const user_email = req.body.user_email;
  const user_password = req.body.user_password;

  console.log('Email : ', user_email, ' - Password : ', user_password);

  try {
    // verifie si les donnée son correcte et non null 
    if (user_email == '' || user_password == '') {
      req.session.message = {
        type: 'danger',
        message: 'Votre adresse email ou votre mot passe est incorrect.'
      }
      return res.redirect('/login');
    }

    // verifie si le email est présent dans la base
    ModelUsers.findOne({
      where: {
        user_email: user_email
      }
    }).then(async function (user) {
      // si email trouvé
      if (user) {
        console.log(user)
        // on verifie si l'utilisateur à utiliser le bon mot de passe avec bcrypt
        const isEqual = await bcrypt.compare(user_password, user.user_password);
        // Si le mot de passe correpond au caratère hashé
        if (isEqual) {
          if (user.user_email !== user_email && user.user_password !== user_password) {
            res.redirect('/login');
          } else {
          
            // Date et l'heure de la connexion
            const now = new Date();
            const date_now = now.getTime();
            const updated_at = moment(date_now).format('YYYY-MM-DDTHH:m:00');

            // use session for user connected
            req.session.user = user;
            var nbr_log = req.session.user.user_log + 1

            ModelUsers.update({
              updated_at: updated_at,
              user_log: nbr_log
            }, {
              where: {
                user_id: user.user_id
              }
            }).then(function() {
              if(req.session.user.user_role === 1) { 
                // Si c'est un administrateur....
                res.redirect('/manager'); 
              } else {
                // Sinon
                res.redirect('/forecast');
              }
            });

          }

        } else {
          req.session.message = {
            type: 'danger',
            message: 'Votre adresse email ou votre mot de passe est incorrect.'
          }
          return res.redirect('/login');
        }

      } else {
        req.session.message = {
          type: 'danger',
          message: 'Votre adresse email ou votre mot passe est incorrect.'
        }
        return res.redirect('/login');
      }
    })
  } catch (error) {
    console.log(error);
    res.redirect('/login');
  }
}

exports.logout = async (req, res) => {
  req.session = null;
  res.redirect('login');
}

exports.index = async (req, res) => {
  try {
    if (req.session.user.user_role === 1) {
      res.render('home-page.ejs');
    }

  } catch (error) {
    console.log(error);
    var statusCoded = error.response;
    res.render("error.ejs", {
      statusCoded: statusCoded,
    });
  }
}