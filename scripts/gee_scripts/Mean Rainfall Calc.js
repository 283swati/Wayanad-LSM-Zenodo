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


// Define the desired resolution
var scale = 100;  // Desired resolution in meters

var endYear = 2024;
print('YEAR : ',endYear);

// Load the TIFF asset (replace with your asset ID)
var asset = ee.Image("projects/ee-ce23resch11016/assets/Raw_IMD_Data/combined_rainfall_"+endYear); // Replace with your asset path
asset = asset.clip(wayanad)

// Get the band names dynamically using ee.String to format them
var bandNames = asset.bandNames();

// Reproject and resample to higher resolution (100 meters)
var reprojected = asset.select(bandNames)
  .resample('bilinear')
  .reproject({
    crs: asset.projection(),
    scale: scale
  });

// Calculate the mean rainfall across all bands
var meanRainfall = reprojected.reduce(ee.Reducer.mean()).rename('b1');

print(meanRainfall)

// Calculate min and max for the sum rainfall (all years)
var meanRainfallstats = meanRainfall.reduceRegion({
  reducer: ee.Reducer.minMax(),
  geometry: wayanad,
  scale: scale,
  maxPixels: 1e9
});

// Print the statistics
print('Mean Rainfall Min/Max:', meanRainfallstats);

// Add the mean rainfall layer to the map
Map.addLayer(meanRainfall.clip(wayanad), {
  min: 3.027946949005127,
  max: 9.834419250488281,  // Adjust these values based on your rainfall data range
  palette: ['blue', 'green', 'yellow', 'orange', 'red']
}, 'Mean Rainfall');

// Export the result as a GeoTIFF
Export.image.toDrive({
  image: meanRainfall.clip(wayanad),
  description: 'Mean_Rainfall_Year_'+endYear+'_Scale_'+ scale +'m',
  scale: scale,  // The desired resolution of 100 meters
  region: wayanad.geometry(),  // Specify the region (bounding box) of the original image
  fileFormat: 'GeoTIFF',
  folder: 'Wayanad_Exports',
  fileNamePrefix: endYear+'mean_rainfall_'+ scale +'m',
  maxPixels: 1e10  // Adjust based on your image size
});

// Export the annual mean image to an Earth Engine Asset
Export.image.toAsset({
  image: meanRainfall.clip(wayanad),
  description: 'Mean_Rainfall_Year_'+endYear+'_Scale_'+ scale +'m',
  assetId: 'projects/ee-ce23resch11016/assets/IMD/' + endYear + 'mean_rainfall_'+ scale +'m', // Modify the assetId path
  region: wayanad.geometry(),
  scale: scale,  // Adjust scale as needed
  maxPixels: 1e13
});

//----------------------------------

// Define min and max values for normalization (Rainfall)
var minRainfall = 3.027946949005127;  // Minimum mean rainfall (2020–2023)
var maxRainfall = 9.834419250488281;  // Maximum mean rainfall (2020–2023)

// Normalize the rainfall
var normalizedRainfall = meanRainfall.subtract(minRainfall).divide(maxRainfall - minRainfall);

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
    description: endYear+'_Normalized_Classiified_Mean_Rainfall_Classes',
    fileNamePrefix: endYear+' Normal-Class Mean Rainfall',
    region: geometry,
    folder: 'Wayanad_Exports',
    scale: 30,
    maxPixels: 1e9
});

//------------------------




//Daily Rainfall

// Function to load and clip mean rainfall data for a specific year
function getMeanRainfallData(year) {
  var rainfall = ee.Image('projects/ee-ce23resch11016/assets/IMD/' + year + 'mean_rainfall_100m');
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
  min: 3.7676804364959255,  // Adjust based on the data range
  max:  9.10249952793363,  // Adjust based on the data range
  palette: ['blue', 'green', 'yellow', 'orange', 'red']
};

// Add the mean rainfall layer to the map
Map.addLayer(IMDRainMeanAllYears, multiYearMeanVis, 'Mean Rainfall ', false);


// Define min and max values for normalization (Mean Rainfall)
var minMeanRainfall = 3.7676804364959255;  // Minimum mean rainfall (2020–2023)
var maxMeanRainfall =  9.10249952793363;  // Maximum mean rainfall (2020–2023)

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
