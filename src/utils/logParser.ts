import type { ViewMetrics, TimingMetrics } from '../types';

/**
 * Parses an ASCII table containing timing metrics across multiple path groups.
 * Expects a format similar to:
 * |     Setup mode     |   all   | default | ... |
 * |           WNS (ns):| -0.039  | -0.004  | ... |
 * |           TNS (ns):| -34.677 | -0.058  | ... |
 * |    Violating Paths:|  6772   |   45    | ... |
 * |          All Paths:|6.03e+05 |1.43e+05 | ... |
 */
export function parseLogToMetrics(rawLog: string): Partial<ViewMetrics> {
    const lines = rawLog.split('\n');
    const metrics: Partial<ViewMetrics> = {};

    let pathGroups: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line.startsWith('|')) continue;

        const cells = line.split('|').map(s => s.trim()).filter(s => s.length > 0);
        if (cells.length < 2) continue;

        const rowHeader = cells[0].toLowerCase();

        // 1. Identify Headers (Path Groups)
        if (rowHeader.includes('setup mode') || rowHeader.includes('hold mode')) {
            pathGroups = cells.slice(1).map(c => c.toLowerCase());
            // Initialize metrics object for each path group
            pathGroups.forEach(pg => {
                metrics[pg] = {};
            });
            continue;
        }

        // 2. Identify Data Rows
        if (pathGroups.length > 0) {
            let metricKey: keyof TimingMetrics | null = null;
            if (rowHeader.includes('wns')) metricKey = 'WNS';
            else if (rowHeader.includes('tns')) metricKey = 'TNS';
            else if (rowHeader.includes('violating paths')) metricKey = 'violating_paths';
            else if (rowHeader.includes('all paths')) metricKey = 'all_paths';

            if (metricKey) {
                const values = cells.slice(1);
                for (let j = 0; j < Math.min(values.length, pathGroups.length); j++) {
                    const pg = pathGroups[j];
                    const valStr = values[j];
                    if (valStr && valStr.toLowerCase() !== 'n/a') {
                        const numVal = parseFloat(valStr);
                        if (!isNaN(numVal) && metrics[pg]) {
                            // Non-null assertion is safe because we initialized above
                            metrics[pg]![metricKey] = numVal;
                        }
                    }
                }
            }
        }
    }

    // Clean up empty objects
    Object.keys(metrics).forEach(key => {
        if (Object.keys(metrics[key]!).length === 0) {
            delete metrics[key];
        }
    });

    return metrics;
}
