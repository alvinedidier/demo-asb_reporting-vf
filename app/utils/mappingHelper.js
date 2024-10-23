// utils/mappingHelper.js

const mapApiFieldsToDb = (apiData, mapping) => {
    const dbData = {};
    Object.keys(mapping).forEach((dbField) => {
        const apiField = mapping[dbField];
        dbData[dbField] = apiData[apiField];
    });
    return dbData;
};

module.exports = {
    mapApiFieldsToDb,
};