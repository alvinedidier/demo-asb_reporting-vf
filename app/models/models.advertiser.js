const Sequelize = require('sequelize');


const sequelize = require('../config/_config.database').sequelize;


const Advertisers = sequelize.define('advertisers', {

    advertiser_id: {type: Sequelize.INTEGER, autoIncrement:true, primaryKey:true },
    advertiser_name: {type: Sequelize.STRING(),allowNull:false},


},
{tableName: 'asb_advertisers', underscored: true, timestamps: false}
);

module.exports = Advertisers;