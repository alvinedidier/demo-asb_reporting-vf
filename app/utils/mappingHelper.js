// utils/mappingHelper.js

const mapApiFieldsToDb = (apiData, fieldMapping) => {
    const mappedData = {};
    for (const [dbField, apiField] of Object.entries(fieldMapping)) {
        if (apiData.hasOwnProperty(apiField)) {
            mappedData[dbField] = apiData[apiField];
        }
    }
    return mappedData;
};

module.exports = {
    mapApiFieldsToDb,
};