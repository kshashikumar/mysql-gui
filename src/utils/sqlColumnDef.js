/**
 * Helpers for rendering MySQL column definitions and other unquoted DDL tokens
 * (charset, collation, engine). DDL identifiers cannot be parameterized, so we
 * render them into the SQL string — but every token is validated to stay within
 * the column-definition grammar and prevent breaking out of it.
 */

'use strict';

const { escapeIdentifier } = require('./sqlIdentifier');

// Allows type strings like: VARCHAR(255), DECIMAL(10,2), INT UNSIGNED,
// ENUM('a','b','c'), TIMESTAMP, TINYINT(1). Blocks ; ` -- /* etc.
const TYPE_PATTERN = /^[A-Za-z0-9 _,()']+$/;

// For bare tokens: charset (utf8mb4), collation (utf8mb4_unicode_ci), engine (InnoDB).
const TOKEN_PATTERN = /^[A-Za-z0-9_]+$/;

function validateType(type) {
  if (typeof type !== 'string' || type.trim().length === 0) {
    throw new Error('Column type must be a non-empty string');
  }
  if (!TYPE_PATTERN.test(type)) {
    throw new Error(`Invalid characters in column type: "${type}"`);
  }
  return type;
}

function assertToken(value, label) {
  if (typeof value !== 'string' || !TOKEN_PATTERN.test(value)) {
    throw new Error(`Invalid ${label}: "${value}"`);
  }
  return value;
}

// Render a DEFAULT clause, or '' for no default.
function renderDefault(val, raw) {
  if (val === null || val === undefined || val === '') return '';
  if (raw) return `DEFAULT ${val}`; // raw expression, e.g. CURRENT_TIMESTAMP
  if (typeof val === 'number') return `DEFAULT ${val}`;
  if (typeof val === 'boolean') return `DEFAULT ${val ? 1 : 0}`;
  return `DEFAULT '${String(val).replace(/'/g, "''")}'`; // string literal
}

// Render a full column definition (no leading comma):
//   `name` TYPE [NOT NULL] [DEFAULT ...] [AUTO_INCREMENT]
function renderColumnDef(col) {
  const name = escapeIdentifier(col.name);
  const type = validateType(col.type);
  let def = `${name} ${type}`;
  if (col.nullable === false) def += ' NOT NULL';
  const defaultClause = renderDefault(col.default, col.defaultRaw);
  if (defaultClause) def += ' ' + defaultClause;
  if (col.autoIncrement) def += ' AUTO_INCREMENT';
  return def;
}

module.exports = {
  validateType,
  assertToken,
  renderDefault,
  renderColumnDef,
};
