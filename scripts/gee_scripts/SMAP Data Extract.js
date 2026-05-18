// Load your uploaded Wayanad shapefile asset
var wayanad = ee.FeatureCollection('projects/ee-ce23resch11016/assets/ISRO_Wayanad_District_BDY');
var geometry = wayanad.geometry();
// Add layers to the map
Map.centerObject(wayanad, 10);
// Add a transparent boundary for Wayanad for clearer visualization
Map.addLayer(wayanad, {color: 'grey', fillColor: '00000000'}, 'Wayanad Transparent Boundary');

var wayanadBorder =
    ee.Image().byte().paint({featureCollection: wayanad, color: 1, width: 3});
    
Map.addLayer(wayanadBorder, null, 'Wayanad Border');

var endYear = 2024;
var endYear1 = endYear;
var month = 1;
var month1 = month+1;
if (month === 12) {
  endYear1 = endYear + 1;
  month1 = 1; // Reset month to January of the next year
}
// Soil Moisture Data (SMAP)
var smapDataset = ee.ImageCollection("NASA/SMAP/SPL4SMGP/007")
                    .filterDate(endYear+'-'+month+'-01', endYear1+'-'+month1+'-01') 
                    .filterBounds(wayanad)
                    .select(["sm_surface", "sm_rootzone"]);

// Interpolation to higher resolution (optional)
var scale = 100; 
//Exporting monthly means one by one to further create a mean for whole endYear
/*

smapDataset = smapDataset.map(function(image) {
  return image.resample('bilinear').reproject({
    crs: image.projection(),
    scale: scale
  });
});

// Add daily dates to the dataset
smapDataset = smapDataset.map(function(image) {
    var dailyDate = image.date().format('YYYY-MM-dd');
    return image.set('daily_date', dailyDate);
});

print(smapDataset)

// Create a list of unique daily dates
var dailyDates = smapDataset.map(function(image) {
    var dailyDate = image.date().format('YYYY-MM-dd');
    return image.set('daily_date', dailyDate);
  })
  .aggregate_array('daily_date')
  .distinct();

print(dailyDates)

// Group and aggregate daily images
var dailySmap = ee.ImageCollection(dailyDates.map(function(dailyDate) {
  var imagesForDay = smapDataset.filter(ee.Filter.eq('daily_date', dailyDate));
  var dailyMosaic = imagesForDay.mosaic().set('date', dailyDate);
  return dailyMosaic;
}));

// Print the result to verify
print('Daily SMAP Dataset', dailySmap);

// Calculate the mean across all days in the daily dataset
var meanDataset = dailySmap.reduce(ee.Reducer.mean());

// Print the result to verify
print('Mean Soil Moisture Dataset', meanDataset);

// Export the daily image to an Earth Engine Asset
Export.image.toAsset({
  image: meanDataset,
  description: 'Mean_SMAP_endYear_' + endYear +'_Month_' + month,
  assetId: 'projects/ee-ce23resch11016/assets/Smap/Mean_SMAP_Year_' + endYear +'_Month_' + month, // Modify the assetId path
  region: wayanad.geometry(),
  scale: scale,
  maxPixels: 1e13
});

Map.addLayer(meanDataset.select("sm_surface_mean").clip(wayanad), 
             {min: 0, max: 0.5, palette: ['blue', 'green', 'yellow', 'red']}, 
             'Mean Surface Soil Moisture');
Map.addLayer(meanDataset.select("sm_rootzone_mean").clip(wayanad), 
             {min: 0, max: 0.5, palette: ['blue', 'green', 'yellow', 'red']}, 
             'Mean Root Zone Soil Moisture');
*/



//Using the the exported monthly means to create annual mean

// Define the paths to your monthly mean assets (adjust these paths as needed)
var monthlyMeanPaths = [
  'projects/ee-ce23resch11016/assets/Smap/Mean_SMAP_Year_'+endYear+'_Month_1',
  'projects/ee-ce23resch11016/assets/Smap/Mean_SMAP_Year_'+endYear+'_Month_2',
  'projects/ee-ce23resch11016/assets/Smap/Mean_SMAP_Year_'+endYear+'_Month_3',
  'projects/ee-ce23resch11016/assets/Smap/Mean_SMAP_Year_'+endYear+'_Month_4',
  'projects/ee-ce23resch11016/assets/Smap/Mean_SMAP_Year_'+endYear+'_Month_5',
  'projects/ee-ce23resch11016/assets/Smap/Mean_SMAP_Year_'+endYear+'_Month_6',
  'projects/ee-ce23resch11016/assets/Smap/Mean_SMAP_Year_'+endYear+'_Month_7',
  'projects/ee-ce23resch11016/assets/Smap/Mean_SMAP_Year_'+endYear+'_Month_8',
  'projects/ee-ce23resch11016/assets/Smap/Mean_SMAP_Year_'+endYear+'_Month_9',
  'projects/ee-ce23resch11016/assets/Smap/Mean_SMAP_Year_'+endYear+'_Month_10',
  'projects/ee-ce23resch11016/assets/Smap/Mean_SMAP_Year_'+endYear+'_Month_11',
  'projects/ee-ce23resch11016/assets/Smap/Mean_SMAP_Year_'+endYear+'_Month_12'
];

// Create an ImageCollection from the monthly mean images
var monthlyMeanCollection = ee.ImageCollection(monthlyMeanPaths.map(function(path) {
  return ee.Image(path);  // Load each monthly mean image as an ee.Image
}));

// Calculate the annual mean by reducing over the ImageCollection
var annualMean = monthlyMeanCollection.reduce(ee.Reducer.mean());

// Rename the bands in the annualMean image
annualMean = annualMean.rename(['sm_surface', 'sm_rootzone']);

// Print the result to verify
print('Annual Mean of SMAP Data for '+endYear+':', annualMean);

// Export the annual mean image to an Earth Engine Asset
Export.image.toAsset({
  image: annualMean,
  description: 'Annual_SMAP_Mean_Year_' + endYear,
  assetId: 'projects/ee-ce23resch11016/assets/SMAP_AnnualMean/Annual_SMAP_Mean_Year_' + endYear, // Modify the assetId path
  region: wayanad.geometry(),
  scale: scale,  // Adjust scale as needed
  maxPixels: 1e13
});


//----------------------------------
/*
var soilMoisture = ee.Image('projects/ee-ce23resch11016/assets/SMAP_AnnualMean/Annual_SMAP_Mean_Year_' + endYear).select('sm_rootzone');

// Calculate statistics for the reprojected image
var soilMoistureStats = soilMoisture.reduceRegion({
  reducer: ee.Reducer.minMax(),
  geometry: wayanad,
  scale: scale,
  maxPixels: 1e9
});

print('Rootzone Soil Moisture Image Min/Max:', soilMoistureStats);

// Define min and max values for normalization (Rootzone Soil Moisture)
var minSM = 0.2555464804172516
var maxSM = 0.34509581327438354

// Normalize the rootzone soil moisture
var normalizedSM = soilMoisture.subtract(minSM)
  .divide(maxSM - minSM);


// Classify normalized rootzone soil moisture into categories
var SMClasses = ee.Image(0)
  .where(normalizedSM.lt(0.2), 1)    // Very dry (Blue): 0.0 - 0.2
  .where(normalizedSM.gte(0.2).and(normalizedSM.lt(0.4)), 2)    // Dry (Cyan): 0.2 - 0.4
  .where(normalizedSM.gte(0.4).and(normalizedSM.lt(0.6)), 3)    // Moderate moisture (Green): 0.4 - 0.6
  .where(normalizedSM.gte(0.6).and(normalizedSM.lt(0.8)), 4)    // Wet (Yellow): 0.6 - 0.8
  .where(normalizedSM.gte(0.8).and(normalizedSM.lte(1.0)), 5)  // Very wet (Orange/Red): 0.8 - 1.0
  .unmask(0); // Ensure no unclassified pixels remain as 0

// Visualization parameters for classified rootzone soil moisture
var classifiedRootzoneVis = {
  min: 1,
  max: 5,
  palette: ['#0000FF', '#00FFFF', '#00FF00', '#FFFF00', '#FFA500', '#FF0000'], // Enhanced palette
  // Categories:
  // 1: #0000FF (Blue - Very Dry)
  // 2: #00FFFF (Cyan - Dry)
  // 3: #00FF00 (Green - Moderate)
  // 4: #FFFF00 (Yellow - Wet)
  // 5: #FFA500/#FF0000 (Orange/Red - Very Wet)
};

// Add classified rootzone soil moisture layer
Map.addLayer(SMClasses.clip(wayanad), classifiedRootzoneVis, 'Classified Normalized Rootzone Soil Moisture', false);


Export.image.toDrive({
    image: SMClasses.clip(wayanad),
    description: endYear+'_Classified_Normalized_Rootzone_Soil_Moisture',
    fileNamePrefix: endYear+' Classified Normalized Rootzone Soil Moisture',
    region: geometry,
    scale: 30,
    folder: 'Wayanad_Exports',
    maxPixels: 1e13
});
*/

// ==========================




/*

// Function to load and clip mean surface soil moisture data for a specific year
function getMeanSurfaceSoilMoisture(year) {
  var soilMoisture = ee.Image('projects/ee-ce23resch11016/assets/SMAP_AnnualMean/Annual_SMAP_Mean_Year_' + year).select('sm_surface');
  return soilMoisture.clip(wayanad);
}

// Function to load and clip mean rootzone soil moisture data for a specific year
function getMeanRootSoilMoisture(year) {
  var soilMoisture = ee.Image('projects/ee-ce23resch11016/assets/SMAP_AnnualMean/Annual_SMAP_Mean_Year_' + year).select('sm_rootzone');
  return soilMoisture.clip(wayanad);
}

// Years for which soil moisture data is available
var years = [endYear-3,endYear-2,endYear-1,endYear];
//var years = [endYear];
print(years)

// Combine surface soil moisture data for all years
var surfaceSoilMoistureImages = years.map(function(year) {
  return getMeanSurfaceSoilMoisture(year);
});

// Compute the average surface soil moisture across all years
var surfaceSoilMoistureAllYears = ee.ImageCollection(surfaceSoilMoistureImages).mean().rename('surface_soil_moisture');

// Combine rootzone soil moisture data for all years
var rootzoneSoilMoistureImages = years.map(function(year) {
  return getMeanRootSoilMoisture(year);
}); 

// Compute the average rootzone soil moisture across all years
var rootzoneSoilMoistureAllYears = ee.ImageCollection(rootzoneSoilMoistureImages).mean().rename('rootzone_soil_moisture');

// Calculate min and max for surface soil moisture (all years)
var surfaceStatsAllYears = surfaceSoilMoistureAllYears.reduceRegion({
  reducer: ee.Reducer.minMax(),
  geometry: wayanad,
  scale: scale, // Adjust scale based on dataset resolution
  maxPixels: 1e9
});

// Calculate min and max for rootzone soil moisture (all years)
var rootzoneStatsAllYears = rootzoneSoilMoistureAllYears.reduceRegion({
  reducer: ee.Reducer.minMax(),
  geometry: wayanad,
  scale: scale,
  maxPixels: 1e9
});

// Print the statistics
print('Surface Soil Moisture Min/Max:', surfaceStatsAllYears);
print('Rootzone Soil Moisture Min/Max:', rootzoneStatsAllYears);

// Visualization parameters for surface soil moisture
var surfaceSoilMoistureVis = {
  min: 0.23036643862724304, // Adjust based on the calculated range
  max: 0.3276948928833008, // Adjust based on the calculated range
  palette: ['blue', 'cyan', 'green', 'yellow', 'orange', 'red'] // Enhanced palette
};

// Visualization parameters for rootzone soil moisture
var rootzoneSoilMoistureVis = {
  min: 0.26242706179618835, // Adjust based on the calculated range
  max: 0.3530060052871704, // Adjust based on the calculated range
  palette: ['#0000FF', '#00FFFF', '#00FF00', '#FFFF00', '#FFA500', '#FF0000'] // Enhanced palette
};

// Add mean surface soil moisture layer to the map
Map.addLayer(surfaceSoilMoistureAllYears.clip(wayanad), surfaceSoilMoistureVis, 'Mean Surface Soil Moisture', false);

// Add mean rootzone soil moisture layer to the map
Map.addLayer(rootzoneSoilMoistureAllYears.clip(wayanad), rootzoneSoilMoistureVis, 'Mean Rootzone Soil Moisture', false);

// Define min and max values for normalization (Surface Soil Moisture)
var minSurfaceSoilMoisture = 0.23036643862724304;  // Minimum surface soil moisture (2020–2023)
var maxSurfaceSoilMoisture = 0.3276948928833008;  // Maximum surface soil moisture (2020–2023)

// Normalize the surface soil moisture
var normalizedSurfaceSoilMoisture = surfaceSoilMoistureAllYears.subtract(minSurfaceSoilMoisture)
  .divide(maxSurfaceSoilMoisture - minSurfaceSoilMoisture);

// Classify normalized surface soil moisture into categories
var surfaceSoilMoistureClasses = ee.Image(0)
  .where(normalizedSurfaceSoilMoisture.lt(0.2), 1)  // Very dry (Blue): 0.0 - 0.2
  .where(normalizedSurfaceSoilMoisture.gte(0.2).and(normalizedSurfaceSoilMoisture.lt(0.4)), 2)  // Dry (Cyan): 0.2 - 0.4
  .where(normalizedSurfaceSoilMoisture.gte(0.4).and(normalizedSurfaceSoilMoisture.lt(0.6)), 3)  // Moderate moisture (Green): 0.4 - 0.6
  .where(normalizedSurfaceSoilMoisture.gte(0.6).and(normalizedSurfaceSoilMoisture.lt(0.8)), 4)  // Wet (Yellow): 0.6 - 0.8
  .where(normalizedSurfaceSoilMoisture.gte(0.8), 5);  // Very wet (Orange/Red): 0.8 - 1.0

// Define min and max values for normalization (Rootzone Soil Moisture)
var minRootzoneSoilMoisture = 0.26242706179618835;  // Minimum rootzone soil moisture (2020–2023)
var maxRootzoneSoilMoisture = 0.3530060052871704;  // Maximum rootzone soil moisture (2020–2023)

// Normalize the rootzone soil moisture
var normalizedRootzoneSoilMoisture = rootzoneSoilMoistureAllYears.subtract(minRootzoneSoilMoisture)
  .divide(maxRootzoneSoilMoisture - minRootzoneSoilMoisture);

// Classify normalized rootzone soil moisture into categories
var rootzoneSoilMoistureClasses = ee.Image(0)
  .where(normalizedRootzoneSoilMoisture.lt(0.2), 1)  // Very dry (Blue): 0.0 - 0.2
  .where(normalizedRootzoneSoilMoisture.gte(0.2).and(normalizedRootzoneSoilMoisture.lt(0.4)), 2)  // Dry (Cyan): 0.2 - 0.4
  .where(normalizedRootzoneSoilMoisture.gte(0.4).and(normalizedRootzoneSoilMoisture.lt(0.6)), 3)  // Moderate moisture (Green): 0.4 - 0.6
  .where(normalizedRootzoneSoilMoisture.gte(0.6).and(normalizedRootzoneSoilMoisture.lt(0.8)), 4)  // Wet (Yellow): 0.6 - 0.8
  .where(normalizedRootzoneSoilMoisture.gte(0.8), 5);  // Very wet (Orange/Red): 0.8 - 1.0

// Visualization parameters for classified surface soil moisture
var classifiedSurfaceVis = {
  min: 1,
  max: 5,
  palette: ['blue', 'cyan', 'green', 'yellow', 'orange', 'red'], // Enhanced palette
  // Categories:
  // 1: Blue (Very Dry)
  // 2: Cyan (Dry)
  // 3: Green (Moderate)
  // 4: Yellow (Wet)
  // 5: Orange/Red (Very Wet)
};

// Visualization parameters for classified rootzone soil moisture
var classifiedRootzoneVis = {
  min: 1,
  max: 5,
  palette: ['#0000FF', '#00FFFF', '#00FF00', '#FFFF00', '#FFA500', '#FF0000'], // Enhanced palette
  // Categories:
  // 1: #0000FF (Blue - Very Dry)
  // 2: #00FFFF (Cyan - Dry)
  // 3: #00FF00 (Green - Moderate)
  // 4: #FFFF00 (Yellow - Wet)
  // 5: #FFA500/#FF0000 (Orange/Red - Very Wet)
};

// Add classified surface soil moisture layer
Map.addLayer(surfaceSoilMoistureClasses.clip(wayanad), classifiedSurfaceVis, 'Classified Normalized Surface Soil Moisture', false);

// Add classified rootzone soil moisture layer
Map.addLayer(rootzoneSoilMoistureClasses.clip(wayanad), classifiedRootzoneVis, 'Classified Normalized Rootzone Soil Moisture', false);

Export.image.toDrive({
    image: surfaceSoilMoistureClasses.clip(wayanad),
    description: 'Combined_'+endYear+'_Classified_Normalized_Surface_Soil_Moisture',
    fileNamePrefix: 'Combined '+endYear+' Classified Normalized Surface Soil Moisture',
    region: geometry,
    scale: 30,
    folder: 'Wayanad_Exports',
    maxPixels: 1e13
});
Export.image.toDrive({
    image: rootzoneSoilMoistureClasses.clip(wayanad),
    description: 'Combined_'+endYear+'_Classified_Normalized_Rootzone_Soil_Moisture',
    fileNamePrefix: 'Combined '+endYear+' Classified Normalized Rootzone Soil Moisture',
    region: geometry,
    scale: 30,
    folder: 'Wayanad_Exports',
    maxPixels: 1e13
});
*/
