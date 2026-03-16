const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'dashbaord_json');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

let anyErrors = false;
for (const file of files) {
    try {
        const data = fs.readFileSync(path.join(dir, file), 'utf8');
        const parsed = JSON.parse(data);
        if (!Array.isArray(parsed)) {
            console.log(file + ' is VALID JSON, but it is NOT an array. Type: ' + typeof parsed);
            anyErrors = true;
        } else {
            console.log(file + ' is VALID JSON array with ' + parsed.length + ' elements.');
        }
    } catch (e) {
        console.log(file + ' is INVALID JSON: ' + e.message);
        anyErrors = true;
    }
}
if (anyErrors) {
    process.exit(1);
}
