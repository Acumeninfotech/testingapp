const fs = require('fs');
const path = require('path');

const ENGINE_DIR = path.join(__dirname, '..', '..', 'assets', 'js', 'engine');
if (!fs.existsSync(ENGINE_DIR) || fs.readdirSync(ENGINE_DIR).length === 0) {
  console.error(
    `\nApplySmart API cannot start: ${ENGINE_DIR} is missing or empty.\n` +
    'This folder lives on iCloud Drive and can be evicted locally when "Optimize Mac Storage" ' +
    'reclaims space for rarely-used files. Open it in Finder to force iCloud to redownload it, ' +
    'then restart the API.\n'
  );
  process.exit(1);
}

const { createApp } = require('./app');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';

const app = createApp();

app.listen(PORT, HOST, () => {
  console.log(`ApplySmart API listening on http://${HOST}:${PORT}`);
});
