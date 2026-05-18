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

var startDate = '2020-04-01';
var endDate = '2020-05-01';

// Soil Moisture Data (SMAP)
var smapDataset = ee.ImageCollection("NASA/SMAP/SPL4SMGP/007")
                    .filterDate(startDate, endDate)
                    .filterBounds(wayanad)
                    .select([ "sm_rootzone"]);

// Define the grid resolution
var scale = 5000; // 5km resolution

// Resample and reproject
smapDataset = smapDataset.map(function(image) {
  return image.resample('bilinear').reproject({
    crs: image.projection(),
    scale: scale
  }).clip(wayanad);
});

// Force the transform info to the client as a string
var transformWkt = ee.Image(smapDataset.first()).projection().transform().getInfo();

print('Full transform WKT:', transformWkt);

// Helper function to extract numeric values from WKT
function parseParam(wktString, paramName) {
  var regex = new RegExp('PARAMETER\\[\\"' + paramName + '\\",\\s*([^\\]]+)\\]');
  var match = wktString.match(regex);
  return match ? parseFloat(match[1]) : null;
}

// For example, to get the “elt_0_0” parameter (often the X‐scale):
var elt_0_0 = parseParam(transformWkt, 'elt_0_0');
// Get the scale in degrees from the image's CRS transform
var scaleDegrees = elt_0_0;
print('Scale in Degrees:', scaleDegrees);

// Get the scale in degrees for precise bounding box calculation
var halfCell = scaleDegrees / 2; // Half-cell size in degrees

// Get the first image to create a consistent grid
var firstImage = ee.Image(smapDataset.first());

// Create a sample grid for Wayanad
var samplePoints = firstImage.sample({
  region: wayanad,
  scale: scale,
  projection: firstImage.projection(),
  geometries: true
});
print('Number of Sample Points:', samplePoints.size());

  
// Add daily dates to each image
smapDataset = smapDataset.map(function(image) {
    var dailyDate = image.date().format('YYYY-MM-dd');
    return image.set('daily_date', dailyDate);
});

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


// Function to add bounding box information
var addBoundingBox = function(feature) {
  var coordinates = ee.Geometry(feature.geometry()).coordinates();
  var lon = ee.Number(coordinates.get(0));
  var lat = ee.Number(coordinates.get(1));
  
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

// Function to process each day's data
var processDailyData = function(dailyDate) {
  // Get the image for this day
  var dailyImage = dailySmap.filter(ee.Filter.eq('daily_date', dailyDate)).first();
  
  // Extract values at each grid point
  var pointData = dailyImage.reduceRegions({
    collection: gridPoints,
    reducer: ee.Reducer.first(),
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
      'Surface_Soil_Moisture': feature.get('sm_surface'),
      'Rootzone_Soil_Moisture': feature.get('sm_rootzone')
    });
  });
};

// Process all days and combine results
var allProcessedData = ee.FeatureCollection(
  dailyDates.map(processDailyData)
).flatten();

print("Processed Points (first 10):", allProcessedData.limit(10));

// Export the processed data as a CSV
Export.table.toDrive({
  collection: allProcessedData,
  description: 'SoilMoisture_GriddedData_' + startDate.replace(/-/g, '') + '_to_' + endDate.replace(/-/g, ''),
  folder: 'Wayanad_Exports',
  fileFormat: 'CSV'
});

// Create grid cells for visualization
var gridCells = gridPoints.map(function(feature) {
  var lon = ee.Number(feature.get('Longitude'));
  var lat = ee.Number(feature.get('Latitude'));
  
  var cell = ee.Geometry.Rectangle([
    lon.subtract(halfCell),
    lat.subtract(halfCell),
    lon.add(halfCell),
    lat.add(halfCell)
  ]);
  
  return ee.Feature(cell);
});

Map.addLayer(gridCells, {color: 'red'}, 'Grid Cells');
