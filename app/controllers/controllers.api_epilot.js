// Récupére les données de configuration de l`API
const dbApi = require("../config/config.api");
// Initialise le module request
const request = require('request');
// Initialise le module
const bodyParser = require('body-parser');

const csv = require('csv-parser')
const fs = require('fs')
const results = [];
const axios = require(`axios`);

//const asyncly = require('async');

const fileGetContents = require('file-get-contents');

// Initiliase le module axios const axios = require(`axios`);

const {Op} = require("sequelize");

const logger = require('../utils/logger');
process.on('unhandledRejection', error => {
    // Will print "unhandledRejection err is not defined"
    logger.error(`unhandledRejection : ${error.message}`);
});

const {QueryTypes} = require('sequelize');

const {check, query} = require('express-validator');

// Charge l'ensemble des functions de l'API const AxiosFunction =
// require('../functions/functions.axios'); Initialise les models const
// ModelSite = require("../models/models.site"); const ModelFormat =
// require("../models/models.format"); const ModelCountry =
// require("../models/models.country")
const ModelEpilotCampaigns = require("../models/models.epilot_campaigns")
// const ModelPack = require("../models/models.pack") const ModelPack_Site =
// require("../models/models.pack_site") regex test date
const REGEX = /(?<day>\d{2})\/(?<month>\d{2})\/(?<year>\d{4})/

exports.index = async (req, res) => {

    try {
        if (req.session.user.user_role === 1 || req.session.user.user_role === 2 || req.session.user.user_role === 3) {

            var confirmer = await ModelEpilotCampaigns.findAll({
                attributes: [
                    'campaign_name', 'format_name', 'campaign_start_date', 'campaign_end_date', 'volume_prevue'
                ],

                where: {
                    etat: 1
                },
                order: [
                    ['campaign_name', 'ASC']
                ]
            })

            var reserver = await ModelEpilotCampaigns.findAll({
                attributes: [
                    'campaign_name', 'format_name', 'campaign_start_date', 'campaign_end_date', 'volume_prevue'
                ],

                where: {
                    etat: 2
                },
                order: [
                    ['campaign_name', 'ASC']
                ]
            })

            var reult_confirmer = Object
                .keys(confirmer)
                .length;

            var reult_reserver = Object
                .keys(reserver)
                .length;

            res.render('forecast/liste_epilot.ejs', {
                confirmer: confirmer,
                reserver: reserver,
                reult_confirmer: reult_confirmer,
                reult_reserver: reult_reserver
            });

        }

    } catch (error) {
        console.log(error)
        var statusCoded = error.response;

        res.render("error.ejs", {statusCoded: statusCoded})
    }

}

exports.csv_import = async (req, res) => {

    const uploadedFile = req.files.file_csv;

    try {

        //verification de extention du fichier
        if ((uploadedFile.mimetype === 'application/vnd.ms-excel' || uploadedFile.mimetype === 'application/octet-stream')) {

            // il faut que le dossier upload existe. crée des dossier archive
            // (ex:upload20210108)
            await uploadedFile.mv('public/admin/uploads/' + uploadedFile.name, err => {
                if (err) 
                    return res
                        .status(500)
                        .send(err)
                });

            //recupère le fichier upload et lecture des donnée

            fs
                .createReadStream('public/admin/uploads/' + uploadedFile.name)
                // fs.createReadStream('public/admin/uploads/template_csv.csv')
                .pipe(csv({
                    separator: '\;'
                },))
                .on('data', (data) => results.push(data))
                .on('end', () => {
                    //  console.log(results);

                    for (let i = 0; i < results.length; i++) {

                        //recupère mes donnée puis assigné à une variabme
                        var campaign_name = results[i].Campagne;
                        var format_name = results[i].Formats;
                        var etat = results[i].Etat;
                        var campaign_start_date = results[i].Date_de_debut_prevue;
                        var campaign_end_date = results[i].Date_de_fin_prevue;
                        var volume_prevue = results[i].Volume_total_prevu;
                        var annonceurs = results[i].Annonceur;

                        // test tableau exclusion / ajouter test si la campagne n'est pas dans la base
                        // Test si les valeurs sont vide
                        if (campaign_name === '' || format_name === '' || etat === '' || campaign_start_date === '' || campaign_end_date === '' || volume_prevue === '' || annonceurs === '') {

                            return res.send("des champs sont vides")

                        }
                        /*
                         if (campaign_start_date > campaign_end_date || campaign_end_date < campaign_start_date)
                        {return res.send("La date debut et fin est invalide")}
            */

                        //remplace les valeurs
                        if (etat === "Confirmee") {
                            etat = "1";
                        }
                        if (etat === "Reservee") {
                            etat = "2";
                        }

                        //formate la date start DD/MM/YY -> YYYY-MM-DD
                        const date_start = REGEX.exec(campaign_start_date)
                        var DD = date_start[1]
                        var MM = date_start[2]
                        var YYYY = date_start[3]
                        var date_start_format = YYYY + '-' + MM + '-' + DD

                        //formate la date end DD/MM/YY -> YYYY-MM-DD
                        const date_end = REGEX.exec(campaign_end_date)
                        var DD = date_end[1]
                        var MM = date_end[2]
                        var YYYY = date_end[3]
                        var date_end_format = YYYY + '-' + MM + '-' + DD

                        campaign_debut = date_start_format + 'T00:00:00.000Z'
                        campaign_fin = date_end_format + 'T00:00:00.000Z'

                        //apres tout mes test passé add les données
                        ModelEpilotCampaigns
                            .create({
                                epilot_campaign_name: campaign_name,
                                format_name: format_name,
                                epilot_campaign_status: etat,
                                epilot_campaign_start_date: campaign_debut,
                                epilot_campaign_end_date: campaign_fin,
                                epilot_campaign_volume: volume_prevue
                            })
                            .then(async function (campagne_epilot) {
                                if (campagne_epilot) {
                                    req.session.message = {
                                        type: 'success',
                                        intro: 'Ok',
                                        message: 'Votre fichier csv est valide'
                                    }
                                    return res.redirect('manager/campaigns/epilot/list')

                                }

                            })

                    }

                });

        } else {
            req.session.message = {
                type: 'danger',
                intro: 'Erreur',
                message: 'Extention du fichier invalide'
            }
            return res.redirect('/manager/epilot/list')

        }

    } catch (error) {
        console.log(error);
        var statusCoded = error.response.status;
        res.render("manager/error.ejs", {statusCoded: statusCoded});
    }

}