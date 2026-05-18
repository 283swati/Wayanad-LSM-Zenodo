var wayanad = ee.FeatureCollection('projects/ee-ce23resch11016/assets/ISRO_Wayanad_District_BDY');
var geometry = wayanad.geometry();
var combinedDEMTile = ee.Image('projects/ee-ce23resch11016/assets/merged_cdnc43d_cdnc43e');
var endYear = 2024;
var elevation = combinedDEMTile.rename('elevation'); // Rename the DEM band to 'elevation' instead of 'b1'
var slope = ee.Terrain.slope(elevation);
var aspect = ee.Terrain.aspect(elevation);
Map.centerObject(wayanad, 10);
Map.addLayer(wayanad, {color: 'grey', fillColor: '00000000'}, 'Wayanad Transparent Boundary');
var wayanadBorder =
    ee.Image().byte().paint({featureCollection: wayanad, color: 1, width: 3});
Map.addLayer(wayanadBorder, null, 'Wayanad Border');
var hillshade = ee.Terrain.hillshade(elevation);
var slopeC = ee.Terrain.slope(combinedDEMTile);
var focalMeanSlope = slopeC.convolve(ee.Kernel.circle(3, 'pixels', true));
var curvature = slopeC.subtract(focalMeanSlope);
var hillshadeStats = hillshade.reduceRegion({
  reducer: ee.Reducer.minMax(),
  geometry: wayanad,
  scale: 30,
  maxPixels: 1e9
});
var minHillshade = hillshadeStats.get('hillshade_min');
var maxHillshade = hillshadeStats.get('hillshade_max');
var hillshadeVis = {
  min: ee.Number(minHillshade).getInfo(),
  max: ee.Number(maxHillshade).getInfo(),
  palette: ['black', 'white'] // You can adjust the palette as needed
};
Map.addLayer(hillshade.clip(wayanad), hillshadeVis, 'Dynamic Hillshade', true, 0.4); // Opacity set to 0.5 (50%)
var reliefClasses = ee.Image('projects/ee-ce23resch11016/assets/Relief_Classes');
var dw = ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1');
var startDate = '2024-01-01';
var endDate = '2024-10-01';
var dynamicWorld = dw.filterDate(startDate, endDate)
                     .filterBounds(wayanad);
var dwImage = dynamicWorld.median().clip(wayanad);
var classNames = [
  'Water', 'Trees', 'Grass', 'Flooded Vegetation', 'Crops', 'Shrub', 
  'Built Area', 'Bare Ground', 'Snow/Ice'
];
var landcoverPalette = [
  '#ADD8E6', // Water: Light Blue
  '#006400', // Trees: Dark Green
  '#808000', // Grass: Olive Green
  '#FFA500', // Flooded Vegetation: Orange
  '#FFFF00', // Crops: Yellow
  '#90EE90', // Shrub: Light Green
  '#FFC0CB', // Built Area: Pink
  '#696969', // Bare Ground: Dark Grey
  '#E6E6FA'  // Snow/Ice: Light Purple
];
var scale = 100; // Approx. 0.01 degrees at the equator
//Exported Interpolated NASA SMAP Global Soil Moisture 3 hourly data into daily mean data
//and then using it again as asset, for efficiency.
// Function to load and clip mean rootzone soil moisture data for a specific year
function getMeanRootSoilMoisture(year) {
  var soilMoisture = ee.Image('projects/ee-ce23resch11016/assets/SMAP_AnnualMean/Annual_SMAP_Mean_Year_' + year).select('sm_rootzone');
  return soilMoisture.clip(wayanad);
}
// Years for which soil moisture data is available
var years = [endYear-3,endYear-2,endYear-1,endYear];
print(years)
// Combine rootzone soil moisture data for all years
var rootzoneSoilMoistureImages = years.map(function(year) {
  return getMeanRootSoilMoisture(year);
});
// Compute the average rootzone soil moisture across all years
var rootzoneSoilMoistureAllYears = ee.ImageCollection(rootzoneSoilMoistureImages).mean().rename('rootzone_soil_moisture');
//Daily Rainfall
// Function to load and clip mean rainfall data for a specific year
function getMeanRainfallData(year) {
  var rainfall = ee.Image('projects/ee-ce23resch11016/assets/IMD/' + year + 'mean_rainfall_100m');
  return rainfall.clip(wayanad);
}
// Years for which data is available
var years = [endYear-3,endYear-2,endYear-1,endYear];
print(years)
// Load and combine mean rainfall data for all years
var meanRainfallImages = years.map(function(year) {
  return getMeanRainfallData(year);
});
// Compute the average of the mean rainfall across all years
var IMDRainMeanAllYears = ee.ImageCollection(meanRainfallImages).mean().rename('precipitation');

var geology = ee.FeatureCollection('projects/ee-ce23resch11016/assets/Bhukosh_Assets/Geology_2M_Bhukosh');
geology = geology.filterBounds(geometry);
var geomorphology = ee.FeatureCollection('projects/ee-ce23resch11016/assets/Bhukosh_Assets/Geomorphology_250K_Bhukosh');
geomorphology = geomorphology.filterBounds(geometry);
var lithology = ee.FeatureCollection('projects/ee-ce23resch11016/assets/Bhukosh_Assets/Lithology_Bhukosh');
lithology = lithology.filterBounds(geometry);

//Landslide Points
// Load the landslide points shapefile asset and clip to Wayanad boundaries
var landslidePoints = ee.FeatureCollection('projects/ee-ce23resch11016/assets/Points2018comb2019/Landslide2018comb2019Gemini')
                          .filterBounds(geometry);
// Define the range of years
var startYear = 2018;
var currentYear = endYear; // Assuming endYear is defined elsewhere as the current year
var trainingEndYear = currentYear - 1; // Training data goes up to previous year
// Generate a list of years as strings for training (up to previous year)
var trainingYears = [];
for (var year = startYear; year <= trainingEndYear; year++) {
  trainingYears.push(year.toString());
}
// Generate a list of years as strings for all years (including current year)
var allYears = [];
for (var year = startYear; year <= currentYear; year++) {
  allYears.push(year.toString());
}
// Filter landslide points for training (up to previous year)
var landslidePointsTraining = landslidePoints.filter(ee.Filter.inList('Year', trainingYears));
// Filter landslide points for current year only
var landslidePointsCurrentYear = landslidePoints.filter(ee.Filter.eq('Year', currentYear.toString()));
// Filter all landslide points (for reference)
var landslidePointsAll = landslidePoints.filter(ee.Filter.inList('Year', allYears));
// Print information about the data splits
print('Training Years:', trainingYears);
print('Current Year:', currentYear);
print('Landslide Points for Training (Years ' + startYear + ' to ' + trainingEndYear + '):', landslidePointsTraining);
print('Landslide Points for Current Year (' + currentYear + '):', landslidePointsCurrentYear);
print('Total Landslide Points (All Years):', landslidePointsAll);
// Add the landslide points layers to the map
Map.addLayer(landslidePointsTraining, {color: 'red'}, 'Training Landslide Points', false);
Map.addLayer(landslidePointsCurrentYear, {color: 'orange'}, 'Current Year Landslide Points', false);
//QGIS Created Non-Landslide Points
// Load the non-landslide points shapefile asset and clip to Wayanad boundaries
var nonLandslidePoints = ee.FeatureCollection('projects/ee-ce23resch11016/assets/Points2018comb2019/Non-Landslide2018comb2019Gemini')
                          .filterBounds(geometry);

var elevation = elevation.reproject('EPSG:4326', null, 30).rename('elevation_class')
var slope = ee.Terrain.slope(elevation);
var slope = slope.reproject('EPSG:4326', null, 30).rename('slope_class')
var aspect = ee.Terrain.aspect(elevation);
var aspect = aspect.reproject('EPSG:4326', null, 30).rename('aspect_class')
curvature = curvature.reproject('EPSG:4326', null, 30).rename('curvature_class')
var reliefClasses = reliefClasses.reproject('EPSG:4326', null, 30).rename('classifiedRelief_class')
var lulcClass = dwImage.select('label').add(1).reproject('EPSG:4326', null, 30).rename('landcover_class');
var rootzoneSoilMoisture = rootzoneSoilMoistureAllYears.reproject('EPSG:4326', null, 30).rename('rootzone_moisture_class');
var IMDRainMean = IMDRainMeanAllYears.reproject('EPSG:4326', null, 30).rename('mean_rainfall_class');
var geologyCategories = geology.aggregate_array('STRATIGRAP').distinct();
var geologyCategoryDict = ee.Dictionary.fromLists(geologyCategories, ee.List.sequence(1, geologyCategories.size()));
var geologyWithCodes = geology.map(function(feature) {
  var category = ee.String(feature.get('STRATIGRAP')).trim();
  var code = geologyCategoryDict.get(category);  // Get the unique code from dictionary
  return feature.set('category_code', code);  // Add code as a property
});
var geologyImage = geologyWithCodes.reduceToImage({
  properties: ['category_code'],
  reducer: ee.Reducer.first()
}).reproject('EPSG:4326', null, 30).rename('geology_class');
var lithologyCategories = lithology.aggregate_array('STRATIGRAP').distinct();
var lithologyCategoryDict = ee.Dictionary.fromLists(lithologyCategories, ee.List.sequence(1, lithologyCategories.size()));
var lithologyWithCodes = lithology.map(function(feature) {
  var category = ee.String(feature.get('STRATIGRAP')).trim();
  var code = lithologyCategoryDict.get(category);  // Get the unique code from dictionary
  return feature.set('category_code', code);  // Add code as a property
});
var lithologyImage = lithologyWithCodes.reduceToImage({
  properties: ['category_code'],
  reducer: ee.Reducer.first()
}).reproject('EPSG:4326', null, 30).rename('lithology_class');
var geomorphologyCategories = geomorphology.aggregate_array('DESCRIPTIO').distinct();
var geomorphologyCategoryDict = ee.Dictionary.fromLists(geomorphologyCategories, ee.List.sequence(1, geomorphologyCategories.size()));
var geomorphologyWithCodes = geomorphology.map(function(feature) {
  var category = ee.String(feature.get('DESCRIPTIO')).trim();
  var code = geomorphologyCategoryDict.get(category);  // Get the unique code from dictionary
  return feature.set('category_code', code);  // Add code as a property
});
var geomorphologyImage = geomorphologyWithCodes.reduceToImage({
  properties: ['category_code'],
  reducer: ee.Reducer.first()
}).reproject('EPSG:4326', null, 30).rename('geomorphology_class');
var flowaccumulation = ee.Image("MERIT/Hydro/v1_0_1").select('upa')
                    .log() // Log-transform for visualization
                    .clip(geometry) // Clip to Wayanad geometry
                    .reproject('EPSG:4326', null, 30)
                    .rename('FWACC');
var hand = ee.Image("users/gena/GlobalHAND/30m/hand-1000")
            .clip(geometry)
            .reproject('EPSG:4326', null, 30)
            .rename('HAND');
var meanTPI = elevation.focalMean(5, 'square'); // Note: elevation_extend should be defined in your workspace
var tpi = elevation.subtract(meanTPI)  // Subtract focal mean from elevation
           .reproject('EPSG:4326', null, 30)
           .rename('mTPI')
           .clip(geometry);
var rivers = ee.Image("MERIT/Hydro/v1_0_1").select('upa')
              .clip(geometry)
              .gt(0.5);  // Threshold for river network
var maxDistM = 7500;  // Maximum distance in meters
var euclideanKernel = ee.Kernel.euclidean(maxDistM, 'meters');
var hdtp = rivers.distance(euclideanKernel) // Calculate distance to river network
           .reproject('EPSG:4326', null, 30)
           .rename('HDND');
var hillshade = ee.Terrain.hillshade(elevation, 90, 45).rename('HLSH')
var hillshade = hillshade.reproject('EPSG:4326', null, 30)

var combinedLSMFactors = slope.addBands(aspect).addBands(elevation)
                    .addBands(hillshade).addBands(curvature)
                    //.addBands(localRelief)
                    .addBands(reliefClasses)
                    .addBands(lulcClass)
                    .addBands(rootzoneSoilMoisture)
                    .addBands(IMDRainMean)
                    .addBands(geologyImage)
                    .addBands(geomorphologyImage)
                    .addBands(lithologyImage)
                    .addBands(hand)
                    .addBands(flowaccumulation)
                    .addBands(tpi)
                    .addBands(hdtp)


// ========== DATA PREPARATION SECTION ==========
// Label non-landslide points with 'landslide' = 0
nonLandslidePoints = nonLandslidePoints.map(function(pt) {
  return pt.set('landslide', 0);
});
// Label training landslide points (up to previous year) with 'landslide' = 1
var labeledTrainingLandslidePoints = landslidePointsTraining.map(function(pt) {
  return pt.set('landslide', 1);
});
// Label current year landslide points with 'landslide' = 1
var labeledCurrentYearLandslidePoints = landslidePointsCurrentYear.map(function(pt) {
  return pt.set('landslide', 1);
});
// Create training points collection (historical landslide + non-landslide points)
var trainingPoints = labeledTrainingLandslidePoints.merge(nonLandslidePoints);
// Extract the values from the input data for training points
var trainingDataHistorical = combinedLSMFactors.reduceRegions({
  collection: trainingPoints,
  reducer: ee.Reducer.mean(),
  scale: 30
});
// Extract the values from the input data for current year landslide points
var currentYearData = combinedLSMFactors.reduceRegions({
  collection: labeledCurrentYearLandslidePoints,
  reducer: ee.Reducer.mean(),
  scale: 30
});
// Filter out null values from the historical training data
var trainingDataClean = trainingDataHistorical.randomColumn('random');
var trainingDataNoNulls = trainingDataClean.filter(ee.Filter.notNull(['landslide']));
// Filter out null values from current year data
var currentYearDataClean = currentYearData.filter(ee.Filter.notNull(['landslide']));
// Split historical data into training and testing (70% train, 30% test)
var training = trainingDataNoNulls.filter(ee.Filter.lte('random', 0.7));
var testingHistorical = trainingDataNoNulls.filter(ee.Filter.gt('random', 0.7));
// Combine historical testing data with current year data for final testing
var acurracy_evaluation = testingHistorical.merge(currentYearDataClean);
// Print statistics about the data splits
print('=== DATA SPLIT STATISTICS ===');
print('Training Data Class Distribution:', training.aggregate_histogram('landslide'));
print('Historical Testing Data Class Distribution:', testingHistorical.aggregate_histogram('landslide'));
print('Current Year Data Class Distribution:', currentYearDataClean.aggregate_histogram('landslide'));
print('Final Testing Data Class Distribution:', acurracy_evaluation.aggregate_histogram('landslide'));
// Calculate and print the sizes
var numTrainingLandslidePoints = labeledTrainingLandslidePoints.size();
var numCurrentYearLandslidePoints = labeledCurrentYearLandslidePoints.size();
var numNonLandslidePoints = nonLandslidePoints.size();
var totalTrainingPoints = trainingPoints.size();
var finalTestingSize = acurracy_evaluation.size();
print('=== POINT COUNTS ===');
print('Training Landslide Points (Historical):', numTrainingLandslidePoints);
print('Current Year Landslide Points:', numCurrentYearLandslidePoints);
print('Non-Landslide Points:', numNonLandslidePoints);
print('Total Training Collection Size:', totalTrainingPoints);
print('Final Testing Collection Size:', finalTestingSize);
// Define the name of the variables used in training
var bandNames = combinedLSMFactors.bandNames();
print('Bands used in training:', bandNames);
var treeMapping = {
  2020: 456,  //0.7
  2021: 133,  //0.7
  2022: 30,   //0.5
  2023: 824,  //0.7
  2024: 62    //0.7
};
// Add a bagFraction mapping
var bagFractionMapping = {
  2020: 0.7,
  2021: 0.7,
  2022: 0.5,
  2023: 0.7,
  2024: 0.7
};
// Get the number of trees from the mapping, or default to 100 if not defined
var treeNum = treeMapping[endYear] || 100;
print('Number of Trees:', treeNum);
// Get the bagFraction from the mapping, or default to 0.5 if not defined
var bagFrac = bagFractionMapping[endYear] || 0.5;
print('Bag Fraction:', bagFrac);
// Train Random Forest model
var rf = ee.Classifier.smileRandomForest({numberOfTrees: treeNum, bagFraction: bagFrac})
  .train(training, 'landslide', bandNames)
  .setOutputMode('PROBABILITY');
// Create probability mapping
var rfclass = combinedLSMFactors.select(bandNames).classify(rf);
Map.addLayer(rfclass, {min: 0, max: 1, palette: ['white', 'red']}, 'Probability Mapping');
var susceptibility_slices = rfclass.where(rfclass.lt(0.25), 1)    // Very Low - Dark Green
  .where(rfclass.gte(0.25).and(rfclass.lt(0.4)), 2)   // Low - Olive Green
  .where(rfclass.gte(0.4).and(rfclass.lt(0.5)), 3)    // Moderate - Yellow
  .where(rfclass.gte(0.5).and(rfclass.lte(1)), 4);    // High - Red
var palette = ['green', 'lightgreen', 'yellow', 'red'];
Map.addLayer(susceptibility_slices.clip(wayanad), {min: 1, max: 4, palette: palette}, 'Reclassified Susceptibility Levels');
// Feature Importance Analysis
// Compute feature importances from the Random Forest classifier
var importances = ee.Dictionary(rf.explain().get('importance'));
var importanceChart = ui.Chart.array.values(importances.values(), 0, importances.keys())
  .setChartType('ColumnChart')
  .setOptions({
    title: 'Feature Importance',
    hAxis: {title: 'Features'},
    vAxis: {title: 'Importance'},
    colors: ['purple']
  });
print(importanceChart);
//************************************************************************** 
// Accuracy Assessment
//************************************************************************** 
//ROC and AUC
// Define target and non-target points based on actual labels
var FF = acurracy_evaluation.filter(ee.Filter.eq('landslide', 1));  // Landslide points
var NFF = acurracy_evaluation.filter(ee.Filter.eq('landslide', 0));  // Non-landslide points
// Extract classification probabilities for each point
var FFrf = rfclass.reduceRegions({
  collection: FF,
  reducer: ee.Reducer.max().setOutputs(['classification']),
  scale: 30
}).map(function(x) { return x.set('is_target', 1); });

var NFFrf = rfclass.reduceRegions({
  collection: NFF,
  reducer: ee.Reducer.max().setOutputs(['classification']),
  scale: 30
}).map(function(x) { return x.set('is_target', 0); });

// Combine the results
var combined = FFrf.merge(NFFrf);
print('Combined Points:', combined);

// Define parameters for ROC calculation
var ROC_field = 'classification';
var ROC_min = 0;
var ROC_max = 1;
var ROC_steps = 100;

// Compute ROC points with extended metrics
var ROC = ee.FeatureCollection(ee.List.sequence(ROC_min, ROC_max, null, ROC_steps).map(function(cutoff) {
  var target_roc = combined.filter(ee.Filter.eq('is_target', 1)); // Actual positives
  var non_target_roc = combined.filter(ee.Filter.eq('is_target', 0)); // Actual negatives
  // True Positive Rate (TPR)
  var TPR = ee.Number(target_roc.filter(ee.Filter.gte(ROC_field, cutoff)).size())
    .divide(target_roc.size());
  // True Negative Rate (TNR)
  var TNR = ee.Number(non_target_roc.filter(ee.Filter.lt(ROC_field, cutoff)).size())
    .divide(non_target_roc.size());
  // False Positive Rate (FPR)
  var FPR = ee.Number(1).subtract(TNR);
  // False Negative Rate (FNR)
  var FNR = ee.Number(1).subtract(TPR);
  // Distance from perfect classification (0, 1)
  var dist = TPR.subtract(1).pow(2).add(FPR.pow(2)).sqrt();
  // Confusion matrix components
  var TP = target_roc.filter(ee.Filter.gte(ROC_field, cutoff)).size(); // True Positives
  var FN = target_roc.filter(ee.Filter.lt(ROC_field, cutoff)).size(); // False Negatives
  var FP = non_target_roc.filter(ee.Filter.gte(ROC_field, cutoff)).size(); // False Positives
  var TN = non_target_roc.filter(ee.Filter.lt(ROC_field, cutoff)).size(); // True Negatives
  // Metrics based on confusion matrix
  var accuracy = ee.Number(TP).add(TN).divide(target_roc.size().add(non_target_roc.size())); // Accuracy
  var precision = ee.Number(TP).divide(ee.Number(TP).add(FP)); // Precision
  var recall = TPR; // Recall (same as TPR)
  var f1_score = ee.Number(2).multiply(precision).multiply(recall)
    .divide(precision.add(recall)); // F1-Score
  return ee.Feature(null, {
    cutoff: cutoff,
    TPR: TPR,
    TNR: TNR,
    FPR: FPR,
    FNR: FNR,
    dist: dist,
    TP: TP,
    TN: TN,
    FP: FP,
    FN: FN,
    accuracy: accuracy,
    precision: precision,
    recall: recall,
    f1_score: f1_score
  });
}));
print('ROC Points with Extended Metrics:', ROC);
// Compute AUC using trapezoidal approximation
var X = ee.Array(ROC.aggregate_array('FPR'));
var Y = ee.Array(ROC.aggregate_array('TPR'));
var X_diff = X.slice(0, 1).subtract(X.slice(0, 0, -1));
var Y_sum = Y.slice(0, 1).add(Y.slice(0, 0, -1));
var AUC = X_diff.multiply(Y_sum).multiply(0.5).reduce('sum', [0]).abs();
print('Area Under Curve (AUC):', AUC);
// Plot the ROC curve
var ROCChart = ui.Chart.feature.byFeature(ROC, 'FPR', 'TPR')
  .setOptions({
    title: 'ROC Curve',
    hAxis: {title: 'False Positive Rate'},
    vAxis: {title: 'True Positive Rate'},
    lineWidth: 2,
    colors: ['blue']
  });
print(ROCChart);
// Find the cutoff with the best distance to (0, 1)
var ROC_best = ROC.sort('dist').first();
print('Best ROC Point Cutoff:', ROC_best.get('cutoff'));
// Plot Accuracy Precision Recall and F1-Score
var AccuracyChart = ui.Chart.feature.byFeature(ROC, 'cutoff', 'accuracy')
  .setOptions({
    title: 'Accuracy vs. Cutoff',
    hAxis: {title: 'Cutoff'},
    vAxis: {title: 'Accuracy'},
    lineWidth: 2,
    colors: ['green']
  });
print(AccuracyChart);
var PrecisionChart = ui.Chart.feature.byFeature(ROC, 'cutoff', 'precision')
  .setOptions({
    title: 'Precision vs. Cutoff',
    hAxis: {title: 'Cutoff'},
    vAxis: {title: 'Precision'},
    lineWidth: 2,
    colors: ['green']
  });
print(PrecisionChart);
var RecallChart = ui.Chart.feature.byFeature(ROC, 'cutoff', 'recall')
  .setOptions({
    title: 'Recall vs. Cutoff',
    hAxis: {title: 'Cutoff'},
    vAxis: {title: 'Recall'},
    lineWidth: 2,
    colors: ['green']
  });
print(RecallChart);
var F1Chart = ui.Chart.feature.byFeature(ROC, 'cutoff', 'f1_score')
  .setOptions({
    title: 'F1-Score vs. Cutoff',
    hAxis: {title: 'Cutoff'},
    vAxis: {title: 'F1-Score'},
    lineWidth: 2,
    colors: ['purple']
  });
print(F1Chart);

