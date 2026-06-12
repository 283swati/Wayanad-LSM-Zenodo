# Dual-Phase Framework for LSM
 A Dual-Phase Framework for Static and Dynamic Spatiotemporal Prediction of Landslides using a Temporally Consistent Ensemble Model

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.20205386.svg)](https://doi.org/10.5281/zenodo.20205386)

## Overview
This repository contains the code, processing protocols, and datasets necessary to reproduce the Landslide Susceptibility Mapping (LSM) results presented in the manuscript: *"A Dual-Phase Framework for Static and Dynamic Spatiotemporal Prediction of Landslides using a Temporally Consistent Ensemble Model"*. 

The workflow integrates multi-temporal remote sensing data processing via Google Earth Engine (GEE), QGIS, and Python, followed by predictive modeling using BiLSTM (for temporal dynamic factors) and Random Forest (for spatial susceptibility classification).

## Repository Structure

```text
├── data/
│   ├── raw_data_links.md                # Links and references for public raw data sources   
│   └── processed_data/                  # Formatted datasets required to run the GEE scripts
│       └── processed_dataset_description.md # Metadata and details for the processed assets
├── scripts/
│   ├── gee_scripts/                     # JavaScript files for Google Earth Engine
│   │   ├── LSM Fin3 1RF News(NoSurfSoil) Points Used till 2024.js          # Original LSM script used
│   │   └── LSM Fin3 1RF News(NoSurfSoil) Points Used till 2024 Shrinked.js # Simplified LSM script for reviewers
│   ├── python_notebooks/                # Jupyter/Colab notebooks for BiLSTM temporal prediction
│   └── qgis_workflow.md                 # Step-by-step processing protocol for manual QGIS tasks
├── README.md                            # Project documentation
└── requirements.txt                     # Python dependencies for the local/Colab ML environments

```

## Data Availability

The raw spatial and temporal datasets analyzed during the current study are publicly available from their respective host agencies (detailed in `data/raw_data_links.md`).

The intermediate processed feature datasets, model configurations, and the final variables generated to execute the landslide susceptibility mapping are permanently archived in the Zenodo repository linked via the DOI badge above.

## Prerequisites & Environment

To execute the workflows in this repository, the following platforms and libraries are required:

* **Google Earth Engine:** An active GEE account is required to run the JavaScript files.
* **GIS Software:** QGIS.
* **Python Environment:** Python 3.x with libraries specified in `requirements.txt`. Code is optimized for execution within Google Colab.

---

## Workflow Instructions

### 1. Preprocessing (Python, QGIS, & GEE)

**Rainfall Preprocessing (Python):**

* IMD Pune Gridded NetCDF data (0.25° x 0.25°) for the entire year was converted into individual daily GeoTIFF files using a custom Python script.
* A secondary Python script was used to merge these daily TIFFs into a single multi-band GeoTIFF.
* This file was uploaded to GEE, reprojected and resampled to a 100m resolution, clipped to the Wayanad boundary, and processed to calculate the daily mean rainfall for the year.

**Soil Moisture Aggregation (GEE):**

* NASA SMAP data (providing 3/4-hourly measurements) was temporally aggregated within GEE.
* Due to the large computational scale of the Wayanad district, data was first processed individually by month, and those monthly composites were subsequently averaged to synthesize the yearly continuous 24-hour daily soil moisture profile.

**GIS Preprocessing (Manual QGIS Steps):**

* See `scripts/qgis_workflow.md` for the complete manual protocol regarding Area of Interest (AOI) delineation and DEM mosaicking.

### 2. Temporal Prediction (BiLSTM)

The temporal prediction of dynamic factors (Rainfall and Soil Moisture) was executed locally/via Google Colab using Python.

1. The Wayanad study area was tessellated into 5km x 5km grids.
2. The mean values for rainfall and soil moisture were extracted for each grid cell over a 10-year historical period.
3. These sequential grid grids were fed into a BiLSTM network to predict the localized rainfall and soil moisture values for the subsequent target year.
4. Execute the notebooks located in `scripts/python_notebooks/` after running `pip install -r requirements.txt`.

### 3. Spatial Prediction & LSM (Random Forest in GEE)

The final Landslide Susceptibility Mapping and Random Forest classification were executed entirely within Google Earth Engine to leverage its ability to handle large-scale environmental factors.

**Instructions for Reviewers to Recreate Results:**
To facilitate the peer-review process, a streamlined, simplified version of the main classification code has been provided: `LSM Fin3 1RF News(NoSurfSoil) Points Used till 2024 Shrinked` (located in `scripts/gee_scripts/`).

To run this script and recreate the LSM outputs:

1. **Download Data:** Retrieve the processed input datasets located in the `data/processed_data/` folder of this repository. (Reference `processed_dataset_description.md` for details).
2. **Upload to GEE:** Upload these specific datasets as Assets to your personal Google Earth Engine account.
3. **Update Script Paths:** Open the `LSM Fin3 1RF News(NoSurfSoil) Points Used till 2024 Shrinked` script in the GEE Code Editor. Manually update the asset paths (`ee.Image()` and `ee.FeatureCollection()` calls at the top of the script) to point to the newly uploaded assets in your account.
4. **Execute:** Run the script. The code will automatically process the training/testing splits based on the temporal landslide inventory (training on historical points, testing on the current year).
5. **Outputs:** The GEE console will generate the reclassified susceptibility map, the Feature Importance chart, and extended Accuracy Assessment metrics (including the ROC curve, AUC score, Precision, Recall, and F1-Score charts).
