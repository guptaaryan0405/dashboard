---
description: This workflow builds the dashboard application and automatically packages the dist folder into a zip file for deployment/release.
---
# How to build and release the dashboard

When asked to "build it" or "release it" for the Run Tracker Dashboard, you should utilize the `npm run release` script. This handles building via Vite and properly zipping the `dist` folder into `run_tracker_dashboard.zip`.

1. Run the `release` script via the run_command tool:
// turbo
```bash
npm run release
```

2. Confirm with the user that the `run_tracker_dashboard.zip` has been created and is ready for upload.
