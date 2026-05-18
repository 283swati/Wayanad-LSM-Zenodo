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
var csvData = ee.FeatureCollection('projects/ee-ce23resch11016/assets/Forecasted_SoilMoistureCSV/ForecastedYearlyMeanSoilMoisture'+endYear+'_Using_Rainfall_Grid5000m');

print('CSV Data Sample:', csvData.limit(5));
print('CSV Data Size:', csvData.size());

// Function to create a rectangular polygon from bounding box coordinates
var createGridCell = function(feature) {
  var lowerLat = ee.Number(feature.get('Lower_Lat'));
  var upperLat = ee.Number(feature.get('Upper_Lat'));
  var leftLon = ee.Number(feature.get('Left_Lon'));
  var rightLon = ee.Number(feature.get('Right_Lon'));

  // Explicitly cast sm_rootzone_mean to a number
  var meanValue = ee.Number(feature.get('sm_rootzone_mean'));

  // Create rectangle geometry from bounding box coordinates
  var rectangle = ee.Geometry.Rectangle([leftLon, lowerLat, rightLon, upperLat]);

  // Set the geometry for the feature and attach the numeric sm_rootzone_mean property
  return feature.setGeometry(rectangle).set('sm_rootzone_mean', meanValue);
};

// Convert point data to grid cells with proper geometries
var gridCells = csvData.map(createGridCell);

// Create an image from the grid cells using the sm_rootzone_mean property
// Remove 'width' parameter to fill the entire grid cell, not just the outline
var reconstructedImage = ee.Image().float().paint({
  featureCollection: gridCells,
  color: 'sm_rootzone_mean' // Use the sm_rootzone_mean column from your CSV
}).reproject({
    crs: 'EPSG:4326',
    scale: 5000  //scale of the Grids of CSV
  }).rename('reconstructed_sm_rootzone_mean');

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
  min: 0.26028229,
  max: 0.3355310559272766,
  palette: ['blue', 'cyan', 'green', 'yellow', 'orange', 'red']
};
Map.addLayer(clippedReconstructed, visParams, 'Reconstructed Mean Soil Moisture (Discrete)');

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
  .rename('sm_rootzone'); // Rename to match code2 format

print('Reprojected Image:', reprojectedImage);

// Calculate statistics for the reprojected image
var imageStats = reprojectedImage.reduceRegion({
  reducer: ee.Reducer.minMax(),
  geometry: wayanad,
  scale: scale,
  maxPixels: 1e9
});

print('Reprojected Image Min/Max:', imageStats);

// Add the final reprojected Soil Moisture layer to the map
Map.addLayer(reprojectedImage.clip(wayanad), {
  min: 0.26028229,
  max: 0.33540483008875116,
  palette: ['blue', 'cyan', 'green', 'yellow', 'orange', 'red']
}, 'Final Reprojected Mean Soil Moisture (100m)');

// ====== STEP 3: EXPORT AS GEOTIFF AND ASSET ======

// Export the result as a GeoTIFF
Export.image.toDrive({
  image: reprojectedImage.clip(wayanad),
  description: 'Mean_Soil_Moisture_Year_'+endYear+'_FORECASTED',
  scale: 30,  // The desired resolution of 30 meters
  region: wayanad.geometry(),  // Specify the region (bounding box) of the original image
  fileFormat: 'GeoTIFF',
  folder: 'Wayanad_Exports',
  fileNamePrefix: endYear+'mean_Soil_Moisture_FORECASTED',
  maxPixels: 1e10  // Adjust based on your image size
});

// Export the annual mean image to an Earth Engine Asset
Export.image.toAsset({
  image: reprojectedImage.clip(wayanad),
  description: 'Annual_SMAP_Mean_Year_'+endYear+'_FORECASTED',
  assetId: 'projects/ee-ce23resch11016/assets/SMAP_AnnualMean/Annual_SMAP_Mean_Year_' + endYear + '_FORECASTED', // Modify the assetId path
  region: wayanad.geometry(),
  scale: scale,  // Adjust scale as needed
  maxPixels: 1e13
});

//----------------------------------
var soilMoisture = ee.Image('projects/ee-ce23resch11016/assets/SMAP_AnnualMean/Annual_SMAP_Mean_Year_' + endYear + '_FORECASTED');

// Calculate statistics for the reprojected image
var soilMoistureStats = soilMoisture.reduceRegion({
  reducer: ee.Reducer.minMax(),
  geometry: wayanad,
  scale: scale,
  maxPixels: 1e9
});

print('Soil Moisture Image Min/Max:', soilMoistureStats);

// Define min and max values for normalization (Rootzone Soil Moisture)
var minSM = 0.26028229
var maxSM = 0.33540483008875116

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
    description: endYear+'_Classified_Normalized_Rootzone_Soil_Moisture_Forecasted',
    fileNamePrefix: endYear+' Classified Normalized Rootzone Soil Moisture Forecasted',
    region: geometry,
    scale: 30,
    folder: 'Wayanad_Exports',
    maxPixels: 1e13
});


// ====== OPTIONAL: COMPARE WITH ORIGINAL (if available) ======
/*
// Uncomment this section if you want to compare with the original TIFF processing
var originalAsset = ee.Image("projects/ee-ce23resch11016/assets/Raw_IMD_Data/combined_Soil Moisture_" + endYear);
var originalClipped = originalAsset.clip(wayanad);
var originalReprojected = originalClipped.select(originalClipped.bandNames())
  .resample('bilinear')
  .reproject({
    crs: originalClipped.projection(),
    scale: scale
  });
var originalMean = originalReprojected.reduce(ee.Reducer.mean()).rename('original_mean');

// Add original for comparison
Map.addLayer(originalMean, visParams, 'Original Mean Soil Moisture');

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

//----------------------------------






/*
// Function to load and clip mean rootzone soil moisture data for a specific year
function getMeanRootSoilMoisture(year) {
  var imageName;
  if (year >= 2025) {
    imageName = 'projects/ee-ce23resch11016/assets/SMAP_AnnualMean/Annual_SMAP_Mean_Year_' + year + '_FORECASTED';
  } else {
    imageName = 'projects/ee-ce23resch11016/assets/SMAP_AnnualMean/Annual_SMAP_Mean_Year_' + year;
  }
  var soilMoisture = ee.Image(imageName).select('sm_rootzone');
  return soilMoisture.clip(wayanad);
}


// Years for which soil moisture data is available
var years = [endYear-3,endYear-2,endYear-1,endYear];
//var years = [endYear];
print(years)

// // Combine surface soil moisture data for all years
// var surfaceSoilMoistureImages = years.map(function(year) {
//   return getMeanSurfaceSoilMoisture(year);
// });

// // Compute the average surface soil moisture across all years
// var surfaceSoilMoistureAllYears = ee.ImageCollection(surfaceSoilMoistureImages).mean().rename('surface_soil_moisture');

// Combine rootzone soil moisture data for all years
var rootzoneSoilMoistureImages = years.map(function(year) {
  return getMeanRootSoilMoisture(year);
}); 

// Compute the average rootzone soil moisture across all years
var rootzoneSoilMoistureAllYears = ee.ImageCollection(rootzoneSoilMoistureImages).mean().rename('rootzone_soil_moisture');

// // Calculate min and max for surface soil moisture (all years)
// var surfaceStatsAllYears = surfaceSoilMoistureAllYears.reduceRegion({
//   reducer: ee.Reducer.minMax(),
//   geometry: wayanad,
//   scale: scale, // Adjust scale based on dataset resolution
//   maxPixels: 1e9
// });

// Calculate min and max for rootzone soil moisture (all years)
var rootzoneStatsAllYears = rootzoneSoilMoistureAllYears.reduceRegion({
  reducer: ee.Reducer.minMax(),
  geometry: wayanad,
  scale: scale,
  maxPixels: 1e9
});

// Print the statistics
// print('Surface Soil Moisture Min/Max:', surfaceStatsAllYears);
print('Rootzone Soil Moisture Min/Max:', rootzoneStatsAllYears);

// // Visualization parameters for surface soil moisture
// var surfaceSoilMoistureVis = {
//   min: 0.1955, // Adjust based on the calculated range
//   max: 0.30406338, // Adjust based on the calculated range
//   palette: ['blue', 'cyan', 'green', 'yellow', 'orange', 'red'] // Enhanced palette
// };

// Visualization parameters for rootzone soil moisture
var rootzoneSoilMoistureVis = {
  min: 0.2537597417831421, // Adjust based on the calculated range
  max: 0.33391299843788147, // Adjust based on the calculated range
  palette: ['#0000FF', '#00FFFF', '#00FF00', '#FFFF00', '#FFA500', '#FF0000'] // Enhanced palette
};

// // Add mean surface soil moisture layer to the map
// Map.addLayer(surfaceSoilMoistureAllYears.clip(wayanad), surfaceSoilMoistureVis, 'Mean Surface Soil Moisture', false);

// Add mean rootzone soil moisture layer to the map
Map.addLayer(rootzoneSoilMoistureAllYears.clip(wayanad), rootzoneSoilMoistureVis, 'Mean Rootzone Soil Moisture', false);

// // Define min and max values for normalization (Surface Soil Moisture)
// var minSurfaceSoilMoisture = 0.2312639206647873;  // Minimum surface soil moisture (2020–2023)
// var maxSurfaceSoilMoisture = 0.3281596004962921;  // Maximum surface soil moisture (2020–2023)

// // Normalize the surface soil moisture
// var normalizedSurfaceSoilMoisture = surfaceSoilMoistureAllYears.subtract(minSurfaceSoilMoisture)
//   .divide(maxSurfaceSoilMoisture - minSurfaceSoilMoisture);

// // Classify normalized surface soil moisture into categories
// var surfaceSoilMoistureClasses = ee.Image(0)
//   .where(normalizedSurfaceSoilMoisture.lt(0.2), 1)  // Very dry (Blue): 0.0 - 0.2
//   .where(normalizedSurfaceSoilMoisture.gte(0.2).and(normalizedSurfaceSoilMoisture.lt(0.4)), 2)  // Dry (Cyan): 0.2 - 0.4
//   .where(normalizedSurfaceSoilMoisture.gte(0.4).and(normalizedSurfaceSoilMoisture.lt(0.6)), 3)  // Moderate moisture (Green): 0.4 - 0.6
//   .where(normalizedSurfaceSoilMoisture.gte(0.6).and(normalizedSurfaceSoilMoisture.lt(0.8)), 4)  // Wet (Yellow): 0.6 - 0.8
//   .where(normalizedSurfaceSoilMoisture.gte(0.8), 5);  // Very wet (Orange/Red): 0.8 - 1.0

// Define min and max values for normalization (Rootzone Soil Moisture)
var minRootzoneSoilMoisture = 0.2537597417831421;  // Minimum rootzone soil moisture (2020–2023)
var maxRootzoneSoilMoisture = 0.33391299843788147;  // Maximum rootzone soil moisture (2020–2023)

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

// // Visualization parameters for classified surface soil moisture
// var classifiedSurfaceVis = {
//   min: 1,
//   max: 5,
//   palette: ['blue', 'cyan', 'green', 'yellow', 'orange', 'red'], // Enhanced palette
//   // Categories:
//   // 1: Blue (Very Dry)
//   // 2: Cyan (Dry)
//   // 3: Green (Moderate)
//   // 4: Yellow (Wet)
//   // 5: Orange/Red (Very Wet)
// };

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

// // Add classified surface soil moisture layer
// Map.addLayer(surfaceSoilMoistureClasses.clip(wayanad), classifiedSurfaceVis, 'Classified Normalized Surface Soil Moisture', false);

// Add classified rootzone soil moisture layer
Map.addLayer(rootzoneSoilMoistureClasses.clip(wayanad), classifiedRootzoneVis, 'Classified Normalized Rootzone Soil Moisture', false);

// Export.image.toDrive({
//     image: surfaceSoilMoistureClasses.clip(wayanad),
//     description: 'Combined_'+endYear+'_Classified_Normalized_Surface_Soil_Moisture',
//     fileNamePrefix: 'Combined '+endYear+' Classified Normalized Surface Soil Moisture',
//     region: geometry,
//     scale: 30,
//     folder: 'Wayanad_Exports',
//     maxPixels: 1e13
// });
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