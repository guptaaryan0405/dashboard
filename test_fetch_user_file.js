fetch('/@fs/Users/arygup01/Library/CloudStorage/OneDrive-Arm/Documents/code/dashboard/dashboard_session_data/dashboard_session_export_cdo_hp_l2misc.json')
  .then(res => res.text())
  .then(text => console.log("FETCH SUCCESS:", text.substring(0, 50)))
  .catch(err => console.error(err));
