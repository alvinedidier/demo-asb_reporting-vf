// utils/mappingDbApi.js

// Mapping pour les champs de 'agency'
const agencyFieldMapping = {
    agency_id: 'id',                   // DB: agency_id -> API: id
    agency_name: 'name',               // DB: agency_name -> API: name
    agency_archived: 'isArchived',     // DB: agency_archived -> API: isArchived
    created_at: 'createdAt',           // DB: created_at -> API: createdAt (ce champ n'est pas dans l'API mais pourrait être utile)
    updated_at: 'updatedAt',           // DB: updated_at -> API: updatedAt (idem pour updatedAt)
};

// Mapping pour les champs de 'advertiser'
const advertiserFieldMapping = {
    advertiser_id: 'id',                   // DB: advertiser_id -> API: id
    advertiser_name: 'name',               // DB: advertiser_name -> API: name
    advertiser_archived: 'isArchived',     // DB: advertiser_archived -> API: isArchived
    agency_id: 'agencyId',                 // DB: agency_id -> API: agencyId (l'API ne renvoie pas ce champ mais on le garde ici pour une éventuelle utilisation)
    created_at: 'createdAt',               // DB: created_at -> API: createdAt (ce champ n'est pas dans l'API mais pourrait être utile)
    updated_at: 'updatedAt',               // DB: updated_at -> API: updatedAt (idem pour updatedAt)
};

// Mapping pour les champs de 'campaign'
const campaignFieldMapping = {
    campaign_id: 'id',
     advertiser_id: 'advertiserId',
    agency_id: 'agencyId',
    campaign_name: 'name',
    campaign_start_date: 'startDate',
    campaign_end_date: 'endDate',
    campaign_status_id: 'statusId',
    campaign_archived : 'archived', 
    campaign_crypt : 'campaign_crypt'
}

// Mapping pour les champs de 'insertion'
const insertionFieldMapping = {
    insertion_id: 'id',                          // DB: insertion_id -> API: id
    delivery_regulated: 'isDeliveryRegulated',    // DB: delivery_regulated -> API: isDeliveryRegulated
    used_guaranteed_deal: 'isUsedByGuaranteedDeal', // DB: used_guaranteed_deal -> API: isUsedByGuaranteedDeal
    used_non_guaranteed_deal: 'isUsedByNonGuaranteedDeal', // DB: used_non_guaranteed_deal -> API: isUsedByNonGuaranteedDeal
    voice_share: 'voiceShare',                    // DB: voice_share -> API: voiceShare
    event_id: 'eventId',                          // DB: event_id -> API: eventId
    insertion_name: 'name',                       // DB: insertion_name -> API: name
    insertion_description: 'description',         // DB: insertion_description -> API: description
    personalized_ad: 'isPersonalizedAd',          // DB: personalized_ad -> API: isPersonalizedAd
    pack_id: 'packIds',                           // DB: pack_id -> API: packIds
    insertion_status_id: 'insertionStatusId',     // DB: insertion_status_id -> API: insertionStatusId
    insertion_start_date: 'startDate',            // DB: insertion_start_date -> API: startDate
    insertion_end_date: 'endDate',                // DB: insertion_end_date -> API: endDate
    campaign_id: 'campaignId',                    // DB: campaign_id -> API: campaignId
    insertion_type_id: 'insertionTypeId',         // DB: insertion_type_id -> API: insertionTypeId
    delivery_type_id: 'deliveryTypeId',           // DB: delivery_type_id -> API: deliveryTypeId
    timezone_id: 'timezoneId',                    // DB: timezone_id -> API: timezoneId
    priority_id: 'priorityId',                    // DB: priority_id -> API: priorityId
    periodic_capping_id: 'periodicCappingPeriod', // DB: periodic_capping_id -> API: periodicCappingPeriod
    group_capping_id: 'groupCappingId',           // DB: group_capping_id -> API: groupCappingId
    max_impression: 'maxImpressions',             // DB: max_impression -> API: maxImpressions
    weight: 'weight',                             // DB: weight -> API: weight
    max_click: 'maxClicks',                       // DB: max_click -> API: maxClicks
    max_impression_perday: 'maxImpressionsPerDay', // DB: max_impression_perday -> API: maxImpressionsPerDay
    max_click_perday: 'maxClicksPerDay',          // DB: max_click_perday -> API: maxClicksPerDay
    insertion_groupe_volume: 'insertionGroupedVolumeId', // DB: insertion_groupe_volume -> API: insertionGroupedVolumeId
    event_impression: 'eventImpressions',         // DB: event_impression -> API: eventImpressions
    holistic_yield_enabled: 'isHolisticYieldEnabled', // DB: holistic_yield_enabled -> API: isHolisticYieldEnabled
    deliver_left_volume_after_end_date: 'deliverLeftVolumeAfterEndDate', // DB: deliver_left_volume_after_end_date -> API: deliverLeftVolumeAfterEndDate
    global_capping: 'globalCapping',              // DB: global_capping -> API: globalCapping
    capping_per_visit: 'cappingPerVisit',         // DB: capping_per_visit -> API: cappingPerVisit
    capping_per_click: 'cappingPerClick',         // DB: capping_per_click -> API: cappingPerClick
    auto_capping: 'autoCapping',                  // DB: auto_capping -> API: autoCapping
    periodic_capping_impression: 'periodicCappingImpressions', // DB: periodic_capping_impression -> API: periodicCappingImpressions
    oba_icon_enabled: 'isObaIconEnabled',         // DB: oba_icon_enabled -> API: isObaIconEnabled
    format_id: 'formatId',                        // DB: format_id -> API: formatId
    external_id: 'externalId',                    // DB: external_id -> API: externalId
    external_description: 'externalDescription',  // DB: external_description -> API: externalDescription
    insertion_updated_at: 'updatedAt',            // DB: insertion_updated_at -> API: updatedAt
    insertion_created_at: 'createdAt',            // DB: insertion_created_at -> API: createdAt
    insertion_archived: 'isArchived',             // DB: insertion_archived -> API: isArchived
    rate_type_id: 'rateTypeId',                   // DB: rate_type_id -> API: rateTypeId
    rate: 'rate',                                 // DB: rate -> API: rate
    rate_net: 'rateNet',                          // DB: rate_net -> API: rateNet
    discount: 'discount',                         // DB: discount -> API: discount
    currency_id: 'currencyId',                    // DB: currency_id -> API: currencyId
    insertion_link_id: 'insertionLinkId',         // DB: insertion_link_id -> API: insertionLinkId
    customized_script: 'customizedScript',        // DB: customized_script -> API: customizedScript
    sale_channel_id: 'salesChannelId'             // DB: sale_channel_id -> API: salesChannelId
  };
  
module.exports = {    
    agencyFieldMapping,
    advertiserFieldMapping,
    campaignFieldMapping,
    insertionFieldMapping,
};
