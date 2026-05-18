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
// Define the desired resolution
// Define the grid resolution (e.g., 100m x 100m)
var scale = 5000;  // Desired resolution in meters

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
var meanRainfall = reprojected.reduce(ee.Reducer.mean());
print(meanRainfall)


// Load the image collection with multiple bands (e.g., day1 as b1, day2 as b2, etc.)
//var meanRainfall = ee.Image('users/your_username/your_image_asset'); // Replace with your asset ID

// Define the grid resolution (e.g., 100m x 100m)

// Sample the image collection at a regular grid
var samplePoints = meanRainfall.sample({
  region: wayanad, // Use the bounding box of the image
  scale: scale, // Match the grid resolution to the image
  projection: meanRainfall.projection(),
  geometries: true // Include point geometries (centroid lat/lon)
});
print('Number of Sample Points:', samplePoints.size());

// Force the transform info to the client as a string
var transformWkt = meanRainfall
  .select('mean')
  .projection()
  .transform()
  .getInfo();

print('Full transform WKT:', transformWkt);

// A small helper function to extract numeric parameter values from the WKT:
function parseParam(wktString, paramName) {
  // Looks for e.g. PARAMETER["elt_0_0", 0.0008983...]
  var regex = new RegExp('PARAMETER\\[\\"' + paramName + '\\",\\s*([^\\]]+)\\]');
  var match = wktString.match(regex);
  return match ? parseFloat(match[1]) : null;
}

// For example, to get the “elt_0_0” parameter (often the X‐scale):
var elt_0_0 = parseParam(transformWkt, 'elt_0_0');
// Get the scale in degrees from the image's CRS transform
var scaleDegrees = elt_0_0;
print('Scale in Degrees:', scaleDegrees);

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

// Add bounding box and centroid columns to the dataset
var processedPoints = samplePoints.map(addBoundingBox);

// Export the processed data as a CSV
Export.table.toDrive({
  collection: processedPoints,
  description: 'YearlyMean'+endYear+'ProcessedMeanRainfallGriddedData'+scale+'m',
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
