// Load your uploaded Wayanad shapefile asset
var wayanad = ee.FeatureCollection('projects/ee-ce23resch11016/assets/ISRO_Wayanad_District_BDY');

var geometry = wayanad.geometry();
// Calculate District Area
print('Total District Area (Ha)', geometry.area().divide(10000));

// Load the combined DEM tile from your assets
var combinedDEMTile = ee.Image('projects/ee-ce23resch11016/assets/merged_cdnc43d_cdnc43e');

print('DEM Metadata:', combinedDEMTile.getInfo());

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
//Export
/*
Export.image.toDrive({
    image: wayanadBorder.clip(wayanad),
    description: 'Wayanad Border',
    fileNamePrefix: 'Wayanad Border',
    region: geometry,
    scale: 30,
    maxPixels: 1e9
});

*/


// Calculate elevation statistics
var elevationStats = elevation.unmask(-9999).reduceRegion({
  reducer: ee.Reducer.min()
    .combine(ee.Reducer.max(), '', true)
    .combine(ee.Reducer.mean(), '', true)
    .combine(ee.Reducer.median(), '', true),
  geometry: wayanad,
  scale: 30,  // SRTM resolution is 30 meters
  maxPixels: 1e9
});

// Get elevation statistics
var minElevation = elevationStats.get('elevation_min');
var maxElevation = elevationStats.get('elevation_max');
var meanElevation = elevationStats.get('elevation_mean');
var medianElevation = elevationStats.get('elevation_median');

// Print the elevation statistics
print('Elevation Stats (m)', 'Min:', minElevation, 'Max:', maxElevation, 'Mean:', meanElevation, 'Median:', medianElevation);

// Calculate slope statistics
var slopeStats = slope.unmask(-9999).reduceRegion({
  reducer: ee.Reducer.min()
    .combine(ee.Reducer.max(), '', true)
    .combine(ee.Reducer.mean(), '', true)
    .combine(ee.Reducer.median(), '', true),
  geometry: wayanad,
  scale: 30,  // SRTM resolution is 30 meters
  maxPixels: 1e9
});

// Get slope statistics
var minSlope = slopeStats.get('slope_min');
var maxSlope = slopeStats.get('slope_max');
var meanSlope = slopeStats.get('slope_mean');
var medianSlope = slopeStats.get('slope_median');

// Print the slope statistics
print('Slope Stats (degrees)', 'Min:', minSlope, 'Max:', maxSlope, 'Mean:', meanSlope, 'Median:', medianSlope);

// Given stats for Wayanad
var minElevation = ee.Number(minElevation);
var maxElevation = ee.Number(maxElevation);
var minSlope = ee.Number(minSlope);
var maxSlope = ee.Number(maxSlope);


// Normalize the elevation to [0, 1]
var normalizedElevation = elevation.subtract(minElevation)
                        .divide(maxElevation.subtract(minElevation));

// Normalize the slope to [0, 1]
var normalizedSlope = slope.subtract(minSlope)
                    .divide(maxSlope.subtract(minSlope));

// Visualization of normalized elevation
var elevationVis = {
  min: 0,
  max: 1,
    palette: ['#1a9850', '#91cf60', '#d9ef8b', '#fee08b', '#fc8d59', '#d73027']  // Elevation palette  // Green to Red  
};

// Visualization of normalized slope
var slopeVis = {
  min: 0,
  max: 1,
  palette: ['#006400', '#7CFC00', '#FFFF00', '#FFA500', '#FF0000']  // Color palette for slope
};

// Add normalized layers to the map
Map.addLayer(normalizedElevation.clip(wayanad), elevationVis, 'Normalized Elevation', false);
Map.addLayer(normalizedSlope.clip(wayanad), slopeVis, 'Normalized Slope', false);


// Create hillshade for better terrain visualization
var hillshade = ee.Terrain.hillshade(elevation);

/*
// Refined classification of Elevation based on new statistics
var elevationClasses = ee.Image(0)
  .where(elevation.lt(400), 1)  // 22 - 400m: Very Low Land
  .where(elevation.gte(400).and(elevation.lt(700)), 2)  // 400 - 700m: Low Land
  .where(elevation.gte(700).and(elevation.lt(1000)), 3)  // 700 - 1000m: Moderate
  .where(elevation.gte(1000).and(elevation.lt(1300)), 4)  // 1000 - 1300m: High Land
  .where(elevation.gte(1300).and(elevation.lt(2141)), 5);  // 1300 - 2140m: Very High Land
*/
// Refined classification of normalized elevation
var elevationClasses = ee.Image(0)
  .where(normalizedElevation.lt(0.176), 1)  // 0.0 - 0.176: Very Low Land (22 - 400m)
  .where(normalizedElevation.gte(0.176).and(normalizedElevation.lt(0.318)), 2)  // 0.176 - 0.318: Low Land (400 - 700m)
  .where(normalizedElevation.gte(0.318).and(normalizedElevation.lt(0.455)), 3)  // 0.318 - 0.455: Moderate (700 - 1000m)
  .where(normalizedElevation.gte(0.455).and(normalizedElevation.lt(0.596)), 4)  // 0.455 - 0.596: High Land (1000 - 1300m)
  .where(normalizedElevation.gte(0.596), 5);  // 0.596 - 1.0: Very High Land (1300 - 2141m)
  

// Aspect Classification
var aspectClasses = ee.Image(0)
  .where(aspect.gte(0).and(aspect.lt(45)), 1)  // North (0-45), Red (#ff0000)
  .where(aspect.gte(45).and(aspect.lt(90)), 2)  // Northeast (45-90), Yellow-Orange (#f46d43)
  .where(aspect.gte(90).and(aspect.lt(135)), 3)  // East (90-135), Yellow (#fee08b)
  .where(aspect.gte(135).and(aspect.lt(180)), 4)  // Southeast (135-180), Green (#74add1)
  .where(aspect.gte(180).and(aspect.lt(225)), 5)  // South (180-225), Cyan (#00ffff)
  .where(aspect.gte(225).and(aspect.lt(270)), 6)  // Southwest (225-270), Light Blue (#add8e6)
  .where(aspect.gte(270).and(aspect.lt(315)), 7)  // West (270-315), Dark Blue (#00008b)
  .where(aspect.gte(315).and(aspect.lt(360)), 8); // Northwest (315-360), Purple (#800080)

/*
// Slope Classification
var slopeClasses = ee.Image(0)
  .where(slope.lt(10), 1)  // 0 - 10 degrees: Flat
  .where(slope.gte(10).and(slope.lt(20)), 2)  // 10 - 20 degrees: Gentle
  .where(slope.gte(20).and(slope.lt(30)), 3)  // 20 - 30 degrees: Medium
  .where(slope.gte(30).and(slope.lt(40)), 4)  // 30 - 40 degrees: Steep
  .where(slope.gte(40).and(slope.lt(64.73)), 5);  // 40 - 64.73 degrees: Very Steep
*/
// Refined classification of normalized slope
var slopeClasses = ee.Image(0)
  .where(normalizedSlope.lt(0.154), 1)  // 0.0 - 0.154: Flat (0 - 10 degrees)
  .where(normalizedSlope.gte(0.154).and(normalizedSlope.lt(0.309)), 2)  // 0.154 - 0.309: Gentle (10 - 20 degrees)
  .where(normalizedSlope.gte(0.309).and(normalizedSlope.lt(0.464)), 3)  // 0.309 - 0.464: Medium (20 - 30 degrees)
  .where(normalizedSlope.gte(0.464).and(normalizedSlope.lt(0.618)), 4)  // 0.464 - 0.618: Steep (30 - 40 degrees)
  .where(normalizedSlope.gte(0.618), 5);  // 0.618 - 1.0: Very Steep (40 - 64.73 degrees)

// Visualization settings for Elevation, aspect and slope
var aspectClassVis = {
  min: 1,
  max: 8,
  palette: ['#f46d43', '#ffcc00', '#66ff00', '#00ffff', '#99ccff', '#0033cc', '#cc00cc', '#ff0000']
};

var slopeClassVis = {
  min: 1,
  max: 5,
  palette: ['#006400', '#7CFC00', '#FFFF00', '#FFA500', '#FF0000']
};

var elevationClassVis = {
  min: 1,
  max: 5,
  palette: ['#1a9850', '#91cf60', '#d9ef8b', '#fee08b', '#d73027']  // Elevation palette
};

// Add layers to the map
Map.addLayer(elevationClasses.clip(wayanad), elevationClassVis, 'Classified Elevation', false);
Map.addLayer(aspectClasses.clip(wayanad), aspectClassVis, 'Classified Aspect', false);
Map.addLayer(slopeClasses.clip(wayanad), slopeClassVis, 'Classified Slope', false);

//Export 
/*
//var visualizedElevationClasses = elevationClasses.visualize(elevationClassVis);
Export.image.toDrive({
    image: elevationClasses.clip(wayanad),
    description: 'Classified Elevation',
    fileNamePrefix: 'Classified Elevation',
    region: geometry,
    scale: 30,
    maxPixels: 1e9
});

//var visualizedAspectClasses = aspectClasses.visualize(aspectClassVis);
Export.image.toDrive({
    image: aspectClasses.clip(wayanad),
    description: 'Classified Aspect',
    fileNamePrefix: 'Classified Aspect',
    region: geometry,
    scale: 30,
    maxPixels: 1e9
});

//var visualizedSlopeClasses = slopeClasses.visualize(slopeClassVis);
Export.image.toDrive({
    image: slopeClasses.clip(wayanad),
    description: 'Classified Slope',
    fileNamePrefix: 'Classified Slope',
    region: geometry,
    scale: 30,
    maxPixels: 1e9
});
*/

// Compute Slope from Cartosat DEM
var slopeC = ee.Terrain.slope(combinedDEMTile);
// Apply a focal mean filter (smoothing window) to approximate curvature
var focalMeanSlope = slopeC.convolve(ee.Kernel.circle(3, 'pixels', true));
var curvature = slopeC.subtract(focalMeanSlope);

// Calculate min and max for the curvature
var meanCurvatureStats = curvature.reduceRegion({
  reducer: ee.Reducer.minMax(),
  geometry: wayanad,
  scale: 30,
  maxPixels: 1e9
});

// Print the statistics
print('Curvature Min/Max:', meanCurvatureStats);
// Visualization parameters
var curvatureVis = {
  min: -32.35331877346697,
  max: 30.952058800335596,
  palette: ['#FF0000', '#FFFFFF', '#0000FF'] // Concave: Red, Flat: White, Convex: Blue
};

// Add curvature layer to the map
Map.addLayer(curvature.clip(wayanad), curvatureVis, 'Curvature (Focal Slope)', false);

// Export the curvature as a GeoTIFF to Google Drive
Export.image.toDrive({
  image: curvature.clip(wayanad),  // Image to export
  description: 'Curvature_Export',  // Task description
  folder: 'Wayanad_Exports',  // Optional: Specify the folder in Google Drive
  fileNamePrefix: 'curvature',  // Prefix for the exported file name
  region: geometry,  // Region of interest to export
  scale: 30,  // Pixel size (in meters)
  crs: 'EPSG:4326',  // Coordinate reference system
  //maxPixels: 1e8,  // Maximum number of pixels to export (adjust if needed)
  fileFormat: 'GeoTIFF'  // Export as GeoTIFF
});


// Add hillshade layer on top of the elevation
Map.addLayer(hillshade.clip(wayanad), {min: 100, max: 255, palette: ['black', 'white']}, 'Hillshade', false, 0.5); // 50% transparency

// Calculate min and max hillshade values
var hillshadeStats = hillshade.reduceRegion({
  reducer: ee.Reducer.minMax(),
  geometry: wayanad,
  scale: 30,
  maxPixels: 1e9
});

// Extract min and max values
var minHillshade = hillshadeStats.get('hillshade_min');
var maxHillshade = hillshadeStats.get('hillshade_max');

// Print the values to the console
print('Min Hillshade:', minHillshade);
print('Max Hillshade:', maxHillshade);

// Create visualization parameters using dynamic range
var hillshadeVis = {
  min: ee.Number(minHillshade).getInfo(),
  max: ee.Number(maxHillshade).getInfo(),
  palette: ['black', 'white'] // You can adjust the palette as needed
};

// Add dynamic hillshade layer with transparency (opacity set to 50% here)
Map.addLayer(hillshade.clip(wayanad), hillshadeVis, 'Dynamic Hillshade', true, 0.4); // Opacity set to 0.5 (50%)




// Define a window size (in meters) for local relief calculation
var windowSize = 500;  // Adjust this based on the size of features of interest

// Calculate the local max and min elevation in the moving window
var localMax = elevation.reduceNeighborhood({
  reducer: ee.Reducer.max(),
  kernel: ee.Kernel.square(windowSize / 2, 'meters')
});

var localMin = elevation.reduceNeighborhood({
  reducer: ee.Reducer.min(),
  kernel: ee.Kernel.square(windowSize / 2, 'meters')
});

// Calculate the local relief as the difference between local max and min elevation
var localRelief = localMax.subtract(localMin).rename('elevation');

// Visualization for local relief
var reliefVis = {
  min: 0,
  max: 300,  // Adjust based on the expected range of relief values
  palette: ['white', 'blue', 'green', 'yellow', 'red']  // Gradient for relief visualization
};

// Add local relief to the map
Map.addLayer(localRelief.clip(wayanad), reliefVis, 'Local Relief', false);
// Normalize the local relief to the range 0-1
var minRelief = localRelief.reduceRegion({
  reducer: ee.Reducer.min(),
  geometry: wayanad,
  scale: 30,
  maxPixels: 1e8
}).get('elevation');  // Assuming 'elevation' is the band name in your elevation dataset

var maxRelief = localRelief.reduceRegion({
  reducer: ee.Reducer.max(),
  geometry: wayanad,
  scale: 30,
  maxPixels: 1e8
}).get('elevation');  // Assuming 'elevation' is the band name in your elevation dataset

// Convert to float for division
minRelief = ee.Number(minRelief);
maxRelief = ee.Number(maxRelief);

// Normalize the local relief
var normalizedRelief = localRelief.subtract(minRelief).divide(maxRelief.subtract(minRelief));

/*
// Classify the local relief into the three categories based on the specified thresholds for Wayanad
var reliefClasses = ee.Image(0)
  .where(localRelief.lte(1000), 1)  // 0 - 1000m: Low Relief (e.g., Green)
  .where(localRelief.gt(1000).and(localRelief.lte(2000)), 2)  // 1000m - 2000m: Mid Relief (e.g., Yellow)
  .where(localRelief.gt(2000), 3);  // >2000m: High Relief (e.g., Red)
*/
// Classify the normalized relief into three categories
var reliefClasses = ee.Image(0)
  .where(normalizedRelief.lte(0.33), 1)  // Low Relief (0 to 0.33)
  .where(normalizedRelief.gt(0.33).and(normalizedRelief.lte(0.66)), 2)  // Mid Relief (0.33 to 0.66)
  .where(normalizedRelief.gt(0.66), 3);  // High Relief (0.66 to 1)


// Visualization parameters for the relief classification
var reliefClassVis = {
  min: 1,
  max: 3,
  palette: ['#1a9850', '#fee08b', '#d73027']  // Color palette: Green, Yellow, Red
}; 

// Add the classified relief layer to the map
Map.addLayer(reliefClasses.clip(wayanad), reliefClassVis, 'Classified Relief', false);

var reliefClasses = ee.Image('projects/ee-ce23resch11016/assets/Relief_Classes');
/*
//Export
//var visualizedLocalRelief = localRelief.visualize(reliefVis);
Export.image.toDrive({
    image: reliefClasses.clip(wayanad),
    description: 'Classed Relief',
    fileNamePrefix: 'Classed Relief',
    region: geometry,
    scale: 30,
    maxPixels: 1e9
});
*/




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

// Dynamic World land cover class names
var classNames = [
  'Water', 'Trees', 'Grass', 'Flooded Vegetation', 'Crops', 'Shrub', 
  'Built Area', 'Bare Ground', 'Snow/Ice'
];

// Define a color palette for each class
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

// Visualization parameters
var lulcVis = {
  min: 0,
  max: 8,  // Dynamic World has 9 classes, from 0 (water) to 8 (snow/ice)
  palette: landcoverPalette
};

// Add the LULC layer to the map
Map.addLayer(dwImage.select('label').clip(wayanad), lulcVis, 'LULC Dynamic World', false);
// Display a legend (optional)
print('Land Cover Classes:', classNames);
/*
//Export
var visualizedLulcDynamicWorld = dwImage.select('label').visualize(lulcVis);
Export.image.toDrive({
    image: visualizedLulcDynamicWorld.clip(wayanad),
    description: 'LULC Dynamic World',
    fileNamePrefix: 'LULC Dynamic World',
    region: geometry,
    scale: 30,
    maxPixels: 1e9
});
*/

//Scale for Interpolation (e.g., 0.01 degree)
//Optionally, resample to higher resolution (e.g., 0.01 degree)
var scale = 100; // Approx. 0.01 degrees at the equator



//SoilMoisture
/*
// Load the NASA SMAP Global Soil Moisture product for a specific date range
var smapDataset = ee.ImageCollection("NASA/SMAP/SPL4SMGP/007")
                    .filterDate('2023-01-01', '2024-01-01') // Adjust date as needed
                    .filterBounds(wayanad);

//Interpolation of SoilMoisture data to 0.01 Degree
//Optionally, resample to higher resolution (e.g., 0.01 degree)
var scale = 1113.2; // Approx. 0.01 degrees at the equator

// Resample and reproject each image in the collection
var smapDataset = smapDataset.map(function(image) {
  return image.resample('bilinear').reproject({   // Options: 'nearest', 'bilinear', 'cubic'
    crs: image.projection(),
    scale: scale
  });
});


// Function to calculate daily means
var dailyMeans = ee.ImageCollection(
  smapDataset.map(function(image) {
    var date = image.date().format('YYYY-MM-dd');
    return image.set('system:time_start', ee.Date(date).millis());
  })
  .distinct(['system:time_start'])
  .map(function(dateImage) {
    var date = ee.Date(dateImage.get('system:time_start'));
    var dailyImages = smapDataset.filterDate(date, date.advance(1, 'day'));
    var dailyMean = dailyImages.mean();
    return dailyMean.set('system:time_start', date.millis());
  })
);

// Combine all daily means into a single mean image for the entire time period
var meanSoilMoistureImage = dailyMeans.mean();

// Export each daily mean as an individual raster
// Convert the dailyMeans collection to a list
var dailyList = dailyMeans.toList(dailyMeans.size());

// Loop through each daily raster and create an export task
var numDays = dailyList.size().getInfo(); // Get the number of daily images
for (var i = 0; i < numDays; i++) {
  var dailyImage = ee.Image(dailyList.get(i)); // Get the daily image
  
  // Generate a sequential label for each day (e.g., day1, day2, ...)
  var dayLabel = 'day' + (i + 1); // Add 1 to make it 1-based indexing
  
  // Create an export task for each image
  Export.image.toDrive({
    image: dailyImage,
    description: 'DailySoilMoisture_' + dayLabel,
    folder: 'Wayanad Daily Exports', // Google Drive folder
    fileNamePrefix: 'daily_soil_moisture_' + dayLabel,
    region: wayanad.geometry(),
    scale: 1113.2, // Approx. 0.01 degrees at the equator
    crs: 'EPSG:4326', // WGS84 projection
    maxPixels: 1e9
  });
}

*/

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
  min: 0.2312639206647873, // Adjust based on the calculated range
  max: 0.3281596004962921, // Adjust based on the calculated range
  palette: ['blue', 'cyan', 'green', 'yellow', 'orange', 'red'] // Enhanced palette
};

// Visualization parameters for rootzone soil moisture
var rootzoneSoilMoistureVis = {
  min: 0.2637767791748047, // Adjust based on the calculated range
  max: 0.35374128818511963, // Adjust based on the calculated range
  palette: ['#0000FF', '#00FFFF', '#00FF00', '#FFFF00', '#FFA500', '#FF0000'] // Enhanced palette
};

// Add mean surface soil moisture layer to the map
Map.addLayer(surfaceSoilMoistureAllYears.clip(wayanad), surfaceSoilMoistureVis, 'Mean Surface Soil Moisture', false);

// Add mean rootzone soil moisture layer to the map
Map.addLayer(rootzoneSoilMoistureAllYears.clip(wayanad), rootzoneSoilMoistureVis, 'Mean Rootzone Soil Moisture', false);

// Define min and max values for normalization (Surface Soil Moisture)
var minSurfaceSoilMoisture = 0.19790348410606384;  // Minimum surface soil moisture (2020–2023)
var maxSurfaceSoilMoisture = 0.30830562114715576;  // Maximum surface soil moisture (2020–2023)

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
var minRootzoneSoilMoisture = 0.23429709672927856;  // Minimum rootzone soil moisture (2020–2023)
var maxRootzoneSoilMoisture = 0.3374875485897064;  // Maximum rootzone soil moisture (2020–2023)

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
    description: 'Classified Normalized Surface Soil Moisture',
    fileNamePrefix: 'Classified Normalized Surface Soil Moisture',
    region: geometry,
    scale: 30,
    maxPixels: 1e9
});
Export.image.toDrive({
    image: rootzoneSoilMoistureClasses.clip(wayanad),
    description: 'Classified Normalized Rootzone Soil Moisture',
    fileNamePrefix: 'Classified Normalized Rootzone Soil Moisture',
    region: geometry,
    scale: 30,
    maxPixels: 1e9
});




//Daily Rainfall

// Function to load and clip mean rainfall data for a specific year
function getMeanRainfallData(year) {
  var rainfall = ee.Image('projects/ee-ce23resch11016/assets/IMD/' + year + 'mean_rainfall_100m');
  return rainfall.clip(wayanad);
}

// Function to load and clip sum rainfall data for a specific year
/*
function getSumRainfallData(year) {
  var rainfall = ee.Image('projects/ee-ce23resch11016/assets/IMD/' + year + '_Sum_Rainfall');
  return rainfall.clip(wayanad);
}
*/

// Years for which data is available
var years = [endYear-3,endYear-2,endYear-1,endYear];
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

/*
// Load and combine sum rainfall data for all years
var sumRainfallImages = years.map(function(year) {
  return getSumRainfallData(year);
});

// Compute the average of the sum rainfall across all years
var IMDRainSumAllYears = ee.ImageCollection(sumRainfallImages).mean().rename('precipitation');

// Calculate min and max for the sum rainfall (all years)
var sumStatsAllYears = IMDRainSumAllYears.reduceRegion({
  reducer: ee.Reducer.minMax(),
  geometry: wayanad,
  scale: scale,
  maxPixels: 1e9
});
*/

// Print the statistics
print('Mean Rainfall Min/Max:', meanStatsAllYears);
//print('Sum Rainfall (2020–2023) Min/Max:', sumStatsAllYears);

// Visualization parameters for mean rainfall
var multiYearMeanVis = {
  min: 2.823505982333164,  // Adjust based on the data range
  max: 6.435402457386337,  // Adjust based on the data range
  palette: ['blue', 'green', 'yellow', 'orange', 'red']
};

// Visualization parameters for sum rainfall
/*
var multiYearSumVis = {
  min: 1394.1278,  // Adjust based on the data range
  max: 3142.7955,  // Adjust based on the data range
  palette: ['blue', 'green', 'yellow', 'orange', 'red']
};
*/

// Add the mean rainfall layer to the map
Map.addLayer(IMDRainMeanAllYears, multiYearMeanVis, 'Mean Rainfall ', false);

// Add the sum rainfall layer to the map
//Map.addLayer(IMDRainSumAllYears, multiYearSumVis, 'Sum Rainfall (2020–2023)', false);

// Define min and max values for normalization (Mean Rainfall)
var minMeanRainfall = 2.7731274273228532;  // Minimum mean rainfall (2020–2023)
var maxMeanRainfall = 6.454396657208099;  // Maximum mean rainfall (2020–2023)

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
    description: 'Normalized Classiified Mean Rainfall Classes',
    fileNamePrefix: 'Normalized Classiified Mean Rainfall Classes',
    region: geometry,
    scale: 30,
    maxPixels: 1e9
});
/*
// Define min and max values for normalization
var minSumRainfall = 1394.1278;  // Minimum sum rainfall (2020–2023)
var maxSumRainfall = 3142.7955;  // Maximum sum rainfall (2020–2023)

// Normalize the sum rainfall
var normalizedSumRainfall = IMDRainSumAllYears.subtract(minSumRainfall).divide(maxSumRainfall - minSumRainfall);

// Classify normalized rainfall into categories
var sumRainfallClasses = ee.Image(0)
  .where(normalizedSumRainfall.lt(0.306), 1)  // Dark Green: 0.0 - 0.306 
  .where(normalizedSumRainfall.gte(0.306).and(normalizedSumRainfall.lt(0.445)), 2)  // Olive Green: 0.306 - 0.445 
  .where(normalizedSumRainfall.gte(0.445).and(normalizedSumRainfall.lt(0.584)), 3)  // Light Yellow: 0.445 - 0.584 
  .where(normalizedSumRainfall.gte(0.584).and(normalizedSumRainfall.lt(0.725)), 4)  // Light Gray: 0.584 - 0.725 
  .where(normalizedSumRainfall.gte(0.725), 5);  // Cream Yellow: 0.725 - 1.0 (~3,057.4 - 3,814.4)

// Visualization for the rainfall classes
var sumRainfallClassesVis = {
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
Map.addLayer(sumRainfallClasses.clip(wayanad), sumRainfallClassesVis, 'Normalized Classiified Sum Rainfall Classes (2020–2023)', false);
Export.image.toDrive({
    image: sumRainfallClasses.clip(wayanad),
    description: 'Normalized Classiified Sum Rainfall Classes',
    fileNamePrefix: 'Normalized Classiified Sum Rainfall Classes',
    region: geometry,
    scale: 30,
    maxPixels: 1e9
});
*/





/*
//Visializing the Bhuvan extracted Geomorpgology, Lineament and LULC(2015-16 at 50k resol. and 2018-23 at 10k resol.)

var Wayanad_Geomorphology = ee.Image('projects/ee-ce23resch11016/assets/10000x10000_Wayanad_Geomorphology_Bhuvan');
var Wayanad_Lineament = ee.Image('projects/ee-ce23resch11016/assets/10000x10000_Wayanad_Lineament_Bhuvan');
var Wayanad_LULC_2015_16 = ee.Image('projects/ee-ce23resch11016/assets/10000x10000_Wayanad_LULC_2015-16_50k_Bhuvan');
var Wayanad_LULC_2018_23 = ee.Image('projects/ee-ce23resch11016/assets/10000x10000_Wayanad_LULC_2018-23_10k_Bhuvan');


Map.addLayer(Wayanad_Geomorphology.clip(wayanad), {}, 'Wayanad_Geomorphology');
Map.addLayer(Wayanad_Lineament.clip(wayanad), {}, 'Wayanad_Lineament');
Map.addLayer(Wayanad_LULC_2015_16.clip(wayanad), {}, 'Wayanad_LULC_2015-16');
Map.addLayer(Wayanad_LULC_2018_23.clip(wayanad), {}, 'Wayanad_LULC_2018-23');
*/




//Bhukosh Geology

// Load the geoology shapefile asset and clip to Wayanad boundaries
var geology = ee.FeatureCollection('projects/ee-ce23resch11016/assets/Bhukosh_Assets/Geology_2M_Bhukosh');
geology = geology.filterBounds(geometry);

// Get the distinct categories in the 'STRATIGRAP' field after clipping
var stratigrapCategories = geology.aggregate_array('STRATIGRAP').distinct();
print('Unique Categories in Geology in Stratigrap:', stratigrapCategories);

// Define the updated color palette based on geological conventions
var geologyColorPalette = [
  '#ff9999',  // Acid Intrusive / Granite / Granodiorite (Neoproterozoic) - Light Pink
  '#ff6666',  // Chamundi Granite (Neoproterozoic) - Dark Pink
  '#666666',  // Gabbro-Anorthosite Complex (Neoproterozoic) - Dark Gray
  '#cc9966',  // Intermediate Intrusive (Neoproterozoic) - Light Red/Brown
  '#ffcc33',  // Satyamangalam Gp. (Archaean) - Orange
  '#8B4513',  // Wayanad Gp. (Archaean) - Dark Brown
  '#A9A9A9',  // Peninsular Gneissic Complex-I (Archaean) - Gray
  '#006400',  // Charnockite Gneissic Complex (Southern Granulite Terrain) - Dark Green
  '#7CFC00'   // Migmatite Gneissic Complex (Southern Granulite Terrain) - Light Green
];

// Define the category list
var geologyCategoryList = [
  '915,ACID  INTRUSIVE / GRANITE / GRANODIORITE,NEOPROTEROZOIC',
  '915,CHAMUNDI GRANITE,NEOPROTEROZOIC',
  '915,GABBRO-ANORTHOSITE COMPLEX,NEOPROTEROZOIC',
  '915,INTERMEDIATE  INTRUSIVE,NEOPROTEROZOIC',
  '997,SATYAMANGALAM Gp.,ARCHAEAN',
  '997,WYANAD Gp.,ARCHAEAN',
  '996,PENINSULAR GNEISSIC COMPLEX-I,ARCHAEAN',
  '978,CHARNOCKITE GNEISSIC COMPLEX (SOUTHERN GRANULITE TERRAIN),ARCHAEAN - PROTEROZOIC',
  '978,MIGMATITE GNEISSIC COMPLEX (SOUTHERN GRANULITE TERRAIN),ARCHAEAN - PROTEROZOIC'
];

// Create a dictionary mapping categories to colors
var geologyCategoryColorDict = ee.Dictionary.fromLists(geologyCategoryList, geologyColorPalette);

// Function to set the style based on the STRATIGRAP field
var styleFunction = function(feature) {
  var category = ee.String(feature.get('STRATIGRAP')).trim(); // Get and trim category
  var color = geologyCategoryColorDict.get(category, '#ffffff'); // Lookup color in dictionary, default to white if not found
  return feature.set('style', {color: color, width: 1}); // Apply style to feature
};

// Apply the style function to the feature collection
var styledGeology = geology.map(styleFunction);

// Add the styled layer to the map
Map.addLayer(styledGeology.style({styleProperty: 'style'}).clip(wayanad), {}, 'Geology', false);

// Function to set the style and add category information for ML
var geologyWithCategories = geology.map(function(feature) {
  var category = ee.String(feature.get('STRATIGRAP')).trim();
  var color = geologyCategoryColorDict.get(category, '#ffffff');  // Default to white if not found
  return feature.set('color', color).set('category', category);  // Add category and color
});
// This variable can now be used directly for ML models
var styledGeologyML = geologyWithCategories.map(function(feature) {
  return feature.set('style', {color: feature.get('color'), width: 1});
});
// Add the styled layer to the map for visualization
//Map.addLayer(styledGeology.style({styleProperty: 'style'}).clip(wayanad), {}, 'Styled Geology', false);




//Bhukosh Geomorphology

// Load the geomorphology shapefile asset and clip to Wayanad boundaries
var geomorphology = ee.FeatureCollection('projects/ee-ce23resch11016/assets/Bhukosh_Assets/Geomorphology_250K_Bhukosh');
geomorphology = geomorphology.filterBounds(geometry);

// Get the distinct categories in the 'DESCRIPTIO' field after clipping
var DESCRIPTIOCategories = geomorphology.aggregate_array('DESCRIPTIO').distinct();
print('Unique Categories in Geomorphology in DESCRIPTIO:', DESCRIPTIOCategories);

// Define the updated color palette based on geomorphology conventions
var geomorphologyColorPalette = [
  '#4682B4',  // Dam and Reservoir - Steel Blue
  '#FFD700',  // Active Flood Plain - Gold
  '#CD5C5C',  // Highly Dissected Denudational Hills and Valleys - Indian Red
  '#A52A2A',  // Highly Dissected Structural Hills and Valleys - Brown
  '#8B4513',  // Highly Dissected Structural Upper Plateau - Saddle Brown
  '#98FB98',  // Low Dissected Denudational Hills and Valleys - Pale Green
  '#6B8E23',  // Low Dissected Structural Hills and Valleys - Olive Drab
  '#32CD32',  // Moderately Dissected Denudational Hills and Valleys - Lime Green
  '#556B2F',  // Moderately Dissected Structural Hills and Valleys - Dark Olive Green
  '#DAA520',  // Moderately Dissected Denudational Lower Plateau - Goldenrod
  '#D2691E',  // Moderately Dissected Denudational Upper Plateau - Chocolate
  '#F4A460',  // Pediment Pediplain Complex - Sandy Brown
  '#FF4500',  // Active Quarry - Orange Red
  '#00BFFF',  // Pond - Deep Sky Blue
  '#1E90FF'   // River - Dodger Blue
];

// Define the category list
var geomorphologyCategoryList = [
  'Dam and Reservoir',
  'Active Flood Plain',
  'Highly Dissected Denudational Hiils and Valleys',
  'Highly Dissected Structural Hills and Valleys',
  'Highly Dissected Structural Upper Plateau',
  'Low Dissected Denudational Hills and Valleys',
  'Low Dissected Structural Hills and Valleys',
  'Moderately Dissected Denudational Hills and Valleys',
  'Moderately Dissected Structural Hills and Valleys',
  'Moderately Dissected Denudational Lower Plateau',
  'Moderately Dissected Denudational Upper Plateau',
  'Pediment Pediplain Complex',
  'Active Quarry',
  'Pond',
  'River'
];

// Create a dictionary mapping categories to colors
var geomorphologyCategoryColorDict = ee.Dictionary.fromLists(geomorphologyCategoryList, geomorphologyColorPalette);

// Function to set the style based on the DESCRIPTIO field
var styleFunction = function(feature) {
  var category = ee.String(feature.get('DESCRIPTIO')).trim(); // Get and trim category
  var color = geomorphologyCategoryColorDict.get(category, '#ffffff'); // Lookup color in dictionary, default to white if not found
  return feature.set('style', {color: color, width: 1}); // Apply style to feature
};

// Apply the style function to the feature collection
var styledGeomorphology = geomorphology.map(styleFunction);

// Add the styled layer to the map
Map.addLayer(styledGeomorphology.style({styleProperty: 'style'}).clip(wayanad), {}, 'Geomorphology', false);

// Function to set the style and add category information for ML
var geomorphologyWithCategories = geomorphology.map(function(feature) {
  var category = ee.String(feature.get('DESCRIPTIO')).trim();
  var color = geomorphologyCategoryColorDict.get(category, '#ffffff');  // Default to white if not found
  return feature.set('color', color).set('category', category);  // Add category and color
});
// This variable can now be used directly for ML models
var styledGeomorphologyML = geomorphologyWithCategories.map(function(feature) {
  return feature.set('style', {color: feature.get('color'), width: 1});
});
// Add the styled layer to the map for visualization
//Map.addLayer(styledGeomorphologyML.style({styleProperty: 'style'}).clip(wayanad), {}, 'Styled Geomorphology', false);



//Bhukosh Lineament

// Load the lineament shapefile asset and clip to Wayanad boundaries
var lineament = ee.FeatureCollection('projects/ee-ce23resch11016/assets/Bhukosh_Assets/Lineament_250K_Bhukosh');
lineament = lineament.filterBounds(geometry);

// Get the distinct categories in the 'L2DESCRIPT' field after clipping
var L2DESCRIPT_Categories = lineament.aggregate_array('L2DESCRIPT').distinct();
print('Unique Categories in Lineament in L2DESCRIPT:', L2DESCRIPT_Categories);

// Define the updated color palette based on lineament conventions
var lineamentColorPalette = [
  '#4682B4',  // Drainage parallel - Steel Blue
  '#FFD700',  // Ridge parallel - Gold
  '#A52A2A'   // Joint/Fracture - Brown
];

// Define the category list
var lineamentCategoryList = [
  'Drainage parallel',
  'Ridge parallel',
  'Joint/Fracture'
];

// Create a dictionary mapping categories to colors
var lineamentCategoryColorDict = ee.Dictionary.fromLists(lineamentCategoryList, lineamentColorPalette);

// Function to set the style based on the L2DESCRIPT field
var styleFunction = function(feature) {
  var category = ee.String(feature.get('L2DESCRIPT')).trim(); // Get and trim category
  var color = lineamentCategoryColorDict.get(category, '#ffffff'); // Lookup color in dictionary, default to white if not found
  return feature.set('style', {color: color, width: 1}); // Apply style to feature
};

// Apply the style function to the feature collection
var styledLineament = lineament.map(styleFunction);

// Add the styled layer to the map
Map.addLayer(styledLineament.style({styleProperty: 'style'}).clip(wayanad), {}, 'Lineament', false);

// Function to set the style and add category information for ML
var lineamentWithCategories = lineament.map(function(feature) {
  var category = ee.String(feature.get('L2DESCRIPT')).trim();
  var color = lineamentCategoryColorDict.get(category, '#ffffff');  // Default to white if not found
  return feature.set('color', color).set('category', category);  // Add category and color
});

// This variable can now be used directly for ML models
var styledLineamentML = lineamentWithCategories.map(function(feature) {
  return feature.set('style', {color: feature.get('color'), width: 1});
});

// Add the styled layer to the map for visualization
// Map.addLayer(styledLineamentML.style({styleProperty: 'style'}).clip(wayanad), {}, 'Styled Lineament', false);





//Bhukosh Lithology

// Load the lithology shapefile asset and clip to Wayanad boundaries
var lithology = ee.FeatureCollection('projects/ee-ce23resch11016/assets/Bhukosh_Assets/Lithology_Bhukosh');
lithology = lithology.filterBounds(geometry);

// Get the distinct categories in the 'STRATIGRAP' field after clipping
var STRATIGRAP_Categories = lithology.aggregate_array('STRATIGRAP').distinct();
print('Unique Categories in lithology in STRATIGRAP:', STRATIGRAP_Categories);

// Define the updated color palette based on lithology conventions
var lithologyColorPalette = [
  '#ff6347',  // ARCHAEAN , GRANITE GNEISS - Tomato
  '#8a2be2',  // ARCHAEAN , GREY HORNBLENDE BIOTITE GNEISS - Blue Violet
  '#5f9ea0',  // ARCHAEAN , GNEISS - Cadet Blue
  '#7fff00',  // ARCHAEAN , GARNET-HORNBLENDE GNEISS - Chartreuse
  '#daa520',  // ARCHAEAN , SERICITE SCHIST - Goldenrod
  '#ff4500',  // ARCHAEAN , TALC TREMOLITE ACTINOLITE SCHIST - Orange Red
  '#228b22',  // ARCHAEAN , QUARTZ-FELDSPAR-GARNET GRANULITE - Forest Green
  '#228b22',  // ARCHAEAN , QUARTZ-FELDSPAR-GARNET GRANULITE - Forest Green
  '#4682b4',  // ARCHAEAN , GAR-BIO-SILL GNEISS + GRAPHITE + KYANITE - Steel Blue
  '#db7093',  // ARCHAEAN , BANDED IRON FORMATION - Pale Violet Red
  '#b8860b',  // ARCHAEAN , FUCHSITE QUARTZITE - Dark Goldenrod
  '#6a5acd',  // ARCHAEAN , GARNET-SILLIMANITE-GNEISS + GRAPHITE + CORDIERITE - Slate Blue
  '#9932cc',  // ARCHAEAN , GRAPHITE-BIOTITE SCHIST - Dark Orchid
  '#8b4513',  // ARCHAEAN , SILLIMANITE-KYANITE-QUARTZ SCHIST - Saddle Brown
  '#1e90ff',  // ARCHAEAN , AMPHIBOLITE - Dodger Blue
  '#00fa9a',  // ARCHAEAN , TALC TREMOLITE SCHIST - Medium Spring Green
  '#ffdead',   // ARCHAEAN , FUCHSITE-KYANITE QUARTZITE - Navajo White
  '#ffd700',   // ARCHAEAN , BANDED MAGNETITE QUARTZITE - Gold
  '#20b2aa',   // ARCHAEAN-PROTEROZOIC , HORNBLENDE-BIOTITE GNEISS - Light Sea Green
  '#ff1493',   // ARCHAEAN-PROTEROZOIC , BIOTITE GNEISS - Deep Pink
  '#ff8c00',   // ARCHAEAN-PROTEROZOIC , ACID TO INTERMEDIATE CHARNOCKITE - Dark Orange
  '#8fbc8f',   // ARCHAEAN-PROTEROZOIC , PYROXENE GRANULITE - Dark Sea Green
  '#9370db',   // NEOPROTEROZOIC , PINK GRANITE - Medium Purple
  '#00bfff',   // NEOPROTEROZOIC , QUARTZ VEIN/REEF - Deep Sky Blue
  '#add8e6',   // NEOPROTEROZOIC , PEGMATITE - Light Blue
  '#d2691e',   // NEOPROTEROZOIC , GRANITE - Chocolate
  '#b0e0e6',   // NEOPROTEROZOIC , DIORITE - Powder Blue
  '#cd5c5c',   // NEOPROTEROZOIC , GABBRO - Indian Red
  '#f08080',   // NEOPROTEROZOIC , ANORTHOSITE GABBRO - Light Coral
  '#ffb6c1',   // NEOPROTEROZOIC , PINK GRANITE - Light Pink
  '#7b68ee',   // ARCHAEAN , BANDED IRON FORMATION - Medium Slate Blue
  '#ff69b4',   // ARCHAEAN , GARNET-SILLIMANITE-GNEISS + GRAPHITE + CORDIERITE - Hot Pink
  '#dcdcdc',   // ARCHAEAN , SILLIMANITE-KYANITE-QUARTZ SCHIST - Gainsboro
  '#ffe4b5',   // ARCHAEAN-PROTEROZOIC , BIOTITE GNEISS - Moccasin
  '#cd853f',   // NEOPROTEROZOIC , GABBRO - Peru
  '#778899',   // NEOPROTEROZOIC , ANORTHOSITE GABBRO - Light Slate Gray
];

// Define the category list
var lithologyCategoryList = [
  '9998979991980110,ARCHAEAN , GRANITE GNEISS,4889',
  '9998979991988114,ARCHAEAN , GREY HORNBLENDE BIOTITE GNEISS,4897',
  '9998979991990119,ARCHAEAN , GNEISS,4899',
  '9998979991992132,ARCHAEAN , GARNET-HORNBLENDE GNEISS,4901',
  '9999989997983279,ARCHAEAN , SERICITE SCHIST,4931',
  '9999989997984293,ARCHAEAN , TALC TREMOLITE ACTINOLITE SCHIST,4932',
  '9999989997985250,ARCHAEAN , QUARTZ-FELDSPAR-GARNET GRANULITE,4932',
  '9999989997985250,ARCHAEAN , QUARTZ-FELDSPAR-GARNET GRANULITE,4933',
  '9999989997989102,ARCHAEAN , GAR-BIO-SILL GNEISS + GRAPHITE + KYANITE,4937',
  '9999989997990029,ARCHAEAN , BANDED IRON FORMATION,4938',
  '9999989997991095,ARCHAEAN , FUCHSITE QUARTZITE,4939',
  '9999989997992124,ARCHAEAN , GARNET-SILLIMANITE-GNEISS + GRAPHITE + CORDIERITE,4940',
  '9999989997993103,ARCHAEAN , GRAPHITE-BIOTITE SCHIST,4941',
  '9999989997994270,ARCHAEAN , SILLIMANITE-KYANITE-QUARTZ SCHIST,4942',
  '9999989997997001,ARCHAEAN , AMPHIBOLITE,4945',
  '9999989997986293,ARCHAEAN , TALC TREMOLITE SCHIST,4949',
  '9999989997989197,ARCHAEAN , MICA SCHIST / SCHIST,4952',
  '9999989997996095,ARCHAEAN , FUCHSITE QUARTZITE,4959',
  '9999989997999001,ARCHAEAN , AMPHIBOLITE,4962',
  '9999989995960294,ARCHAEAN , TALC TREMOLITE SCHIST,4967',
  '9999989995961293,ARCHAEAN , TALC TREMOLITE ACTINOLITE SCHIST,4968',
  '9999989995972102,ARCHAEAN , GAR-BIO-SILL GNEISS + GRAPHITE + KYANITE,4979',
  '9999989995982094,ARCHAEAN , FUCHSITE-KYANITE QUARTZITE,4989',
  '9999989995988032,ARCHAEAN , BANDED MAGNETITE QUARTZITE,4995',
  '9894899963989143,ARCHAEAN-PROTEROZOIC , HORNBLENDE-BIOTITE GNEISS,4117',
  '9894899963994024,ARCHAEAN-PROTEROZOIC , BIOTITE GNEISS,4122',
  '9894909965993053,ARCHAEAN-PROTEROZOIC , ACID TO INTERMEDIATE CHARNOCKITE,4138',
  '9894909965998241,ARCHAEAN-PROTEROZOIC , PYROXENE GRANULITE,4143',
  '9284669887993218,NEOPROTEROZOIC , PINK GRANITE,2282',
  '9284669887994257,NEOPROTEROZOIC , QUARTZ VEIN/REEF,2283',
  '9284669887995211,NEOPROTEROZOIC , PEGMATITE,2284',
  '9284669887997096,NEOPROTEROZOIC , GRANITE,2286',
  '9284669889997068,NEOPROTEROZOIC , DIORITE,2289',
  '9284669889998098,NEOPROTEROZOIC , GABBRO,2290',
  '9284669889999009,NEOPROTEROZOIC , ANORTHOSITE GABBRO,2291',
  '9284669887998218,NEOPROTEROZOIC , PINK GRANITE,2292'
];

// Create a dictionary mapping lithology categories to colors
var lithologyCategoryColorDict = ee.Dictionary.fromLists(lithologyCategoryList, lithologyColorPalette);

// Function to set the style based on the STRATIGRAP field
var styleFunction = function(feature) {
  var category = ee.String(feature.get('STRATIGRAP')).trim(); // Get and trim category
  var color = lithologyCategoryColorDict.get(category, '#ffffff'); // Lookup color in dictionary, default to white if not found
  return feature.set('style', {color: color, width: 1}); // Apply style to feature
};

// Apply the style function to the feature collection
var styledLithology = lithology.map(styleFunction);

// Add the styled layer to the map
Map.addLayer(styledLithology.style({styleProperty: 'style'}).clip(wayanad), {}, 'Lithology', false);

// Function to set the style and add category information for ML
var lithologyWithCategories = lithology.map(function(feature) {
  var category = ee.String(feature.get('STRATIGRAP')).trim();
  var color = lithologyCategoryColorDict.get(category, '#ffffff');  // Default to white if not found
  return feature.set('color', color).set('category', category);  // Add category and color
});

// This variable can now be used directly for ML models
var styledLithologyML = lithologyWithCategories.map(function(feature) {
  return feature.set('style', {color: feature.get('color'), width: 1});
});

// Add the styled layer to the map for visualization
//Map.addLayer(styledLithologyML.style({styleProperty: 'style'}).clip(wayanad), {}, 'Styled Lithology', false);








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

var localRelief = localRelief.reproject('EPSG:4326', null, 30).rename('relief_class')
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



//Correlation Matrix
// Step 1: Sample data from combined layers
var samples = combinedLSMFactors.sample({
  region: wayanad, // Specify your region of interest
  scale: 30,       // Match dataset resolution
  numPixels: 5000, // Adjust for performance
  geometries: false // Exclude geometry for efficiency
});
print('Sample Data Example:', samples.first());

// Step 2: Get band names
var bandNames = combinedLSMFactors.bandNames();
print('Band Names:', bandNames);

// Step 3: Calculate pairwise Pearson correlations
var pairwiseCorr = ee.FeatureCollection(bandNames.map(function(i) {
  return bandNames.map(function(j) {
    // Calculate Pearson correlation for each pair
    var stats = samples.reduceColumns({
      reducer: ee.Reducer.pearsonsCorrelation(),
      selectors: [i, j]
    });
    // Create a feature with the band pair and correlation value
    var bandPair = ee.String(i).cat('/').cat(j);
    return ee.Feature(null, {
      'band_pair': bandPair,
      'correlation': stats.get('correlation')
    });
  });
}).flatten());

// Step 4: Print and inspect the pairwise correlation results
print('Pairwise Correlation Matrix:', pairwiseCorr);

// Export the table as a CSV file
Export.table.toDrive({
  collection: pairwiseCorr,
  description: 'Pairwise_Correlation_NoSurfSoil_Fin3_'+endYear,
  folder: 'Wayanad_Exports',
  fileNamePrefix: 'pairwise_correlation_Normal_NoSurfSoil_Fin3_'+endYear,
  fileFormat: 'CSV',
});


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

var susceptibility_slices_export = ee.Image(0).where(rfclass.lt(0.25), 1)    // Very Low - Dark Green
  .where(rfclass.gte(0.25).and(rfclass.lt(0.4)), 2)   // Low - Olive Green
  .where(rfclass.gte(0.4).and(rfclass.lt(0.5)), 3)    // Moderate - Yellow
  .where(rfclass.gte(0.5).and(rfclass.lte(1)), 4);

// Export the classified image to Google Drive
Export.image.toDrive({
  image: susceptibility_slices_export,
  description: 'LSM_Fin3_Susceptibility_Slices_Export_NoSurfSoil'+endYear,
  folder: 'Wayanad_Exports', // Change to your desired folder name
  fileNamePrefix: 'LSM_Fin3_Susceptibility_slices_NoSurfSoil'+endYear,
  region: geometry, // Adjust as per your region of interest
  scale: 30 // Adjust scale to match your dataset (e.g., 30m for Landsat)
});



// Ensure the classified LSM has integer values
var classifiedLSMInteger = susceptibility_slices.toInt();

// Step 1: Apply Majority Filter (Smoothed LSM)
var smoothedClassifiedLSM = classifiedLSMInteger.reduceNeighborhood({
  reducer: ee.Reducer.mode(),
  kernel: ee.Kernel.square(3)  // 3x3 kernel size for smoothing
});

// Step 2: Perform Morphological Operations (Erosion and Dilation)
var dilatedLSM = smoothedClassifiedLSM.focal_max({radius: 1, kernelType: 'square'});
var erodedLSM = dilatedLSM.focal_min({radius: 1, kernelType: 'square'});

// Step 3: Vectorize the Processed LSM
var LSMRegions = erodedLSM.reduceToVectors({
  reducer: ee.Reducer.countEvery(),
  geometryType: 'polygon',
  scale: 30,  // Increased scale to reduce computation
  maxPixels: 1e8,  // Increased maxPixels
  geometry: wayanad
});

// Step 4: Simplify Vectorized Regions
var simplifiedRegions = LSMRegions.map(function (feature) {
  return feature.simplify(30); // Higher tolerance for simplification
});

// Step 5: Filter out Small Regions
var filteredRegions = simplifiedRegions.filter(ee.Filter.gt('count', 50)); // Lower threshold for small regions

// Step 6: Rasterize Filtered Regions
var rasterizedRegions = filteredRegions.reduceToImage({
  properties: ['label'],
  reducer: ee.Reducer.first()
});

// Step 7: Add Smooth Rasterized Regions to the Map
Map.addLayer(rasterizedRegions.clip(wayanad), 
  {min: 1, max: 4, palette: ['green', 'lightgreen', 'yellow', 'red']}, 
  'LSM Smooth Region-Based');

// Step 8: Export the Final Smoothed LSM
Export.image.toDrive({
  image: rasterizedRegions.clip(wayanad),
  description: 'LSM_Fin3_Smooth_Region_Based_NoSurfSoil'+endYear,
  folder: 'Wayanad_Exports', // Change to your desired folder name
  fileNamePrefix: 'LSM_Fin3_Smooth_Region_Based_NoSurfSoil'+endYear,
  scale: 30,  // Adjusted for less computation
  region: wayanad.geometry(),
  maxPixels: 1e9
});



// Step 1: Get the pixel area (in square meters)
var pixelArea = ee.Image.pixelArea();

// Step 2: Calculate total area for each class (1, 2, 3, 4)
var classAreas = [1, 2, 3, 4].map(function(classValue) {
  // Mask the rasterizedRegions image for the current class
  var classMask = rasterizedRegions.eq(classValue);
  
  // Multiply the mask by the pixel area
  var classArea = classMask.multiply(pixelArea)
    .reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: wayanad, // Region of interest
      scale: 30, // Scale matching the dataset resolution
      maxPixels: 1e9 // Avoid computation limits
    });
  
  // Extract the total area in square meters and convert to km²
  var areaHA = ee.Number(classArea.get('first')).divide(10000); // Convert m² to Hectares
  return {class: classValue, area_HA: areaHA};
});

// Step 3: Convert results to a FeatureCollection for easy display/export
var classAreaFeatures = ee.FeatureCollection(classAreas.map(function(item) {
  return ee.Feature(null, item); // Create a Feature for each class
}));

// Step 4: Print results to the console
print('Total Area by Class (Ha):', classAreaFeatures);



// Add Exploratory Data Analysis: Histograms
// Generate histograms for landslide susceptibility scores over the ROI and training samples
var histogramOptions = {
  min: 0,
  max: 1,
  region: wayanad,
  scale: 30,
  maxPixels: 1e13
};

// Generate histogram for susceptibility scores
var susceptibilityHistogram = ui.Chart.image.histogram({
  image: rfclass,
  region: wayanad,
  scale: 30,
  maxPixels: 1e13
}).setOptions({
  title: 'Susceptibility Histogram over ROI',
  hAxis: {title: 'Susceptibility'},
  vAxis: {title: 'Frequency'},
  colors: ['blue']
});
print(susceptibilityHistogram);

// Generate histogram for landslide scar probabilities
var scarHistogram = ui.Chart.image.histogram({
  image: rfclass,
  region: trainingPoints.geometry(),
  scale: 30,
  maxPixels: 1e13 
}).setOptions({
  title: 'Landslide Scar Susceptibility Histogram',
  hAxis: {title: 'Susceptibility'},
  vAxis: {title: 'Frequency'},
  colors: ['red']
});
print(scarHistogram);

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

/*
// Convert probabilistic output into a class prediction
// For binary classification, set a threshold of 0.5
var rfclassPred = rfclass.gt(0.5).rename('classification');  // For binary

// Sample the prediction and ground truth (from validation set)
var validationPred = combinedLSMFactors.sampleRegions({
  collection: acurracy_evaluation,
  properties: ['landslide']
  //,scale: 10,
  //tileScale: 16
}).map(function(feature) {
  var predictedClass = rfclassPred.sample({region: feature.geometry(), scale: 10}).first();
  return feature.set('predicted', predictedClass.get('classification'));
});

// Now you can create a confusion matrix comparing the predicted and actual values
var testConfusionMatrix = validationPred.errorMatrix('landslide', 'predicted');

// Print confusion matrix and accuracy
print('Confusion Matrix', testConfusionMatrix);
print('Test Accuracy', testConfusionMatrix.accuracy());
*/

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





var treeMapping = {
  2020: 50,  //0.7
  2021: 30,  //0.7
  2022: 34,   //0.5
  2023: 495,  //0.7
  2024: 56    //0.7
};

// Add a bagFraction mapping
var bagFractionMapping = {
  2020: 0.6,
  2021: 0.6,
  2022: 0.5,
  2023: 0.5,
  2024: 0.7
};

// Get the number of trees and bag fraction from the mappings, or use defaults
var nmbTrees = treeMapping[endYear] || 100; // Default number of trees
var bgFraction = bagFractionMapping[endYear] || 0.6; // Default bag fraction

// Print the chosen parameters for verification
print('Number of Trees:', nmbTrees);
print('Bag Fraction:', bgFraction);

// Random Forest Classifier without Probabilistic Output Mode
var rfConfusion = ee.Classifier.smileRandomForest({
  numberOfTrees: nmbTrees,
  bagFraction: bgFraction
}).train(training, 'landslide', bandNames);

// Classify the accuracy evaluation dataset
var validation = acurracy_evaluation.classify(rfConfusion);

// Create a confusion matrix
var confusionMatrix = validation.errorMatrix('landslide', 'classification');

// Print the confusion matrix
print('Confusion Matrix using separate RF without Probabilistic Output Mode', confusionMatrix);

// Extract metrics
var accuracy = confusionMatrix.accuracy();
// Print metrics
print('Accuracy using separate RF without Probabilistic Output Mode:', accuracy);

// Extract confusion matrix elements
var matrix = confusionMatrix.array();
var TP = ee.Number(matrix.get([0, 0])); // True Positives
var TN = ee.Number(matrix.get([1, 1])); // True Negatives
var FP = ee.Number(matrix.get([0, 1])); // False Positives
var FN = ee.Number(matrix.get([1, 0])); // False Negatives

// Calculate additional metrics
var accurcy = (TP.add(TN)).divide(TP.add(TN).add(FP).add(FN))
var recall = TP.divide(TP.add(FN)); // Sensitivity/Recall
var precision = TP.divide(TP.add(FP)); // Precision
var specificity = TN.divide(TN.add(FP)); // Specificity
var negativePredictiveValue = TN.divide(TN.add(FN)); // Negative Predictive Value
var f1Score = precision.multiply(recall).multiply(2).divide(precision.add(recall)); // F1 Score

// Print additional metrics
print('Accuracy (formula used):', accurcy);
print('Recall (Sensitivity):', recall);
print('Precision:', precision);
print('Specificity:', specificity);
print('Negative Predictive Value (NPV):', negativePredictiveValue);
print('F1 Score:', f1Score);

// Extract the array representation of the confusion matrix
var array = confusionMatrix.array();
var rowsCount = array.length().get([0]); // Extract the row count

// Convert confusion matrix to a FeatureCollection for export
var rows = ee.List.sequence(0, rowsCount.subtract(1)).map(function(i) {
  var row = array.slice(0, i, ee.Number(i).add(1)).project([1]);
  return ee.Feature(null, {
    'row_index': i,
    'values': row.toList()
  });
});

// Convert to FeatureCollection
var confusionFeatureCollection = ee.FeatureCollection(rows);

// Export to Google Drive as CSV
Export.table.toDrive({
  collection: confusionFeatureCollection,
  description: 'ConfusionMatrix_Export_NoSurfSoil_RF_Fin3_' + endYear,
  folder: 'Wayanad_Exports',
  fileNamePrefix: 'ConfusionMatrix_Normal_NoSurfSoil_RF_Fin3_' + endYear,
  fileFormat: 'CSV'
});









// Add this snippet at the end of your GEE code
// ADD THE FOLLOWING LINE:
var combinedLSMFactors_unmasked_SHAP = combinedLSMFactors.unmask(0);
var trainingDataHistorical_SHAP = combinedLSMFactors_unmasked_SHAP.reduceRegions({
  collection: trainingPoints,
  reducer: ee.Reducer.mean(),
  scale: 30
});

var trainingDataClean_SHAP = trainingDataHistorical_SHAP.randomColumn('random');
var trainingDataNoNulls_SHAP = trainingDataClean_SHAP.filter(ee.Filter.notNull(['landslide']));

// This is the variable holding all your features and the 'landslide' label
// It's ready for export.
print('Preview of data to be exported:', trainingDataNoNulls_SHAP.limit(5));

// Export the FeatureCollection to a CSV file in your Google Drive.
Export.table.toDrive({
  collection: trainingDataNoNulls_SHAP,
  description: 'LSM_Training_Data_for_SHAP_'+endYear,
  folder: 'Wayanad_Exports', // Optional: specify a folder
  fileNamePrefix: 'lsm_training_data_SHAP_'+endYear,
  fileFormat: 'CSV'
});

// IMPORTANT: Before running the export, print your band names.
// You will need this exact list in your Python script.
var bandNames = combinedLSMFactors_unmasked_SHAP.bandNames();
print('COPY THESE BAND NAMES FOR PYTHON:', bandNames);