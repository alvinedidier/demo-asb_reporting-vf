const EventEmitter = require('events');
EventEmitter.defaultMaxListeners = 2000; // Définit la limite pour tous les écouteurs d'événements

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
var cookieParser = require('cookie-parser');
const cookieSession = require('cookie-session')
var fileUpload = require('express-fileupload');
var runner = require("child_process");

const { validationResult } = require('express-validator');
const morgan = require('morgan');
const winston = require('winston');

const app = express();

// Configuration de Winston
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(({ timestamp, level, message }) => {
        return `${timestamp} [${level.toUpperCase()}]: ${message}`;
      })
    ),
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({ filename: 'data/logs/error.log', level: 'error' }),
      new winston.transports.File({ filename: 'data/logs/combined.log' })
    ],
  });
  
  // Intégration de Morgan avec Winston
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
  }));

// Sécurité avec helmet pour définir les headers HTTP sécurisés
const helmet = require('helmet');
app.use(helmet());

const db = require("./app/config/config.database");

const epilot_campaigns = require('./app/models/models.epilot_campaigns');
const epilot_insertions = require('./app/models/models.epilot_insertions');
const countries = require('./app/models/models.countries');
const sites = require('./app/models/models.sites');
const packs = require('./app/models/models.packs');
const packs_sites = require('./app/models/models.packs_sites');
const users = require('./app/models/models.users');
const roles = require('./app/models/models.roles');
const roles_users = require('./app/models/models.roles_users');
const campaigns = require('./app/models/models.campaigns');
const advertisers = require('./app/models/models.advertisers');
const campaigns_gam = require('./app/models/models.campaigns_gam');

const advertisers_users = require('./app/models/models.advertisers_users');
const agencies = require('./app/models/models.agencies');
const formats = require('./app/models/models.formats');

const formats_groups = require('./app/models/models.formats_groups');
const formats_groups_types = require(
    './app/models/models.formats_groups_types'
)
const formatstemplates = require("./app/models/models.formats_templates");
const formatssites = require("./app/models/models.formats_sites");
const insertions = require('./app/models/models.insertions');
const templates = require('./app/models/models.templates');
const insertions_templates = require('./app/models/models.insertions_templates');
const creatives = require('./app/models/models.creatives');
const insertions_status = require('./app/models/models.insertions_status');
const insertions_priorities = require('./app/models/models.insertions_priorities');
const creatives_types_formats = require('./app/models/models.creatives_types_formats');
const creatives_types = require('./app/models/models.creatives_types');
const campaigns_tv = require('./app/models/models.campaigns_tv');
const advertisers_tv = require('./app/models/models.advertisers_tv');

/* Mettre les relation ici */
/*sites.belongsTo(countries);
countries.hasMany(sites);*/

//un pack contient un site un site peut appartenir un à ou plusierus pack
packs.hasMany(packs_sites, {
    foreignKey: 'pack_id',
    onDelete: 'cascade',
    hooks: true
});
sites.hasMany(packs_sites, {
    foreignKey: 'site_id',
    onDelete: 'cascade',
    hooks: true
});

//un user posséde un role un role posséde un à plusieurs user
users.hasOne(roles_users, {
    foreignKey: 'user_id',
    onDelete: 'cascade',
    hooks: true
});
roles.hasMany(roles_users, {
    foreignKey: 'role_id',
    onDelete: 'cascade',
    hooks: true
});

//un user posséde un ou plusieurs annonceurs,  un role posséde un ou plusieurs users
users.hasOne(advertisers_users, {
    foreignKey: 'user_id',
    onDelete: 'cascade',
    hooks: true
});

advertisers.hasMany(advertisers_users, {
    foreignKey: 'advertiser_id',
    onDelete: 'cascade',
    hooks: true
});

//un format posséde un ou plusieur group un group posséde un à plusieur format
formats.hasMany(formats_groups_types, {
    foreignKey: 'format_id',
    onDelete: 'cascade',
    hooks: true
});
formats_groups.hasMany(formats_groups_types, {
    foreignKey: 'format_group_id',
    onDelete: 'cascade',
    hooks: true
});

formats_groups_types.belongsTo(formats, {
    foreignKey: 'format_id',
    onDelete: 'cascade',
    hooks: true
});

formats_groups_types.belongsTo(formats_groups, {
    foreignKey: 'format_group_id',
    onDelete: 'cascade',
    hooks: true
});

// un format posséde un ou plusieurs templates : un template posséde un à plusieurs formats

templates.hasMany(formatstemplates, {
    foreignKey: 'template_id',
    onDelete: 'cascade',
    hooks: true
});

formatstemplates.belongsTo(formats, {
    foreignKey: 'format_id',
    onDelete: 'cascade',
    hooks: true
});

formats.hasMany(formatstemplates, {
    foreignKey: 'format_id',
    onDelete: 'cascade',
    hooks: true
});

// un format posséde un ou plusieurs sites : un site posséde un à plusieurs formats

sites.hasMany(formatssites, {
    foreignKey: 'site_id',
    onDelete: 'cascade',
    hooks: true
});

formatssites.belongsTo(formats, {
    foreignKey: 'format_id',
    onDelete: 'cascade',
    hooks: true
});

formatssites.belongsTo(sites, {
    foreignKey: 'site_id',
    onDelete: 'cascade',
    hooks: true
});

formats.hasMany(formatssites, {
    foreignKey: 'format_id',
    onDelete: 'cascade',
    hooks: true
});

// un format_groups posséde un ou plusieurs creatives_types : un creatives_types posséde un à plusieurs format_groups
formats_groups.hasMany(creatives_types_formats, {
    foreignKey: 'format_group_id',
    onDelete: 'cascade',
    hooks: true
});
creatives_types_formats.belongsTo(formats_groups, {
    foreignKey: 'format_group_id',
    onDelete: 'cascade',
    hooks: true
});

creatives_types_formats.belongsTo(creatives_types, {
    foreignKey: 'creative_type_id',
    onDelete: 'cascade',
    hooks: true
});

creatives_types.hasMany(creatives_types_formats, {
    foreignKey: 'creative_type_id',
    onDelete: 'cascade',
    hooks: true
});

campaigns.belongsTo(advertisers, {
    foreignKey: 'advertiser_id',
  //  onDelete: 'cascade',
    hooks: true
});

advertisers.hasMany(campaigns, {
    foreignKey: 'advertiser_id',
  //  onDelete: 'cascade',
    hooks: true
});

campaigns_gam.belongsTo(campaigns, {
    foreignKey: 'campaign_id',
  //  onDelete: 'cascade',
    hooks: true
});

campaigns.hasMany(campaigns_gam, {
    foreignKey: 'campaign_id',
  //  onDelete: 'cascade',
    hooks: true
});

campaigns.belongsTo(agencies, {
    foreignKey: 'agency_id',
  //  onDelete: 'cascade',
    hooks: true
});
agencies.hasMany(campaigns, {
    foreignKey: 'agency_id',
  //  onDelete: 'cascade',
    hooks: true
});

insertions.belongsTo(campaigns, {
    foreignKey: 'campaign_id',
    onDelete: 'cascade',
    hooks: true
});

insertions.belongsTo(insertions_priorities, {
    foreignKey: 'priority_id',
    onDelete: 'cascade',
    hooks: true
});

insertions_status.hasMany(insertions, {
    foreignKey: 'insertion_status_id',
    onDelete: 'cascade',
    hooks: true
});
insertions.belongsTo(insertions_status, {
    foreignKey: 'insertion_status_id',
    onDelete: 'cascade',
    hooks: true
});

// la campagne a un format.
campaigns.hasMany(insertions, {
    foreignKey: 'campaign_id',
    onDelete: 'cascade',
    hooks: true
});

insertions.belongsTo(formats, {
    foreignKey: 'format_id',
    onDelete: 'cascade',
    hooks: true
});

// l'insertion a un format.
formats.hasMany(insertions, {
    foreignKey: 'format_id',
    onDelete: 'cascade',
    hooks: true
});

insertions_templates.belongsTo(insertions, {
    foreignKey: 'insertion_id',
    onDelete: 'cascade',
    hooks: true
});

insertions.hasMany(insertions_templates, {
    foreignKey: 'insertion_id',
    onDelete: 'cascade',
    hooks: true
});
insertions_templates.belongsTo(templates, {
    foreignKey: 'template_id',
    onDelete: 'cascade',
    hooks: true
});
templates.hasMany(insertions_templates, {
    foreignKey: 'template_id',
    onDelete: 'cascade',
    hooks: true
});

creatives.belongsTo(insertions, {
    foreignKey: 'insertion_id',
    onDelete: 'cascade',
    hooks: true
});
insertions.hasMany(creatives, {
    as: 'insertions',
    foreignKey: 'insertion_id',
    onDelete: 'cascade',
    hooks: true
});

epilot_campaigns.belongsTo(campaigns, {
    foreignKey: 'campaign_id',
    onDelete: 'cascade',
    hooks: true
});

epilot_campaigns.belongsTo(advertisers, {
    foreignKey: 'advertiser_id',
    onDelete: 'cascade',
    hooks: true
});

epilot_campaigns.belongsTo(users, {
    foreignKey: 'user_id',
    onDelete: 'cascade',
    hooks: true
});

epilot_campaigns.hasMany(epilot_insertions, {
    foreignKey: 'epilot_campaign_id',
    onDelete: 'cascade',
    hooks: true
});

epilot_insertions.belongsTo(epilot_campaigns, {
    foreignKey: 'epilot_campaign_id',
    onDelete: 'cascade',
    hooks: true
});

epilot_insertions.belongsTo(users, {
    foreignKey: 'user_id',
    onDelete: 'cascade',
    hooks: true
});

epilot_insertions.belongsTo(formats_groups, {
    foreignKey: 'format_group_id',
    onDelete: 'cascade',
    hooks: true
});

campaigns_tv.belongsTo(users, {
    foreignKey: 'user_id',
    onDelete: 'cascade',
    hooks: true
});

campaigns_tv.belongsTo(advertisers_tv, {
    foreignKey: 'advertiser_tv_id',
    onDelete: 'cascade',
    hooks: true
});

db
    .sequelize
    .sync();
sequelize = db.sequelize;
Sequelize = db.Sequelize;

// Déclare le nom de domaine et le port du site const hostname = '127.0.0.1';
// const port = '3000';

app.use((req, res, next) => {
    res.setHeader("Content-Security-Policy", 
        "default-src 'self'; " +
        "script-src 'self' https://www.googletagmanager.com https://ajax.googleapis.com https://cdn.jsdelivr.net/ 'unsafe-inline'; " +
        "style-src 'self' https://stackpath.bootstrapcdn.com https://cdnjs.cloudflare.com https://maxcdn.bootstrapcdn.com https://cdn.jsdelivr.net 'unsafe-inline'; " +
        "img-src 'self' https://antennesb.fr https://pa1.narvii.com;"
    );
    next();
});

/** view engine setup*/
app.use(cors());
app.use(bodyParser.json());
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(__dirname + '/public'));
app.set('view engine', 'ejs');
app.use(cookieParser());
app.use(cookieSession({
    name: 'BI_antennesb',
    keys: ['asq4b4PR'],
    maxAge: 2592000000 // 30 jours
}))
/**L'image à une limite min=50px max=2000px */
app.use(fileUpload());

app.use(express.static('public'));
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static('files'));

/*var phpScriptPath = "./api_google-manager/GetAllOrder.php";
runner.exec("php " + phpScriptPath + " " , function(err, phpResponse, stderr) {
 if(err) console.log(err); 
console.log( phpResponse );
});*/

/**
 * @MidleWare
 * UTILISATEUR CONNECTÉ
 */

app.get('/*', function (req, res, next) {
    res.locals.user = {}
    if (req.session.user) {

        res.locals.user.user_email = req.session.user.user_email;
        res.locals.user.user_role = req.session.user.user_role;

        //console.log(res.locals.user.user_email)
    }
    next();
});

app.post('/*', function (req, res, next) {
    res.locals.user = {}
    // nom de l'utilisateur connecté (dans le menu) accessible pour toutes les vues
    if (req.session.user) {
        res.locals.user.user_email = req.session.user.user_email;
        res.locals.user.user_role = req.session.user.user_role;
        //console.log(res.locals.user.user_email)
    }
    next();
});

//flash message middleware
app.use((req, res, next) => {
    res.locals.message = req.session.message
    delete req.session.message
    next()
})

app.post('/uploads', function (req) {
    console.log(req.files.file_csv.name); //requette.files.nom du file
});

app.use(express.static(path.join(__dirname, 'public')));

// signup login home page
const index = require('./app/routes/routes.index');
app.use('/', index);

// action admin forecast
const forecast = require('./app/routes/routes.api_forecast');
app.use('/forecast', forecast);

// action admin reporting
// const reporting = require('./app/routes/routes.api_report');
// app.use('/r/', reporting);
/*
// action liste campagne epilot
const epilot = require('./app/routes/routes.api_epilot');
app.use('/epilot', epilot);

// action user forecast
const user = require('./app/routes/routes.api_user');
app.use('/utilisateur', user);

// Créer des alerting
const alerts = require('./app/routes/routes.alerts');
app.use('/alerts', alerts);

const tests = require('./app/routes/routes.tests');
app.use('/test', tests);
*/
const application = require('./app/routes/routes.application');
app.use('/app', application);

// Gestion du reporting DIGITAL pour ARSB
const report_arsb = require('./app/routes/routes.arsb.report');
app.use('/r/', report_arsb);

/*
// Gestion du reporting DIGITAL
const reporting_rs = require('./app/routes/routes.reporting');
app.use('/r/', reporting_rs);

// Gestion du reporting DIGITAL 30j
const reporting_30 = require('./app/routes/routes.reporting_30');
app.use('/d/', reporting_30);
*/

// Gestion du reporting TV
const reportingTV = require('./app/routes/routes.tv.reporting');
app.use('/t/', reportingTV);

// Gestion du management
const manager = require('./app/routes/routes.manager');
app.use('/manager', manager);

// Gestion des alertes DIGITAL pour ARSB
const alerts = require('./app/routes/routes.arsb.alerts');
app.use('/alerts', alerts);

// Automatise la récupération de donnée
const automate = require('./app/routes/routes.arsb.automate');
app.use('/automate', automate);

const extention_chrome = require('./app/routes/routes.plugin_chrome');
app.use('/extension-chrome', extention_chrome);

const api = require('./app/routes/routes.json')
app.use('/api', api);

// Middleware de gestion des erreurs
app.use((err, req, res, next) => {
    logger.error(`Erreur: ${err.message}`);
    res.status(500).send('Une erreur interne est survenue');
  });
  
// Le serveur ecoute sur le port 3022
app.set("port", process.env.PORT || 3001);

app.listen(app.get("port"), () => {
    console.log(`server on port ${app.get("port")}`);
});