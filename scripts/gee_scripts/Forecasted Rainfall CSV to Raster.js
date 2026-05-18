// Load your uploaded Wayanad shapefile asset
var wayanad = ee.FeatureCollection('projects/ee-ce23resch11016/assets/ISRO_Wayanad_District_BDY');
var geometry = wayanad.geometry();

// Add layers to the map
Map.centerObject(wayanad, 10);
Map.addLayer(wayanad, {color: 'grey', fillColor: '00000000'}, 'Wayanad Transparent Boundary');

var wayanadBorder = ee.Image().byte().paint({featureCollection: wayanad, color: 1, width: 3});
Map.addLayer(wayanadBorder, null, 'Wayanad Border');

var endYear = 2026;  // Year for naming (adjust as needed)

// ====== STEP 1: RECONSTRUCT IMAGE FROM CSV ======

// Load the CSV file as a FeatureCollection
var csvData = ee.FeatureCollection('projects/ee-ce23resch11016/assets/Forecasted_RainfallCSV/ForecastedYearlyMeanRainfall'+endYear+'Gridded5000m');

print('CSV Data Sample:', csvData.limit(5));
print('CSV Data Size:', csvData.size());

// Function to create a rectangular polygon from bounding box coordinates
var createGridCell = function(feature) {
  var lowerLat = ee.Number(feature.get('Lower_Lat'));
  var upperLat = ee.Number(feature.get('Upper_Lat'));
  var leftLon = ee.Number(feature.get('Left_Lon'));
  var rightLon = ee.Number(feature.get('Right_Lon'));

  // Explicitly cast 'mean' to a number
  var meanValue = ee.Number(feature.get('mean'));

  // Create rectangle geometry from bounding box coordinates
  var rectangle = ee.Geometry.Rectangle([leftLon, lowerLat, rightLon, upperLat]);

  // Set the geometry for the feature and attach the numeric 'mean' property
  return feature.setGeometry(rectangle).set('mean', meanValue);
};

// Convert point data to grid cells with proper geometries
var gridCells = csvData.map(createGridCell);

// Create an image from the grid cells using the 'mean' property
// Remove 'width' parameter to fill the entire grid cell, not just the outline
var reconstructedImage = ee.Image().float().paint({
  featureCollection: gridCells,
  color: 'mean' // Use the 'mean' column from your CSV
}).reproject({
    crs: 'EPSG:4326',
    scale: 5000  //scale of the Grids of CSV
  }).rename('reconstructed_mean');

print('Reconstructed Image:', reconstructedImage);

// Calculate stats for comparison
var discreteStats = reconstructedImage.reduceRegion({
  reducer: ee.Reducer.minMax(),
  geometry: wayanad,
  scale: 5000,   //scale of the Grids of CSV
  maxPixels: 1e9
});
print('Discrete Reconstructed Image Stats:', discreteStats);

// Clip to Wayanad boundary
var clippedReconstructed = reconstructedImage.clip(wayanad);

// Add to map for visualization
var visParams = {
  min: 3.321298578,
  max: 10.72625979,
  palette: ['blue', 'green', 'yellow', 'orange', 'red']
};
Map.addLayer(clippedReconstructed, visParams, 'Reconstructed Mean Rainfall (Discrete)');

// ====== STEP 2: CREATE CONTINUOUS PIXEL DATA AND REPROJECT ======

// Set your desired parameters
var scale = 100;  // Target resolution in meters (adjust as needed)


/*
// Method 1: Use focal_mean to create smooth continuous data
var smoothedImage = clippedReconstructed.focal_mean({
  radius: 3000, // Half of your original grid size (5000m/2)
  kernelType: 'circle',
  units: 'meters'
});
print('Smoothed Image:', smoothedImage);

// Method 2: Alternative - Use reduceNeighborhood for more control
var continuousImage = clippedReconstructed.reduceNeighborhood({
  reducer: ee.Reducer.mean(),
  kernel: ee.Kernel.circle({radius: 2500, units: 'meters'})
});
print('Continuous Image (Alternative):', continuousImage);

// Choose which method to use (focal_mean is simpler and recommended)
var processedImage = smoothedImage; // Change to continuousImage if you prefer method 2

// Add visualization for the smoothed continuous image
Map.addLayer(processedImage.clip(wayanad), visParams, 'Smoothed Continuous Image');
*/
// Now we can safely use bilinear resampling on the continuous data
var reprojectedImage = clippedReconstructed    //Used earlier: processedImage
  .resample('bilinear')
  .reproject({
    crs: 'EPSG:4326',
    scale: scale
  })
  .rename('b1'); // Rename to match code2 format

print('Reprojected Image:', reprojectedImage);

// Calculate statistics for the reprojected image
var imageStats = reprojectedImage.reduceRegion({
  reducer: ee.Reducer.minMax(),
  geometry: wayanad,
  scale: scale,
  maxPixels: 1e9
});

print('Reprojected Image Min/Max:', imageStats);

// Add the final reprojected rainfall layer to the map
Map.addLayer(reprojectedImage.clip(wayanad), {
  min: 3.3212985779999995,
  max: 10.726259790000002,
  palette: ['blue', 'green', 'yellow', 'orange', 'red']
}, 'Final Reprojected Mean Rainfall (100m)');

// ====== STEP 3: EXPORT AS GEOTIFF AND ASSET ======

// Export the result as a GeoTIFF
Export.image.toDrive({
  image: reprojectedImage.clip(wayanad),
  description: 'Mean_Rainfall_Year_'+endYear+'_FORECASTED',
  scale: 30,  // The desired resolution of 30 meters
  region: wayanad.geometry(),  // Specify the region (bounding box) of the original image
  fileFormat: 'GeoTIFF',
  folder: 'Wayanad_Exports',
  fileNamePrefix: endYear+'mean_rainfall_FORECASTED',
  maxPixels: 1e10  // Adjust based on your image size
});

// Export the annual mean image to an Earth Engine Asset
Export.image.toAsset({
  image: reprojectedImage.clip(wayanad),
  description: 'Mean_Rainfall_Year_'+endYear+'_scale_'+ scale +'m_FORECASTED',
  assetId: 'projects/ee-ce23resch11016/assets/IMD/' + endYear + 'mean_rainfall_'+ scale +'m_FORECASTED', // Modify the assetId path
  region: wayanad.geometry(),
  scale: scale,  // Adjust scale as needed
  maxPixels: 1e13
});


//----------------------------------

// Define min and max values for normalization (Rainfall)
var minRainfall = 3.3212985779999995;  // Minimum mean rainfall (2020–2023)
var maxRainfall = 10.726259790000002;  // Maximum mean rainfall (2020–2023)

// Normalize the rainfall
var normalizedRainfall = reprojectedImage.subtract(minRainfall).divide(maxRainfall - minRainfall);

// Classify normalized rainfall into categories
var rainfallClasses = ee.Image(0)
  .where(normalizedRainfall.lt(0.306), 1)  // Dark Green: 0.0 - 0.306 (~3.82 - 5.37)
  .where(normalizedRainfall.gte(0.306).and(normalizedRainfall.lt(0.445)), 2)  // Olive Green: 0.306 - 0.445 (~5.37 - 6.05)
  .where(normalizedRainfall.gte(0.445).and(normalizedRainfall.lt(0.584)), 3)  // Light Yellow: 0.445 - 0.584 (~6.05 - 6.73)
  .where(normalizedRainfall.gte(0.584).and(normalizedRainfall.lt(0.725)), 4)  // Light Gray: 0.584 - 0.725 (~6.73 - 7.40)
  .where(normalizedRainfall.gte(0.725), 5);  // Cream Yellow: 0.725 - 1.0 (~7.40 - 8.61)

// Visualization for the rainfall classes
var rainfallClassesVis = {
  min: 1,
  max: 5,
  palette: [
  '#006400', // Dark Green
  '#808000', // Olive
  '#FFFFE0', // Light Yellow
  '#D3D3D3', // Light Gray
  '#FFFDD0'  // Cream
]};

// Add the classified rainfall layer to the map
Map.addLayer(rainfallClasses.clip(wayanad), rainfallClassesVis, 'Normalized Classiified Rainfall Classes ');
Export.image.toDrive({
    image: rainfallClasses.clip(wayanad),
    description: endYear+'_Normalized_Classiified_Rainfall_Classes_Forecasted',
    fileNamePrefix: endYear+' Normal-Class Rainfall Forecasted',
    region: geometry,
    folder: 'Wayanad_Exports',
    scale: 30,
    maxPixels: 1e9
});


// ====== OPTIONAL: COMPARE WITH ORIGINAL (if available) ======
/*
// Uncomment this section if you want to compare with the original TIFF processing
var originalAsset = ee.Image("projects/ee-ce23resch11016/assets/Raw_IMD_Data/combined_rainfall_" + endYear);
var originalClipped = originalAsset.clip(wayanad);
var originalReprojected = originalClipped.select(originalClipped.bandNames())
  .resample('bilinear')
  .reproject({
    crs: originalClipped.projection(),
    scale: scale
  });
var originalMean = originalReprojected.reduce(ee.Reducer.mean()).rename('original_mean');

// Add original for comparison
Map.addLayer(originalMean, visParams, 'Original Mean Rainfall');

// Calculate difference between reconstructed and original
var difference = reprojectedImage.subtract(originalMean).rename('difference');
Map.addLayer(difference, {min: -2, max: 2, palette: ['red', 'white', 'blue']}, 'Difference (Reconstructed - Original)');

// Print comparison stats
var originalStats = originalMean.reduceRegion({
  reducer: ee.Reducer.minMax(),
  geometry: wayanad,
  scale: scale,
  maxPixels: 1e9
});
print('Original Processing Stats:', originalStats);
*/



/*
//Daily Rainfall

// Function to load and clip mean rainfall data for a specific year
function getMeanRainfallData(year) {
  var imageName;
  if (year >= 2025) {
    imageName = 'projects/ee-ce23resch11016/assets/IMD/' + year + 'mean_rainfall_100m_FORECASTED';
  } else {
    imageName = 'projects/ee-ce23resch11016/assets/IMD/' + year + 'mean_rainfall_100m';
  }
  var rainfall = ee.Image(imageName);
  return rainfall.clip(wayanad);
}

// Years for which data is available
var years = [endYear-3,endYear-2,endYear-1,endYear];
//var years = [endYear];
print(years)

// Load and combine mean rainfall data for all years
var meanRainfallImages = years.map(function(year) {
  return getMeanRainfallData(year);
});

// Compute the average of the mean rainfall across all years
var IMDRainMeanAllYears = ee.ImageCollection(meanRainfallImages).mean().rename('precipitation');

// Calculate min and max for the mean rainfall (all years)
var meanStatsAllYears = IMDRainMeanAllYears.reduceRegion({
  reducer: ee.Reducer.minMax(),
  geometry: wayanad,
  scale: scale, // Adjust based on dataset resolution
  maxPixels: 1e9
});

// Print the statistics
print('Mean Rainfall Min/Max:', meanStatsAllYears);
//print('Sum Rainfall (2020–2023) Min/Max:', sumStatsAllYears);

// Visualization parameters for mean rainfall
var multiYearMeanVis = {
  min: 2.981393066588309,  // Adjust based on the data range
  max: 9.308987635477074,  // Adjust based on the data range
  palette: ['blue', 'green', 'yellow', 'orange', 'red']
};

// Add the mean rainfall layer to the map
Map.addLayer(IMDRainMeanAllYears, multiYearMeanVis, 'Mean Rainfall ', false);


// Define min and max values for normalization (Mean Rainfall)
var minMeanRainfall = 2.981393066588309;  // Minimum mean rainfall (2020–2023)
var maxMeanRainfall = 9.308987635477074;  // Maximum mean rainfall (2020–2023)

// Normalize the mean rainfall
var normalizedMeanRainfall = IMDRainMeanAllYears.subtract(minMeanRainfall).divide(maxMeanRainfall - minMeanRainfall);

// Classify normalized mean rainfall into categories
var meanRainfallClasses = ee.Image(0)
  .where(normalizedMeanRainfall.lt(0.306), 1)  // Dark Green: 0.0 - 0.306 (~3.82 - 5.37)
  .where(normalizedMeanRainfall.gte(0.306).and(normalizedMeanRainfall.lt(0.445)), 2)  // Olive Green: 0.306 - 0.445 (~5.37 - 6.05)
  .where(normalizedMeanRainfall.gte(0.445).and(normalizedMeanRainfall.lt(0.584)), 3)  // Light Yellow: 0.445 - 0.584 (~6.05 - 6.73)
  .where(normalizedMeanRainfall.gte(0.584).and(normalizedMeanRainfall.lt(0.725)), 4)  // Light Gray: 0.584 - 0.725 (~6.73 - 7.40)
  .where(normalizedMeanRainfall.gte(0.725), 5);  // Cream Yellow: 0.725 - 1.0 (~7.40 - 8.61)

// Visualization for the mean rainfall classes
var meanRainfallClassesVis = {
  min: 1,
  max: 5,
  palette: [
  '#006400', // Dark Green
  '#808000', // Olive
  '#FFFFE0', // Light Yellow
  '#D3D3D3', // Light Gray
  '#FFFDD0'  // Cream
]};

// Add the classified mean rainfall layer to the map
Map.addLayer(meanRainfallClasses.clip(wayanad), meanRainfallClassesVis, 'Normalized Classiified Mean Rainfall Classes ', false);
Export.image.toDrive({
    image: meanRainfallClasses.clip(wayanad),
    description: 'Combined_'+endYear+'_Normalized_Classiified_Mean_Rainfall_Classes',
    fileNamePrefix: 'Combined '+endYear+' Normal-Class Mean Rainfall',
    region: geometry,
    folder: 'Wayanad_Exports',
    scale: 30,
    maxPixels: 1e9
});
*/