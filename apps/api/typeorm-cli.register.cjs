/**
 * Preloaded by the `migration-*` Nx targets so the TypeORM CLI can load the
 * TypeScript data source: compiles TS with ts-node and resolves the
 * workspace path aliases (e.g. `@fictulary/shared/models`) from the root.
 */
const path = require('node:path');
const { register } = require('tsconfig-paths');
const tsNode = require('ts-node');

const workspaceRoot = path.resolve(__dirname, '../..');
const { compilerOptions } = require('../../tsconfig.base.json');

tsNode.register({
  project: path.join(__dirname, 'tsconfig.app.json'),
  transpileOnly: true,
});
register({ baseUrl: workspaceRoot, paths: compilerOptions.paths });
