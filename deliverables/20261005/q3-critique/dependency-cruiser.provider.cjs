module.exports = { forbidden: [
  { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
  { name: 'chart-api-must-not-import-rest-accel', severity: 'error', from: { path: '^services/chart-api' }, to: { path: '^services/rest-accel' } },
  { name: 'chart-api-must-not-import-stocks-ops', severity: 'error', from: { path: '^services/chart-api' }, to: { path: '^services/stocks-ops' } },
  { name: 'rest-accel-must-not-import-chart-api', severity: 'warn', from: { path: '^services/rest-accel' }, to: { path: '^services/chart-api' } },
  { name: 'rest-accel-must-not-import-stocks-ops', severity: 'error', from: { path: '^services/rest-accel' }, to: { path: '^services/stocks-ops' } },
  { name: 'stocks-ops-must-not-import-chart-api', severity: 'warn', from: { path: '^services/stocks-ops' }, to: { path: '^services/chart-api' } },
  { name: 'stocks-ops-must-not-import-rest-accel', severity: 'warn', from: { path: '^services/stocks-ops' }, to: { path: '^services/rest-accel' } },
  { name: 'service-to-service', severity: 'info', from: { path: '^services/([^/]+)/' }, to: { path: '^services/([^/]+)/', pathNot: '^services/$1/' } },
  { name: 'no-orphans', severity: 'info', from: { orphan: true, pathNot: ['\\.test\\.mjs$'] }, to: {} }
], options: { doNotFollow: { path: 'node_modules' }, exclude: { path: 'node_modules|^evidence|^ops' }, moduleSystems: ['es6', 'cjs'], tsPreCompilationDeps: false, enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'require', 'node', 'default'], extensions: ['.js', '.mjs', '.cjs', '.json'] } } }
