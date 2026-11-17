// Build FlowBoard into one file.  Run from the project folder:  node build.js
// Joins src/*.js in order and puts them, with src/styles.css, into src/index.template.html.
// Output: flowboard_work_os.html, and index.html (an identical copy, so the hosted site opens at the
// folder address, for example https://prajwal-workspace.github.io/Flowboard/). Never edit either by hand.
const fs = require('fs'), path = require('path');
const root = __dirname;
const order = ['00-utils', '01-storage', '02-state', '03-timer', '04-view-kanban', '05-view-planner',
  '06-view-journal', '07-view-insights', '08-view-settings', '09-sync', '10-app'];
const missing = order.map(f => path.join('src', f + '.js')).concat(['src/styles.css', 'src/index.template.html'].map(p => path.normalize(p)))
  .filter(p => !fs.existsSync(path.join(root, p)));
if (missing.length) { console.error('Build stopped. Missing file(s):\n  ' + missing.join('\n  ')); process.exit(1); }
const js = order.map(f => fs.readFileSync(path.join(root, 'src', f + '.js'), 'utf8')).join('\n');
const css = fs.readFileSync(path.join(root, 'src', 'styles.css'), 'utf8');
let html = fs.readFileSync(path.join(root, 'src', 'index.template.html'), 'utf8');
if (!html.includes('<!-- INLINE_STYLE -->') || !html.includes('<!-- INLINE_SCRIPT -->')) {
  console.error('Build stopped. src/index.template.html must contain <!-- INLINE_STYLE --> and <!-- INLINE_SCRIPT -->.'); process.exit(1);
}
html = html.replace('<!-- INLINE_STYLE -->', () => '<style>' + css + '</style>')
  .replace('<!-- INLINE_SCRIPT -->', () => '<script>' + js + '</script>');
fs.writeFileSync(path.join(root, 'flowboard_work_os.html'), html);
fs.writeFileSync(path.join(root, 'index.html'), html);
const version = (js.match(/const APP_VERSION = '([^']+)'/) || [])[1] || '?';
console.log('Built flowboard_work_os.html and index.html: v' + version + ', ' + Math.round(html.length / 1024) + ' KB');
