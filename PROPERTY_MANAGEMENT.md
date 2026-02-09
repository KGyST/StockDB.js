# Property Management Guide

## Overview
This guide helps you manage Google Apps Script properties using the `.env` file as the source of truth.

## Files Created
- `scripts/manage_properties.js` - Node.js script to manage GAS properties
- `src/property_manager.gs` - GAS functions for property operations

## Usage

### 1. Sync Properties from .env to GAS
```bash
node scripts/manage_properties.js sync
```
This will set all properties from your `.env` file in GAS Script Properties.

### 2. Purge Old Properties
```bash
node scripts/manage_properties.js purge
```
This removes old/unused properties (like FX cache entries).

### 3. List Current Properties
```bash
node scripts/manage_properties.js list
```
Shows all current properties in GAS (sensitive values are masked).

### 4. Complete Refresh
```bash
node scripts/manage_properties.js all
```
Runs purge then sync - recommended before deployment.

## Properties Managed from .env
- `ALPHA_VANTAGE_API_KEY`
- `EODHD_API_TOKEN`
- `FIREBASE_URL`
- `FIREBASE_AUTH`

## Properties to Purge
- Old FX cache entries (FX_USD_EUR_YYYY-12-31)
- Any other deprecated properties

## Before clasp push
1. Run `node scripts/manage_properties.js all`
2. Verify properties with `node scripts/manage_properties.js list`
3. Then run `clasp push`

## .claspignore Updates
Updated to exclude:
- `scripts/` - Local development scripts
- `test_data/` - Test data files
- `cache/` - Local cache
- `.env` - Environment variables
- Build files and IDE configs

Only essential files will be pushed to GAS:
- `dist/gas_bundle.gs` - Main application
- `src/property_manager.gs` - Property management functions
- `appsscript.json` - GAS project settings
