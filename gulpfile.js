const { src, dest } = require('gulp');

/**
 * Kopiert SVG-Icons aus dem Source-Tree in das dist/-Verzeichnis.
 * tsc kopiert nur .ts/.json; Binär-/SVG-Assets müssen separat.
 */
function buildIcons() {
	return src('nodes/**/*.svg').pipe(dest('dist/nodes'));
}

exports['build:icons'] = buildIcons;
