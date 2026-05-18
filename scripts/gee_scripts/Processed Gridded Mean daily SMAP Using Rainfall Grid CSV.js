// Load your uploaded Wayanad shapefile asset
var wayanad = ee.FeatureCollection('projects/ee-ce23resch11016/assets/ISRO_Wayanad_District_BDY');
var geometry = wayanad.geometry();

// Add layers to the map
Map.centerObject(wayanad, 10);
Map.addLayer(wayanad, {color: 'grey', fillColor: '00000000'}, 'Wayanad Transparent Boundary');

var wayanadBorder = ee.Image().byte().paint({featureCollection: wayanad, color: 1, width: 3});
Map.addLayer(wayanadBorder, null, 'Wayanad Border');

// Define shared parameters
var scale = 5000;  // 5km resolution
// Parameter Setup
// *****************
var endYear = 2020;  // Change this for different years if needed
var month = 3;    // Change this number (1-12) to sample a different month

// Create startDate and endDate automatically
var startDate = ee.Date.fromYMD(endYear, month, 1);
var endDate = startDate.advance(1, 'month');

// Create month name array for description
var monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];
var monthName = monthNames[month - 1];  // Array index is zero-based

// Use these values to build a description for the export
var description = 'SoilMoisture_Using_Rainfall_Grid_' + monthName + '_' + endYear + '_' + month;


// Step 1: Load the rainfall asset to create/reuse its grid
var rainfallAsset = ee.Image("projects/ee-ce23resch11016/assets/Raw_IMD_Data/combined_rainfall_"+endYear);
rainfallAsset = rainfallAsset.clip(wayanad);

// Reproject and resample to desired resolution
rainfallAsset = rainfallAsset
  .resample('bilinear')
  .reproject({
    crs: rainfallAsset.projection(),
    scale: scale
  });

// Get transform information for correct grid cell size
var transformWkt = rainfallAsset.projection().transform().getInfo();

// Helper function to extract numeric values from WKT
function parseParam(wktString, paramName) {
  var regex = new RegExp('PARAMETER\\[\\"' + paramName + '\\",\\s*([^\\]]+)\\]');
  var match = wktString.match(regex);
  return match ? parseFloat(match[1]) : null;
}

// Get the scale in degrees for grid cell calculation
var elt_0_0 = parseParam(transformWkt, 'elt_0_0');
var scaleDegrees = elt_0_0;
print('Scale in Degrees:', scaleDegrees);

// Step 2: Create the consistent grid using rainfall asset
var samplePoints = rainfallAsset.sample({
  region: wayanad,
  scale: scale,
  projection: rainfallAsset.projection(),
  geometries: true
});
print('Number of Grid Points from Rainfall Data:', samplePoints.size());

// Function to compute bounding box for each grid point
var addBoundingBox = function(feature) {
  var coordinates = ee.Geometry(feature.geometry()).coordinates();
  var lon = ee.Number(coordinates.get(0));
  var lat = ee.Number(coordinates.get(1));
  
  // Half-cell size in degrees for bounding box calculation
  var halfCell = scaleDegrees / 2;
  
  // Compute bounding box values
  var lowerLat = lat.subtract(halfCell);
  var upperLat = lat.add(halfCell);
  var leftLon = lon.subtract(halfCell);
  var rightLon = lon.add(halfCell);
  
  // Add centroid and bounding box columns
  return feature.set({
    'Latitude': lat,
    'Longitude': lon,
    'Lower_Lat': lowerLat,
    'Upper_Lat': upperLat,
    'Left_Lon': leftLon,
    'Right_Lon': rightLon
  });
};

// Add bounding box info to grid points
var gridPoints = samplePoints.map(addBoundingBox);

// Step 3: Create grid cells for visualization
var gridCells = gridPoints.map(function(feature) {
  var lon = ee.Number(feature.get('Longitude'));
  var lat = ee.Number(feature.get('Latitude'));
  var halfCell = scaleDegrees / 2;
  
  var cell = ee.Geometry.Rectangle([
    lon.subtract(halfCell),
    lat.subtract(halfCell),
    lon.add(halfCell),
    lat.add(halfCell)
  ]);
  
  return ee.Feature(cell);
});

Map.addLayer(gridCells, {color: 'red'}, 'Consistent Grid Cells');

// Step 4: Load and process SMAP data using the existing grid
// Soil Moisture Data (SMAP)
var smapDataset = ee.ImageCollection("NASA/SMAP/SPL4SMGP/007")
  .filterDate(startDate, endDate)
  .filterBounds(wayanad)
  .select(["sm_rootzone"]);

// Resample and reproject SMAP data
smapDataset = smapDataset.map(function(image) {
  return image.resample('bilinear').reproject({
    crs: image.projection(),
    scale: scale
  }).clip(wayanad);
});

// Add daily dates to each image
smapDataset = smapDataset.map(function(image) {
  var dailyDate = image.date().format('YYYY-MM-dd');
  return image.set('daily_date', dailyDate);
});
print('SMAP Dataset:', smapDataset);
print('SMAP Projection:', smapDataset.first().projection());
print('Rainfall Grid Projection:', rainfallAsset.projection());

// Create a list of unique daily dates
var dailyDates = smapDataset.aggregate_array('daily_date').distinct();
print('Unique Daily Dates:', dailyDates);

// Group and compute daily mean soil moisture
var dailySmap = ee.ImageCollection(dailyDates.map(function(dailyDate) {
  var imagesForDay = smapDataset.filter(ee.Filter.eq('daily_date', dailyDate));
  var dailyMean = imagesForDay.mean().set('daily_date', dailyDate);
  return dailyMean.set('system:time_start', ee.Date(dailyDate).millis());
}));

print('Daily Mean Soil Moisture Collection:', dailySmap);

// Step 5: Extract soil moisture values at each grid point for each day
var processDailyData = function(dailyDate) {
  // Get the image for this day
  var dailyImage = dailySmap.filter(ee.Filter.eq('daily_date', dailyDate)).first();
  
  // Extract values at each grid point using the rainfall-derived grid
  var reducer = ee.Reducer.first().setOutputs(['sm_rootzone']);
  var pointData = dailyImage.reduceRegions({
    collection: gridPoints,
    reducer: reducer,
    scale: scale
  });

  
  // Format the data with proper properties
  return pointData.map(function(feature) {
    return ee.Feature(feature.geometry(), {
      'Date': dailyDate,
      'Latitude': feature.get('Latitude'),
      'Longitude': feature.get('Longitude'),
      'Lower_Lat': feature.get('Lower_Lat'),
      'Upper_Lat': feature.get('Upper_Lat'),
      'Left_Lon': feature.get('Left_Lon'),
      'Right_Lon': feature.get('Right_Lon'),
      'Rootzone_Soil_Moisture': feature.get('sm_rootzone')
    });
  });
};

// Process all days and combine results
var allProcessedData = ee.FeatureCollection(
  dailyDates.map(processDailyData)
).flatten();

print("Processed SMAP Data using Rainfall Grid (first 10):", allProcessedData.limit(10));

// Export the processed data as a CSV
Export.table.toDrive({
  collection: allProcessedData,
  description: 'SoilMoisture_Using_Rainfall_Grid_' + monthName + '_' + endYear + '_' + month,
  folder: 'Wayanad_Exports',
  fileFormat: 'CSV'
});

// Add one day of SMAP data to the map for visualization
Map.addLayer(dailySmap.first().clip(wayanad), 
             {min: 0, max: 0.4, palette: ['#d73027', '#fc8d59', '#fee090', '#e0f3f8', '#91bfdb', '#4575b4']}, 
             'Soil Moisture (First Day)');
