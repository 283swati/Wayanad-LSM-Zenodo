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
print('Year:', endYear)

// Load the TIFF asset (replace with your asset ID)
var asset = ee.Image("projects/ee-ce23resch11016/assets/Raw_IMD_Data/combined_rainfall_"+endYear); // Replace with your asset path
asset = asset.clip(wayanad)
print(asset)

// Get projection information
var projection = asset.projection();
print('Projection:', projection);

// Get the nominal scale (resolution) in meters
var scale = asset.projection().nominalScale();
print('Resolution (m):', scale);

// Define the desired resolution
// Define the grid resolution (e.g., 100m x 100m)
var scale = 5000;  // Desired resolution in meters

// Get the band names dynamically using ee.String to format them
var bandNames = asset.bandNames();

// Reproject and resample to higher resolution (100 meters)
var asset = asset.select(bandNames)
  .resample('bilinear')
  .reproject({
    crs: asset.projection(),
    scale: scale
  });
  

// Force the transform info to the client as a string
var transformWkt = asset.projection().transform().getInfo();

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

// Get the band names dynamically using ee.String to format them
var bandNames = asset.bandNames();

// Sample the image collection at a regular grid
var samplePoints = asset.sample({
  region: wayanad, // Use the bounding box of the image
  scale: scale, // Match the grid resolution to the image
  projection: asset.projection(),
  geometries: true // Include point geometries (centroid lat/lon)
});
print('Number of Sample Points:', samplePoints.size());


// Function to compute bounding box for each grid point
var addBoundingBox = function(feature) {
  var coordinates = ee.Geometry(feature.geometry()).coordinates(); // Centroid coordinates
  var lon = ee.Number(coordinates.get(0));
  var lat = ee.Number(coordinates.get(1));
  
  // Get the scale in degrees for precise bounding box calculation
  var halfCell = scaleDegrees / 2; // Half-cell size in degrees
  
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

// Function to get date from band index
function getDateFromBand(bandName) {
  var dayIndex = ee.Number.parse(ee.String(bandName).slice(1)); // Extract number from b1, b2, ...

  // Use Earth Engine date functions instead of manual calculations
  var startDate = ee.Date.fromYMD(endYear, 1, 1); // Start from Jan 1st
  var actualDate = startDate.advance(dayIndex.subtract(1), 'day'); // Move forward by (dayIndex - 1) days
  
  return actualDate.format('dd-MM-YYYY'); // Correctly formatted date
}

// Function to extract values for each band and add date information
function expandBands(feature) {
  var featureList = bandNames.map(function(bandName) {
    var value = feature.get(bandName);
    var dateStr = getDateFromBand(ee.String(bandName)); // Convert band to date
    
    return ee.Dictionary({'Date': dateStr, 'Rainfall': value});
  });

  // Remove original bands and create new feature collection
  return ee.FeatureCollection(
    featureList.map(function(f) {
      return feature.select([]).set(f);  // Removes all bands while keeping spatial attributes
    })
  );
}

// Apply function to expand each feature
var expandedCollection = samplePoints.map(expandBands).flatten();

// Add bounding box and centroid columns to the dataset
var processedPoints = expandedCollection.map(addBoundingBox);

print("ProcessedPoints & Expanded Collection first 10:", processedPoints.limit(10)); 

// var scaleValue = Math.round(scale.getInfo());

// Export the processed data as a CSV
Export.table.toDrive({
  collection: processedPoints,
  description: endYear+'ProcessedMeanRainfallGriddedData'+scale+'m',
  folder: 'Wayanad_Exports',
  fileFormat: 'CSV'
});







// Convert scaleDegrees to an ee.Number
var scaleDeg = ee.Number(scaleDegrees);

// Function to create a bounding box (grid cell) around a point
function makeGridCell(feature) {
  var coords = feature.geometry().coordinates(); // Extract geometry from feature
  var lon = ee.Number(coords.get(0));
  var lat = ee.Number(coords.get(1));

  // Create a rectangle for the grid cell
  var cell = ee.Geometry.Rectangle([
    lon.subtract(scaleDeg.divide(2)),  // Min longitude
    lat.subtract(scaleDeg.divide(2)),  // Min latitude
    lon.add(scaleDeg.divide(2)),       // Max longitude
    lat.add(scaleDeg.divide(2))        // Max latitude
  ]);

  return ee.Feature(cell); // Return as a Feature
}

// Apply the function to all sample points
var gridCells = samplePoints.map(makeGridCell);

// Convert to FeatureCollection
var gridLayer = ee.FeatureCollection(gridCells);

// Add to the map with styling
Map.addLayer(gridLayer, {color: 'red'}, 'Grid Cells');
