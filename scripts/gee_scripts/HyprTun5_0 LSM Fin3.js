// Load your uploaded Wayanad shapefile asset
var wayanad = ee.FeatureCollection('projects/ee-ce23resch11016/assets/ISRO_Wayanad_District_BDY');
var geometry = wayanad.geometry();

// Load the combined DEM tile from your assets
var combinedDEMTile = ee.Image('projects/ee-ce23resch11016/assets/merged_cdnc43d_cdnc43e');

var endYear = 2024;
print('Year:', endYear);

// Calculate elevation, slope, and aspect from the mosaicked DEM
//var elevation = combinedDEMTile; // Define the elevation from the SRTM dataset
var elevation = combinedDEMTile.rename('elevation'); // Rename the DEM band to 'elevation' instead of 'b1'
var slope = ee.Terrain.slope(elevation);
var aspect = ee.Terrain.aspect(elevation);

// Add layers to the map
Map.centerObject(wayanad, 10);
// Add a transparent boundary for Wayanad for clearer visualization
Map.addLayer(wayanad, {color: 'grey', fillColor: '00000000'}, 'Wayanad Transparent Boundary');
var wayanadBorder =
    ee.Image().byte().paint({featureCollection: wayanad, color: 1, width: 3});
Map.addLayer(wayanadBorder, null, 'Wayanad Border');


// Compute Slope from Cartosat DEM
var slopeC = ee.Terrain.slope(combinedDEMTile);
// Apply a focal mean filter (smoothing window) to approximate curvature
var focalMeanSlope = slopeC.convolve(ee.Kernel.circle(3, 'pixels', true));
var curvature = slopeC.subtract(focalMeanSlope);

var reliefClasses = ee.Image('projects/ee-ce23resch11016/assets/Relief_Classes');

//LULC
// Load the Dynamic World V1 dataset
var dw = ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1');
// Filter the dataset for Wayanad and a specific date range (e.g., for 2023)
var startDate = '2024-01-01';
var endDate = '2024-10-01';
var dynamicWorld = dw.filterDate(startDate, endDate)
                     .filterBounds(wayanad);
// Get the most recent Dynamic World image for Wayanad
var dwImage = dynamicWorld.median().clip(wayanad);

//Scale for Interpolation (e.g., 0.01 degree)
//Optionally, resample to higher resolution (e.g., 0.01 degree)
var scale = 100; // Approx. 0.01 degrees at the equator

//SoilMoisture
//Exported Interpolated NASA SMAP Global Soil Moisture 3 hourly data into daily mean data
//and then using it again as asset, for efficiency.
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


//Bhukosh Geology
// Load the geoology shapefile asset and clip to Wayanad boundaries
var geology = ee.FeatureCollection('projects/ee-ce23resch11016/assets/Bhukosh_Assets/Geology_2M_Bhukosh');
geology = geology.filterBounds(geometry);

//Bhukosh Geomorphology
// Load the geomorphology shapefile asset and clip to Wayanad boundaries
var geomorphology = ee.FeatureCollection('projects/ee-ce23resch11016/assets/Bhukosh_Assets/Geomorphology_250K_Bhukosh');
geomorphology = geomorphology.filterBounds(geometry);

//Bhukosh Lineament
// Load the lineament shapefile asset and clip to Wayanad boundaries
var lineament = ee.FeatureCollection('projects/ee-ce23resch11016/assets/Bhukosh_Assets/Lineament_250K_Bhukosh');
lineament = lineament.filterBounds(geometry);

//Bhukosh Lithology
// Load the lithology shapefile asset and clip to Wayanad boundaries
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

// Note: Assuming non-landslide points don't have year information, so we'll use all of them
// If they do have year information, you might want to filter them similarly
Map.addLayer(nonLandslidePoints, {color: 'blue'}, 'Non-Landslide Points', false);

// Creating LSM
// [All the LSM factor creation code remains the same...]
var elevation = elevation.reproject('EPSG:4326', null, 30).rename('elevation_class')
var slope = ee.Terrain.slope(elevation);
var slope = slope.reproject('EPSG:4326', null, 30).rename('slope_class')
var aspect = ee.Terrain.aspect(elevation);
var aspect = aspect.reproject('EPSG:4326', null, 30).rename('aspect_class')
curvature = curvature.reproject('EPSG:4326', null, 30).rename('curvature_class')


var reliefClasses = reliefClasses.reproject('EPSG:4326', null, 30).rename('classifiedRelief_class')

// Ensure LULC label band is integer
var lulcClass = dwImage.select('label').add(1).reproject('EPSG:4326', null, 30).rename('landcover_class');

var surfaceSoilMoisture = surfaceSoilMoistureAllYears.reproject('EPSG:4326', null, 30).rename('surface_moisture_class');
var rootzoneSoilMoisture = rootzoneSoilMoistureAllYears.reproject('EPSG:4326', null, 30).rename('rootzone_moisture_class');
var IMDRainMean = IMDRainMeanAllYears.reproject('EPSG:4326', null, 30).rename('mean_rainfall_class');

// Get distinct categories in STRATIGRAP and create a dictionary with unique numeric codes
var geologyCategories = geology.aggregate_array('STRATIGRAP').distinct();
var geologyCategoryDict = ee.Dictionary.fromLists(geologyCategories, ee.List.sequence(1, geologyCategories.size()));

// Map over geology FeatureCollection to add unique numeric codes based on the dictionary
var geologyWithCodes = geology.map(function(feature) {
  var category = ee.String(feature.get('STRATIGRAP')).trim();
  var code = geologyCategoryDict.get(category);  // Get the unique code from dictionary
  return feature.set('category_code', code);  // Add code as a property
});

// Convert the geology FeatureCollection with category codes to an image
var geologyImage = geologyWithCodes.reduceToImage({
  properties: ['category_code'],
  reducer: ee.Reducer.first()
}).reproject('EPSG:4326', null, 30).rename('geology_class');

// Get distinct categories in STRATIGRAP and create a dictionary with unique numeric codes
var lithologyCategories = lithology.aggregate_array('STRATIGRAP').distinct();
var lithologyCategoryDict = ee.Dictionary.fromLists(lithologyCategories, ee.List.sequence(1, lithologyCategories.size()));

// Map over lithology FeatureCollection to add unique numeric codes based on the dictionary
var lithologyWithCodes = lithology.map(function(feature) {
  var category = ee.String(feature.get('STRATIGRAP')).trim();
  var code = lithologyCategoryDict.get(category);  // Get the unique code from dictionary
  return feature.set('category_code', code);  // Add code as a property
});

// Convert the lithology FeatureCollection with category codes to an image
var lithologyImage = lithologyWithCodes.reduceToImage({
  properties: ['category_code'],
  reducer: ee.Reducer.first()
}).reproject('EPSG:4326', null, 30).rename('lithology_class');

// Get distinct categories in the DESCRIPTIO field and create a dictionary with unique numeric codes
var geomorphologyCategories = geomorphology.aggregate_array('DESCRIPTIO').distinct();
var geomorphologyCategoryDict = ee.Dictionary.fromLists(geomorphologyCategories, ee.List.sequence(1, geomorphologyCategories.size()));

// Map over geomorphology FeatureCollection to add unique numeric codes based on the dictionary
var geomorphologyWithCodes = geomorphology.map(function(feature) {
  var category = ee.String(feature.get('DESCRIPTIO')).trim();
  var code = geomorphologyCategoryDict.get(category);  // Get the unique code from dictionary
  return feature.set('category_code', code);  // Add code as a property
});

// Convert the geomorphology FeatureCollection with category codes to an image
var geomorphologyImage = geomorphologyWithCodes.reduceToImage({
  properties: ['category_code'],
  reducer: ee.Reducer.first()
}).reproject('EPSG:4326', null, 30).rename('geomorphology_class');

// Flow Accumulation from the MERIT Hydro dataset, transformed with log for easier visualization
var flowaccumulation = ee.Image("MERIT/Hydro/v1_0_1").select('upa')
                    .log() // Log-transform for visualization
                    .clip(geometry) // Clip to Wayanad geometry
                    .reproject('EPSG:4326', null, 30)
                    .rename('FWACC');

// Global Height Above the Nearest Drainage (HAND)
var hand = ee.Image("users/gena/GlobalHAND/30m/hand-1000")
            .clip(geometry)
            .reproject('EPSG:4326', null, 30)
            .rename('HAND');

// Topographic Position Index (TPI)
// Calculate mean TPI using a 5-pixel focal mean filter
var meanTPI = elevation.focalMean(5, 'square'); // Note: elevation_extend should be defined in your workspace
var tpi = elevation.subtract(meanTPI)  // Subtract focal mean from elevation
           .reproject('EPSG:4326', null, 30)
           .rename('mTPI')
           .clip(geometry);

// Horizontal Distance to Channel Network (HDND)
// Select pixels with drainage area greater than 0.5 km² to identify rivers
var rivers = ee.Image("MERIT/Hydro/v1_0_1").select('upa')
              .clip(geometry)
              .gt(0.5);  // Threshold for river network

// Define maximum distance for Euclidean distance calculation
var maxDistM = 7500;  // Maximum distance in meters

// Define Euclidean kernel and apply distance function
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

// ========== MODIFIED DATA PREPARATION SECTION ==========

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
  2020: 159,
  2021: 301,
  2022: 133,
  2023: 1485 };  

// Get the number of trees from the mapping, or default to 77 if not defined
var treeNum = treeMapping[endYear] || 77;
print('Number of Trees:', treeNum);

// Train Random Forest model
var rf = ee.Classifier.smileRandomForest({numberOfTrees: treeNum, bagFraction: 0.6})
    .train(training, 'landslide', bandNames)
    .setOutputMode('PROBABILITY');

// Create probability mapping
var rfclass = combinedLSMFactors.select(bandNames).classify(rf);

// Add accuracy metrics visualization
Map.addLayer(rfclass, {min: 0, max: 1, palette: ['white', 'red']}, 'Probability Mapping');

// Create susceptibility classes
var susceptibility_slices = rfclass.where(rfclass.lt(0.25), 1)    // Very Low - Dark Green
  .where(rfclass.gte(0.25).and(rfclass.lt(0.4)), 2)   // Low - Olive Green
  .where(rfclass.gte(0.4).and(rfclass.lt(0.5)), 3)    // Moderate - Yellow
  .where(rfclass.gte(0.5).and(rfclass.lte(1)), 4);    // High - Red

// Define a color palette corresponding to susceptibility levels
var palette = ['green', 'lightgreen', 'yellow', 'red'];

// Add the reclassified susceptibility map to the map
Map.addLayer(susceptibility_slices.clip(wayanad), {min: 1, max: 4, palette: palette}, 'Reclassified Susceptibility Levels');


// Add Exploratory Data Analysis: Histograms
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




// Function to train and evaluate the RF model with given numberOfTrees
var evaluateRFModel = function(numTrees, bagFraction) {
  // Train the Random Forest model
  var rf = ee.Classifier.smileRandomForest({
    numberOfTrees: numTrees,
       bagFraction: bagFraction
  }).train({
    features: training, // Use the filtered training data
    classProperty: 'landslide', // Class property
    inputProperties: bandNames // Predictor variables
  }).setOutputMode('PROBABILITY');

  // Classify the input image
  var classifiedImage = combinedLSMFactors.select(bandNames).classify(rf);

  // Add classification results to the evaluation points
  var classifiedPoints = acurracy_evaluation.map(function(feature) {
    var classification = classifiedImage.reduceRegion({
      reducer: ee.Reducer.first(),
      geometry: feature.geometry(),
      scale: 30
    }).get('classification'); // 'classification' is the name of the output band

    return feature.set('classification', classification);
  });

  // Define target and non-target points based on actual labels
  var FF = classifiedPoints.filter(ee.Filter.eq('landslide', 1)); // Landslide points
  var NFF = classifiedPoints.filter(ee.Filter.eq('landslide', 0)); // Non-landslide points

  // Define parameters for ROC calculation
  var ROC_field = 'classification';
  var ROC_min = 0;
  var ROC_max = 1;
  var ROC_steps = 100;

  // Compute ROC points
  var ROC = ee.FeatureCollection(ee.List.sequence(ROC_min, ROC_max, null, ROC_steps).map(function(cutoff) {
    var target_roc = FF.filter(ee.Filter.gte(ROC_field, cutoff));
    var non_target_roc = NFF.filter(ee.Filter.gte(ROC_field, cutoff));

    // True Positive Rate (TPR)
    var TPR = ee.Number(target_roc.size())
      .divide(FF.size());

    // True Negative Rate (TNR)
    var TNR = ee.Number(non_target_roc.size())
      .divide(NFF.size());

    // False Positive Rate (FPR)
    var FPR = ee.Number(1).subtract(TNR);

    return ee.Feature(null, {cutoff: cutoff, TPR: TPR, FPR: FPR});
  }));

  // Compute AUC using trapezoidal approximation
  var X = ee.Array(ROC.aggregate_array('FPR'));
  var Y = ee.Array(ROC.aggregate_array('TPR'));
  var X_diff = X.slice(0, 1).subtract(X.slice(0, 0, -1));
  var Y_sum = Y.slice(0, 1).add(Y.slice(0, 0, -1));
  var AUC = X_diff.multiply(Y_sum).multiply(0.5).reduce('sum', [0]).abs();

  return AUC;
};

// Define a sequence of numberOfTrees values
var numTreesList = ee.List.sequence(75,82,1);
var bagFraction = 0.6;

// Evaluate models for each numberOfTrees value
var results = numTreesList.map(function(numTrees) {
  numTrees = ee.Number(numTrees);
  var auc = evaluateRFModel(numTrees, bagFraction);
  return ee.Feature(null, {
    numTrees: numTrees,
    AUC: auc
  });
});

// Convert results to a FeatureCollection for visualization
var resultsFC = ee.FeatureCollection(results);

// Find the best numberOfTrees based on AUC
var bestResult = resultsFC.sort('AUC', false).first();
var bestNumTrees = bestResult.get('numTrees');
var bestAUC = bestResult.get('AUC');

print('Results:', resultsFC);


// Optional: Chart to visualize the AUC against numTrees
var aucChart = ui.Chart.feature.byFeature(resultsFC, 'numTrees', 'AUC')
  .setOptions({
    title: 'AUC vs Number of Trees',
    hAxis: {title: 'Number of Trees'},
    vAxis: {title: 'AUC'},
    lineWidth: 2,
    colors: ['green']
  });
print(aucChart);