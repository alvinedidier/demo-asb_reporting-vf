const Utilities = require('../functions/functions.utilities');
const AxiosFunction = require('../functions/functions.axios');

const { differenceInDays, isAfter, isBefore, parseISO, format } = require('date-fns');
const { fr: frLocale } = require('date-fns/locale');

const currentDate = new Date(); // Obtenez la date actuelle
const formattedDate = format(currentDate, 'yyyy/MM/dd'); // Formater la date comme souhaité

const LocalStorage = require('node-localstorage').LocalStorage;
const localStorage = new LocalStorage('data/reporting/');
const localStorageTasks = new LocalStorage(`data/taskID/${formattedDate}/`);
const localStorageInstance = new LocalStorage(`data/instanceIds/${formattedDate}/`);

/*
* Teste si la valeur est vide
*/

exports.empty = function (data) {
    if (typeof (data) == 'number' || typeof (data) == 'boolean') {
        return false;
    }
    if (typeof (data) == 'undefined' || data === null) {
        return true;
    }
    if (typeof (data.length) != 'undefined') {
        return data.length == 0;
    }
    var count = 0;
    for (var i in data) {
        if (data.hasOwnProperty(i)) {
            count++;
        }
    }
    return count == 0;
}

exports.updateOrCreate = async function (model, where, newItem) {
    // First try to find the record
    const foundItem = await model.findOne({ where });
    if (!foundItem) {
        // Item not found, create a new one
        const item = await model.create(newItem);
        return { item, created: true };
    }
    // Found an item, update it
    const item = await model.update(newItem, { where });
    return { item, created: false };
}

exports.getDateTimezone = function (unixTimeStamp) {
    let date = new Date(unixTimeStamp);
    return (date.getFullYear() + '-' + (
        '0' + (
            date.getMonth() + 1
        )
    ).slice(-2) + '-' + (
        '0' + date.getDate()
    ).slice(-2) + 'T' + (
        '0' + date.getHours()
    ).slice(-2) + ':' + (
        '0' + date.getMinutes()
    ).slice(-2) + ':00')
}

exports.getDateTimeTimestamp = function (refrechTimeStamp) {
    let dates = new Date(refrechTimeStamp);
    return ('0' + dates.getDate()).slice(-2) + '/' + (
        '0' + (
            dates.getMonth() + 1
        )
    ).slice(-2) + '/' + dates.getFullYear() + ' ' + (
        '0' + dates.getHours()
    ).slice(-2) + ':' + (
        '0' + dates.getMinutes()
    ).slice(-2);
}

// Séparateur de millier universel
exports.numStr = function (a, b) {
    a = '' + a;
    b = b || ' ';
    var c = '',
        d = 0;
    while (a.match(/^0[0-9]/)) {
        a = a.substr(1);
    }
    for (var i = a.length - 1; i >= 0; i--) {
        c = (d != 0 && d % 3 == 0)
            ? a[i] + b + c
            : a[i] + c;
        d++;
    }
    return c;
}

// Convertie les Timestamp campagne startdate et enddate / date du jour
exports.getDateTimeFromTimestamp = function (unixTimeStamp) {
    let date = new Date(unixTimeStamp);
    return ('0' + date.getDate()).slice(-2) + '/' + (
        '0' + (
            date.getMonth() + 1
        )
    ).slice(-2) + '/' + date.getFullYear();
}

//Function to get difference between 2 arrays
//For every element of arrayA check if present in arrayB, if not, push in result array

exports.arrayDiff = function (arrayA, arrayB) {
    var result = [];
    for (var i = 0; i < arrayA.length; i++) {
        if (arrayB.indexOf(arrayA[i]) <= -1) {
            result.push(arrayA[i]);
        }
    }
    return result;
}

exports.array_unique = function (array) {
    return array.filter(function (el, index, arr) {
        return index == arr.indexOf(el);
    });
}

exports.nbr_jours = function dateDiff(date1, date2) {
    var diff = {}                           // Initialisation du retour
    var tmp = date2 - date1;

    tmp = Math.floor(tmp / 1000);             // Nombre de secondes entre les 2 dates
    diff.sec = tmp % 60;                    // Extraction du nombre de secondes

    tmp = Math.floor((tmp - diff.sec) / 60);    // Nombre de minutes (partie entière)
    diff.min = tmp % 60;                    // Extraction du nombre de minutes

    tmp = Math.floor((tmp - diff.min) / 60);    // Nombre d'heures (entières)
    diff.hour = tmp % 24;                   // Extraction du nombre d'heures

    tmp = Math.floor((tmp - diff.hour) / 24);   // Nombre de jours restants
    diff.day = tmp;

    return diff;
}

exports.DateToTimestamps = function toTimestamp(strDate) {
    var datum = Date.parse(strDate);
    return datum / 1000;
}

exports.RequestReportDate = async function RequestReport(startDate, endDate, campaignId) {
    console.log('startDate  ' + startDate + '  -  ' + 'endDate' + endDate + '  -  ' + 'campaignId  ' + campaignId)

    var requestReporting = {
        "startDate": startDate,
        "endDate": endDate,
        "fields": [{
            "CampaignStartDate": {}
        }, {
            "CampaignEndDate": {}
        }, {
            "CampaignId": {}
        }, {
            "CampaignName": {}
        }, {
            "InsertionId": {}
        }, {
            "InsertionName": {}
        }, {
            "FormatId": {}
        }, {
            "FormatName": {}
        }, {
            "SiteId": {}
        }, {
            "SiteName": {}
        }, {
            "Impressions": {}
        }, {
            "ClickRate": {}
        }, {
            "Clicks": {}
        }, {
            "VideoCount": {
                "Id": "17",
                "OutputName": "Nbr_complete"
            }
        }, {
            "ViewableImpressions": {}
        }],
        "filter": [{
            "CampaignId": [campaignId]
        }]
    }
    let firstLink = await AxiosFunction.getReportingData(
        'POST',
        '',
        requestReporting
    );

    if (firstLink) {
        if (firstLink.status == 201) {
            return firstLink.data.taskId

        }
    } else {
        return firstLink = null;
    }

    // r
}

//Fonction qui regroupe les obj qui on le même item
exports.groupBy = (array, key) => {
    // Return the end result
    return array.reduce((result, currentValue) => {
        // If an array already present for key, push it to the array. Else create an array and push the object
        (result[currentValue[key]] = result[currentValue[key]] || []).push(currentValue);
        // Return the current iteration `result` value, this will be taken as next iteration `result` value and accumulate
        return  result;
    }, {}); // empty object is the initial value for result object

    /*Object.keys(campaignNameGroup).forEach(key => {

           console.log(key)

           console.log(Object.keys(campaignNameGroup[key]).length)

           console.log(campaignNameGroup[key][0].campaign_name)

          Object.keys(campaignNameGroup[key]).forEach(element => {

              //console.log(campaignNameGroup[key][element].campaign_id)
              //console.log(campaignNameGroup[key][element].campaign_name)

          })
       
       });*/
};

// Fonction pour gérer l'absence de campagne
exports.handleCampaignNotFound = function (res, statusCode, message, responseType = 'html') {
    
     // Vérifier si le client attend une réponse JSON
     if (res.req.accepts('json') || (responseType === 'json')) {
        return res.status(statusCode).json({
            status: 'error',
            code: statusCode,
            message: message || 'Campagne non trouvée.'
        });
    } else {
        // Sinon, renvoyer une vue HTML (EJS)
        return res.status(statusCode).render("error.ejs", {
            statusCoded: statusCode,
            message: message || 'Campagne non trouvée.'
        });
    }
};

// Fonction pour gérer le cache
exports.manageCache = function (cacheStorageID, data = null) {
    if (data) {
        localStorage.setItem(cacheStorageID, JSON.stringify(data));
    } else {
        localStorage.removeItem(cacheStorageID);
        localStorageTasks.removeItem(`${cacheStorageID}-taskGlobal`);
        localStorageTasks.removeItem(`${cacheStorageID}-taskGlobalVU`);
    }
};

// Fonction utilitaire pour récupérer les données du cache
exports.getReportingDataFromCache = function (cacheStorageID) {
    try {
      const reportingDataStorage = localStorage.getItem(cacheStorageID);
      return reportingDataStorage ? JSON.parse(reportingDataStorage) : null;
    } catch (error) {
      logger.error(`Erreur lors de la récupération des données du cache: ${error.message}`);
      return null;
    }
  };
  
  // Fonction pour vérifier et mettre à jour le cache
  exports.checkAndUpdateCache = async function(cacheStorageID, campaigncrypt) {
    let data_localStorage = localStorage.getItem(cacheStorageID);
  
    if (data_localStorage) {
      const reportingData = JSON.parse(data_localStorage);
      
      // Remplacement de moment par date-fns pour obtenir la date actuelle
      const reporting_requete_date = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
      
      // Conversion des dates si reportingData.reporting_end_date est au format ISO
      const reportingEndDate = reportingData.reporting_end_date ? parseISO(reportingData.reporting_end_date) : null;
  
      // Comparaison de la date actuelle avec la date de fin du rapport
      if (reportingEndDate && isBefore(new Date(reporting_requete_date), reportingEndDate)) {
        return reportingData;
      } else {
        // Cache expiré, supprimer et régénérer
        localStorage.removeItem(cacheStorageID);
        localStorageTasks.removeItem(`${cacheStorageID}-taskGlobal`);
        localStorageTasks.removeItem(`${cacheStorageID}-taskGlobalVU`);
        return null;
      }
    }
  
    return null;
  };