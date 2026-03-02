# Dashboard Handoff & Automation Prompt for Codex

This document serves as a handoff context and a prompt that you can supply directly to Codex on your remote Linux environment to automate the extraction of PnR runs into the Dashboard.

## How the Dashboard Works
The Dashboard stores its state (The Runs) in `localStorage`. 
We recently built an "Import Session" button in the UI. This button expects a `.json` file containing an array of raw Run objects. 
To automate this, Codex just needs to generate a Python or Shell script that runs in your pnr directory, finds all the latest logs, parses them to extract the metrics, and dumps them into a single `runs_session.json` file. You can then download this JSON from the VM and click "Import Session" on the Web UI to ingest all runs automatically!

---

## 📋 Copy and Paste the following Prompt to Codex:

Hello Codex,

I have a React tracking dashboard (dashboard_handoff.tar.gz) that visualizes Physical Design PnR run data. I need you to write a Python automation script.

**ENVIRONMENT CONTEXT:**
- Base Directory: `/projects/se/droplets/samsung/sf2ppss0/caddo_hp/rel_02b/users/arygup01/implementation/20_Jan_2026_dev2b/cdo_hp_vec/cdns/pnr/`
- Inside this directory are multiple runs, formatted as generic directory strings (e.g., `pnr_tag15_76Dx_4p7ghz`, `pnr_tag17_76Dx_4p7ghz`).
- Inside each run directory, there is a `logs/` folder.
- The `logs/` folder contains output logs for different stages, which we map to three standard dashboard stages: `PRECTS`, `CTS`, and `POSTROUTE`.
- Example log files: 
  - `cdo_hp_vec_prects.log` -> Maps to `PRECTS`
  - `cdo_hp_vec_cts.log` -> Maps to `CTS`
  - `cdo_hp_vec_route.log` -> Ignore or map to `ROUTE`
  - `cdo_hp_vec_postroute.log` -> Maps to `POSTROUTE`
*(Note: Exclude `*logv` and report logs like `*.report_*.log`)*

**THE GOAL:**
Write a robust Python script that:
1. Iterates through all the run directories (`pnr_tag*`) in the base `pnr/` directory.
2. For each run, identifies the tag name (`run_tag`). If it contains a frequency like `4p7ghz`, safely extract the float `4.7` for `frequency_ghz`.
3. Finds the latest valid log file for `PRECTS`, `CTS`, and `POSTROUTE`.
4. Opens each log and extracts the Setup mode timing data table. (The tables are usually grouped from the bottom of the file).
5. Parses the ASCII table. The columns are Path Groups (like `all`, `reg2reg`, `dp_fadd32`). The rows contain `WNS (ns):` and `TNS (ns):` data. Extract these float values for each path group.
6. Packages all the data into the Target JSON format.
7. Saves a final array of runs to `dashboard_session_export.json`.

**TARGET JSON SCHEMA FOR THE FRONTEND:**
The Python script MUST output an array of Run objects that match this exact JSON interface:

```json
[
  {
    "id": "pnr_tag17_76Dx_4p7ghz", 
    "run_tag": "pnr_tag17_76Dx_4p7ghz",
    "frequency_ghz": 4.7, 
    "stages": {
      "PRECTS": {
        "stage": "PRECTS",
        "views": {
          "all": { "WNS": -0.05, "TNS": -2.4 },
          "reg2reg": { "WNS": -0.01, "TNS": -0.1 }
        }
      },
      "CTS": {
        "stage": "CTS",
        "views": { ... }
      },
      "POSTROUTE": {
        "stage": "POSTROUTE",
        "views": { ... }
      }
    }
  }
]
```

**TABLE PARSING GUIDELINES:**
- The log files can be massive. You should typically scan backwards from the bottom of the file to find the final "Setup mode" timing summary table block.
- Look for lines resembling `|     Setup mode     |   all   | reg2reg |` to identify columns.
- Look for lines resembling `|           WNS (ns):| -0.039  | -0.004  |` to identify WNS metrics beneath it. 
- Use Regex or split strings appropriately. If a stage log doesn't exist, omit that stage from the JSON tree for that run.
- Keep the python script standard library only (`os`, `json`, `re`, `glob`) as I don't have pandas or external libraries.

Please generate the `scrape_runs.py` script.
