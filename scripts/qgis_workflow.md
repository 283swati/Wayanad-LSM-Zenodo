# QGIS Processing Protocol

This document outlines the manual QGIS workflows used for data processing and preparation before and after executing automated scripts.

## Preprocessing Protocol

Before feeding data into Google Earth Engine, the following spatial preprocessing steps were performed manually in QGIS:

### 1. Area of Interest (AOI) Delineation
* **Source:** Survey of India shapefiles.
* **Process:** The national/state district shapefiles were loaded into QGIS. The specific boundary for the Wayanad district was identified and extracted using the `Clip` / `Export Selected Features` tool to create the foundational AOI bounding box for all subsequent analysis.

### 2. DEM Mosaicking and Preparation
* **Source:** Bhuvan CartoDEM Version-3 R1.
* **Process:** 
    1. Identified and downloaded the specific DEM tiles intersecting the Wayanad bounding box.
    2. Imported the raw tiles into QGIS.
    3. Merged the tiles using the `Raster > Miscellaneous > Merge` tool to create a continuous elevation surface.
    4. Exported the unified Wayanad DEM as a GeoTIFF for ingestion into Google Earth Engine.
