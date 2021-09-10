const {Op, and} = require("sequelize");

process.on('unhandledRejection', error => {
    // Will print "unhandledRejection err is not defined"
    console.log('unhandledRejection', error.message);
});

const {QueryTypes} = require('sequelize');
const moment = require('moment');
moment.locale('fr');
const {check, query} = require('express-validator');

// Module ExcelJS
const ExcelJS = require('exceljs');

// Charge l'ensemble des functions de l'API
const AxiosFunction = require('../functions/functions.axios');
const SmartFunction = require("../functions/functions.smartadserver.api");
const Utilities = require('../functions/functions.utilities');

// Initialise les models
const ModelAdvertisers = require("../models/models.advertisers");
const ModelCampaigns = require("../models/models.campaigns");
const ModelInsertions = require("../models/models.insertions");
const ModelFormats = require("../models/models.formats");
const ModelSites = require("../models/models.sites");

var LocalStorage = require('node-localstorage').LocalStorage;
localStorageTV = new LocalStorage(
    'data/tv/' + moment().format('YYYY/MM/DD')
);

exports.index = async (req, res) => {
    //

   
const alpha = Array.from(Array(26)).map((e, i) => i + 65);
const alphabet = alpha.map((x) => String.fromCharCode(x));
console.log(alphabet);



    var workbook = new ExcelJS.Workbook();
    workbook
        .xlsx
        .readFile('data/tv/Campagne_Leclerc-Plan_Campagne-132748939578174030.xlsx')
        .then(function () {
           
            var campaignObjects = new Object();

            // Note: workbook.worksheets.forEach will still work but this is better
            workbook.eachSheet(function (worksheet, sheetId) {
                const regexEnsemble = /Ensemble/gi;

                // Récupére le nom de la feuille
                var worksheetName = worksheet.name;
              
                // Récupére la feuille Ensemble 
                if (worksheetName.match(regexEnsemble)) {
               
                    const campaignName = worksheet.getCell('C3').value;
                    const campaignPeriod = worksheet.getCell('C4').value;
                    const campaignCurrency = worksheet.getCell('C7').value;
                    const campaignBudget = worksheet.getCell('C8').value;                   
                    const campaignWeightedNumber = worksheet.getCell('C9').value;

                    const campaignAdvertiser = worksheet.getCell('H3').value;
                    const campaignFormat = worksheet.getCell('H6').value;

                    campaignObjects[worksheetName] = {
                                        'campaignName' : campaignName, 
                                        'campaignPeriod' : campaignPeriod,
                                        'campaignCurrency' : campaignCurrency,
                                        'campaignBudget' : campaignBudget,
                                        'campaignWeightedNumber' : campaignWeightedNumber,
                                        'campaignAdvertiser' : campaignAdvertiser,
                                        'campaignFormat' : campaignFormat 
                                      }

                    console.log('Campagne : ', campaignName);
                    console.log('Période : ', campaignPeriod);
                    console.log('Monnaie : ', campaignCurrency);
                    console.log('Budget : ', campaignBudget);
                    console.log('Effectif pondéré : ', campaignWeightedNumber);
                    console.log('Annonceur : ', campaignAdvertiser);
                    console.log('Formats : ', campaignFormat);
                    console.log('------------------------------------------');

                    // Initialisation des tableaux
                    dataLines = new Array();
                    dataLinesName = new Object();
                    dataItemsLinesSelect = new Array();

                    // Itérer sur toutes les lignes qui ont des valeurs dans une feuille de calcul.
                    // Etape 1 : On récupére les lignes débutant chaque tableau
                    worksheet.eachRow(function (row, rowNumber) {
                        // Récupére la ligne
                        dataRow = row.values;
                        // Mets la ligne dans un tableau
                        dataLines.push(row.values);
                        // Retourne le nombre de colonne
                        numberCols = dataRow.length;

                        // Récupére le numéro de la ligne où se trouve : "Chaine" et le mets dans un tableau
                        if (dataRow[1] === "Chaîne") {
                            var channelLineBegin = rowNumber;
                            dataItemsLinesSelect['channelLineBegin'] = rowNumber;
                            console.log('[x] Chaîne - Begin :' + channelLineBegin);
                        }
                     
                        // Récupére le numéro de la ligne où se trouve : "Montée en charge / Jour" et le mets dans un tableau
                        if (dataRow[1] === "Montée en charge / Jour") {
                            var increaseInLoadPerDayLineBegin = rowNumber;
                            dataItemsLinesSelect['increaseInLoadPerDayLineBegin'] = rowNumber;
                            console.log(
                                '[x] Montée en charge / Jour - Begin :' + increaseInLoadPerDayLineBegin
                            );
                        }
                      
                        // Récupére le numéro de la ligne où se trouve : "Journal tranches horaires" et le mets dans un tableau
                        if (dataRow[1] === "Journal tranches horaires") {
                            var timeSlotDiaryLineBegin = rowNumber;
                            dataItemsLinesSelect['timeSlotDiaryLineBegin'] = rowNumber;
                            console.log(
                                '[x] Journal tranches horaires - End : ' + timeSlotDiaryLineBegin
                            );
                        }
                     
                        // Récupére le numéro de la ligne où se trouve : "Jour nommé" et le mets dans un tableau
                        if (dataRow[1] === "Jour nommé") {
                            var nameDayLineBegin = rowNumber;
                            dataItemsLinesSelect['nameDayLineBegin'] = rowNumber;
                            console.log('[x] Jour nommé - Begin : ' + nameDayLineBegin);
                        }                      
                    })
                  
                    // Etape 2 : Parcours le tableau 
                    IncreaseILPDAArray = timeSlotDiaryArray = nameDayArray = new Array();
                    worksheet.eachRow(function (row, rowNumber) {
                        // Récupére la ligne
                        dataRow = row.values;
                        // Mets la ligne dans un tableau
                        dataLines.push(row.values);
                        // Retourne le nombre de colonne
                        numberCols = dataRow.length;

                        // Récupére le 1er élément de la ligne
                        dataRowOne = dataRow[1];
                      
                        // Listing des regex
                        const regexChannel = /Antenne Réunion/gi;
                        // Récupére les formats date                        
                        const regexIncreaseInLoadPerDay = /([0-9]{2}\/[0-9]{2}\/[0-9]{2})/gi;
                        // Récupére les tranches Horaires
                        const regexTimeSlotDiary = /([0-9]{2}h[0-9]{2} [0-9]{2}h[0-9]{2})/gi;
                        // Récupére les Jours de la semaine
                        const regexNameDay = /(Lundi|Mardi|Mercredi|Jeudi|Vendredi|Samedi|Dimanche)/gi;

                        const labels = worksheet.getRow((rowNumber-1)).values;
                       
                        // Récupération des données de la chaîne
                        if ((rowNumber > dataItemsLinesSelect['channelLineBegin']) && dataRowOne.match(regexChannel) && (numberCols > 2)) {
                            // Récupére les libellés
                            var ChannelArray = new Object();
                            for(i = 0; i < (numberCols-1); i++) {
                                var cellKey = alphabet[i].concat(dataItemsLinesSelect['channelLineBegin']);
                                var cellValue = alphabet[i].concat(rowNumber);

                                var label = worksheet.getCell(cellKey).value;
                                var value = worksheet.getCell(cellValue).value;
                              //  console.log('col : ', i ,' -> ',cellValue, ' = ' , worksheet.getCell(cellKey).value, ' => ' , worksheet.getCell(cellValue).value); 
                                
                                ChannelArray[label] = value;
                            }

                            // Mets la chaine dans l'object campagne
                            campaignObjects[worksheetName].campaignChannel = ChannelArray;

                            console.log(
                                'chaine_begin : Ligne ' + rowNumber + ' (Item : ' + numberCols + ') = ' +
                                JSON.stringify(row.dataRowOnes) + ' - | - '
                            );
                            console.log(ChannelArray);
                            console.log('--------------------');                          
                        }
                       

                         // Récupération des données de la Montée en charge
                        if ((rowNumber > dataItemsLinesSelect['increaseInLoadPerDayLineBegin']) && dataRowOne.match(regexIncreaseInLoadPerDay) && (numberCols > 2)) {
                             // Récupére les libellés
                             var IncreaseInLoadPerDayObject = new Object();
                             for(i1 = 0; i1 < (numberCols-1); i1++) {
                                 var cellKey = alphabet[i1].concat(dataItemsLinesSelect['increaseInLoadPerDayLineBegin']);
                                 var cellValue = alphabet[i1].concat(rowNumber);
 
                                 var label = worksheet.getCell(cellKey).value;
                                 var value = worksheet.getCell(cellValue).value;
                                 console.log('col : ', i1 ,' -> ',cellValue, ' = ' , worksheet.getCell(cellKey).value, ' => ' , worksheet.getCell(cellValue).value); 
                                 IncreaseInLoadPerDayObject[label] = value;
                             } 
                                                      
                            console.log(
                                'montee_en_charge_begin : Ligne ' + rowNumber + ' (Item : ' + numberCols +
                                ') = ' + JSON.stringify(row.dataRowOnes) + ' - | - ' + dataRowOne
                            );
                            //console.log(IncreaseInLoadPerDayObject);
                            IncreaseILPDAArray.push(IncreaseInLoadPerDayObject);

                            // Mets des données de la Montée en charge l'object campagne
                             campaignObjects[worksheetName].campaignIncreaseInLoadPerDay = IncreaseILPDAArray;

                            console.log('--------++++++++++++++++++++++++------------')
                            console.log(IncreaseILPDAArray);
                            console.log('--------++++++++++++++++++++++++------------')
                        }
                        

                        // Récupération des données des tranches horaires
                        if ((rowNumber > dataItemsLinesSelect['timeSlotDiaryLineBegin']) && dataRowOne.match(regexTimeSlotDiary) && (numberCols > 2)) {
                                // Récupére les libellés
                                var timeSlotDiaryObject = new Object();
                                for(i2 = 0; i2 < (numberCols-1); i2++) {
                                    var cellKey = alphabet[i2].concat(dataItemsLinesSelect['timeSlotDiaryLineBegin']);
                                    var cellValue = alphabet[i2].concat(rowNumber);

                                    var label = worksheet.getCell(cellKey).value;
                                    var value = worksheet.getCell(cellValue).value;
                                    console.log('col : ', i2 ,' -> ',cellValue, ' = ' , worksheet.getCell(cellKey).value, ' => ' , worksheet.getCell(cellValue).value); 
                                    timeSlotDiaryObject[label] = value;
                                }

                                //console.log(IncreaseInLoadPerDayArray);
                                timeSlotDiaryArray.push(timeSlotDiaryObject);
                                console.log('--------++++++++++++++++++++++++------------')
                                console.log(timeSlotDiaryArray);
                                console.log('--------++++++++++++++++++++++++------------')

                                // Mets des données des données des tranches horaires
                                campaignObjects[worksheetName].campaigntimeSlotDiary = timeSlotDiaryArray;

                                console.log(
                                'tranches_horaires_begin : Ligne ' + rowNumber + ' (Item : ' + numberCols + ') ' +
                                '= ' + JSON.stringify(row.dataRowOnes) + ' - | - ' + dataRowOne
                                );
                        }
                     
                         // Récupération des données des jours de la semaine
                        if ((rowNumber > dataItemsLinesSelect['nameDayLineBegin']) && dataRowOne.match(regexNameDay) && (numberCols > 2)) {
                              // Récupére les libellés
                              var nameDayObject = new Object();
                              for(i3 = 0; i3 < (numberCols-1); i3++) {
                                  // Récup data
                                  var cellKey = alphabet[i3].concat(dataItemsLinesSelect['nameDayLineBegin']);
                                  var cellValue = alphabet[i3].concat(rowNumber);
  
                                  var label = worksheet.getCell(cellKey).value;
                                  var value = worksheet.getCell(cellValue).value;
                                  console.log('col : ', i3 ,' -> ',cellValue, ' = ' , worksheet.getCell(cellKey).value, ' => ' , worksheet.getCell(cellValue).value); 
                                  nameDayObject[label] = value;

                                  // Récup Graph
                              }           
                           
                           
                             //console.log(IncreaseInLoadPerDayArray);
                             nameDayArray.push(nameDayObject);

   
                            // Mets es données des données des tranches horaires
                            campaignObjects[worksheetName].campaignNameDay = nameDayArray;


                             console.log('--------++++++++++++++++++++++++------------')
                             console.log(nameDayArray);
                             console.log('--------++++++++++++++++++++++++------------')
                                


                            console.log(
                                'jour_nomme_begin : Ligne ' + rowNumber + ' (Item : ' + numberCols + ') = ' +
                                JSON.stringify(row.dataRowOnes) + ' - | - ' + dataRowOne
                            );
                        }
                       
                        // console.log('Ligne ' + rowNumber + ' (Item : '+ numberCols +') = ' +
                        // JSON.stringify(row.values) + ' - | - '+value[1]);3

                          /**/

                        
                  
                    })

                    console.log('Total lignes :' + dataLines.length);
                    console.log(campaignObjects);
                }

            });

        });

}

exports.generate = async (req, res) => {}

exports.report = async (req, res) => {}