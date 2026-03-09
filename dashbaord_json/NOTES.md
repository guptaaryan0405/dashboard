# Dashboard JSON Pipeline Notes

## Location
All automation lives in:
`/projects/se/droplets/samsung/sf2ppss0/caddo_hp/rel_02b/dashbaord_json`

## Core Files
- `scrape_runs.py`: main scraper
- `partitions.env`: partition config (`<name>=<pnr_path>`)
- `run_scrape_loop.sh`: runs the scraper on a loop

## Partitions Config
`partitions.env` contains:
```
cdo_hp_vec=.../cdo_hp_vec/cdns/pnr
cdo_hp_l2misc=.../cdo_hp_l2misc/cdns/pnr
cdo_hp_main=.../cdo_hp_main/cdns/pnr
cdo_hp_fm=.../cdo_hp_fm/cdns/pnr
```

## Running the Scraper
Single pass (all partitions via config):
```
python3 /projects/se/droplets/samsung/sf2ppss0/caddo_hp/rel_02b/dashbaord_json/scrape_runs.py
```

Loop every hour:
```
/projects/se/droplets/samsung/sf2ppss0/caddo_hp/rel_02b/dashbaord_json/run_scrape_loop.sh --interval 3600
```


## Output JSON Files
Generated per partition in the same directory:
- `dashboard_session_export_cdo_hp_vec.json`
- `dashboard_session_export_cdo_hp_l2misc.json`
- `dashboard_session_export_cdo_hp_main.json`
- `dashboard_session_export_cdo_hp_fm.json`


## JSON Schema Additions
Each stage includes extra fields beyond baseline:
- `source_log`: absolute path of the log used
- `status`: `completed|crashed|errored|running|stuck`
- `last_updated`: ISO timestamp from log mtime
- `intermediate`: array of OptDebug/TnsOpt timing tables
- `runtime`: parsed snapshot table for stage
- `metrics.area_mm2`: from `reports/<partition>_<stage>/area.summary.rpt`
- `metrics.leakage_mw`: from `reports/<partition>_<stage>/power.all.rpt`

## Status Heuristic
- `completed`: snapshot table exists
- `crashed`: tail contains `pstack`
- `errored`: tail contains `--- Ending "Innovus"` but no snapshot
- `stuck`: no updates in >3 hours (uses latest `*.logv` mtime, falls back to `*.log`)
- `running`: otherwise

## Log Selection
For each stage, picks newest by mtime among:
`<partition>_<stage>.log` and `<partition>_<stage>.logN`

## Notes to Update
Whenever new fields are added or parsing changes, update this file.
