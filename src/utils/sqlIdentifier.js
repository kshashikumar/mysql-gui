/**
 * MySQL identifier escaping.
 *
 * MySQL wraps identifiers (database / table / column names) in backticks and
 * escapes a literal backtick inside the name by doubling it (`` ` `` -> `` `` ``).
 * Values must still be bound via knex `?` placeholders — this helper is ONLY for
 * identifiers, which cannot be parameterized.
 *
 * This prevents breaking out of the backtick context; it does not validate that
 * the identifier is semantically legal.
 */

'use strict';

/**
 * Escape and quote a single identifier.
 * @param {string} id raw identifier (db, table, or column name)
 * @returns {string} the identifier wrapped in backticks
 */
function escapeIdentifier(id) {
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error('Identifier must be a non-empty string');
  }
  if (id.indexOf('\u0000') !== -1) {
    throw new Error('Identifier contains a NUL character');
  }
  return '`' + id.replace(/`/g, '``') + '`';
}

/**
 * Quote a dotted identifier path.
 * Accepts an array (`['db', 'tbl', 'col']`) or a dotted string (`'db.tbl.col'`).
 * @param {string[]|string} parts
 * @returns {string} e.g. `` `db`.`tbl`.`col` ``
 */
function escapeQualified(parts) {
  const arr = Array.isArray(parts) ? parts : String(parts).split('.');
  return arr.map(escapeIdentifier).join('.');
}

module.exports = { escapeIdentifier, escapeQualified };
