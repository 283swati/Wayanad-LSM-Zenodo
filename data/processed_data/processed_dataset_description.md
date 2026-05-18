# Processed Dataset Description & GEE Ingestion Guide

This folder contains the intermediate, pre-processed datasets required to run the `LSM_Fin3_1RF_News_Shrinked.js` script in Google Earth Engine (GEE). These datasets have been formatted, clipped, and resampled specifically for the Wayanad district bounding box to reduce computational overhead during peer review.

## 1. Inventory of Provided Assets

### Vector Datasets (Shapefiles)
*Note: Upload these to GEE as Table Assets by zipping the `.shp`, `.shx`, `.dbf`, and `.prj` files together.*

| File Name | Description | Original GEE Path in Script |
| :--- | :--- | :--- |
| `ISRO_Wayanad_District_BDY.zip` | District boundary for AOI masking | `.../assets/ISRO_Wayanad_District_BDY` |
| `Geology_2M_Bhukosh.zip` | Geological formations | `.../assets/Bhukosh_Assets/Geology_2M_Bhukosh` |
| `Geomorphology_250K_Bhukosh.zip` | Geomorphological features | `.../assets/Bhukosh_Assets/Geomorphology_250K_Bhukosh` |
| `Lithology_Bhukosh.zip` | Lithological characteristics | `.../assets/Bhukosh_Assets/Lithology_Bhukosh` |
| `Landslide2018comb2019Gemini.zip` | Landslide inventory points (with 'Year' attribute) | `.../assets/Points2018comb2019/Landslide2018comb2019Gemini` |
| `Non-Landslide2018comb2019Gemini.zip` | Non-landslide reference points | `.../assets/Points2018comb2019/Non-Landslide2018comb2019Gemini` |

### Raster Datasets (GeoTIFFs)
*Note: Upload these to GEE as Image Assets.*

| File Name | Description | Original GEE Path in Script |
| :--- | :--- | :--- |
| `merged_cdnc43d_cdnc43e.tif` | Mosaicked CartoDEM for Wayanad | `.../assets/merged_cdnc43d_cdnc43e` |
| `Relief_Classes.tif` | Reclassified relief categorizations | `.../assets/Relief_Classes` |
| `Annual_SMAP_Mean_Year_2020.tif` to `2024.tif` | 4 distinct temporal assets of yearly averaged rootzone soil moisture | `.../assets/SMAP_AnnualMean/Annual_SMAP_Mean_Year_YYYY` |
| `2020mean_rainfall_100m.tif` to `2024.tif` | 4 distinct temporal assets of yearly averaged rainfall (reprojected to 100m) | `.../assets/IMD/YYYYmean_rainfall_100m` |

---

## 2. Instructions for Reviewers (How to Run the Code)

Because GEE cannot read local files from your computer, you must ingest these datasets into your own Earth Engine account to execute the Random Forest classification script.

**Step 1: Upload the Assets**
1. Navigate to the **Assets** tab in the Google Earth Engine Code Editor.
2. Click **New** -> **Image upload** (for `.tif` files) or **Shapefiles** (for `.zip` files).
3. Upload all the files listed in the inventory above. Allow a few minutes for GEE to ingest the files.

**Step 2: Update the Script Paths**
1. Open the provided `LSM_Fin3_1RF_News_Shrinked.js` script in the GEE Code Editor.
2. At the top of the script, you will see variables defining the asset paths, which currently point to our private repository (e.g., `projects/ee-ce23resch11016/...`).
3. Replace these paths with the new paths generated in your personal GEE Assets folder. (You can easily get your new path by clicking the asset in your GEE tab and selecting the 'copy' icon).

*Example Update:*
```javascript
// Change this:
var wayanad = ee.FeatureCollection('projects/ee-ce23resch11016/assets/ISRO_Wayanad_District_BDY');

// To this:
var wayanad = ee.FeatureCollection('users/YOUR_USERNAME/ISRO_Wayanad_District_BDY');