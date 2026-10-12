// Server-side paging for Tabulator tables in remote mode.
//
// Reads Tabulator's request params:
//   ?page=1&size=25
//   &sort[0][field]=name&sort[0][dir]=asc
//   &filter[0][field]=name&filter[0][value]=ram
//   &search=...            (global search box, sent via ajaxParams)
//
// Only fields declared in `columns` can be sorted or filtered, so user input
// never reaches the SQL as an identifier. Values always go in as parameters.

const DEFAULT_SIZE = 25;
const MAX_SIZE = 100;

// qs turns sort[0][..] into an array, but into an object once indexes get large.
const toArray = (value) => {
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') return Object.values(value);
    return [];
};

const escapeLike = (value) => String(value).replace(/[\\%_]/g, '\\$&');

/**
 * @param {import('pg').Pool} pool
 * @param {object} query  req.query
 * @param {object} config
 *   select       SELECT list
 *   from         FROM clause (table plus any joins)
 *   columns      { field: { sql, sortSql?, filter?: 'like' | 'exact' | (value, add) => sql | false, sort?: false } }
 *   search       SQL expressions matched by the global search box
 *   extraFilters (query, add) => [sql conditions] for page-specific params
 *   defaultSort  ORDER BY used when the client sends no sort
 *   tieBreaker   unique column appended to ORDER BY so paging is stable
 */
const paginate = async (pool, query, config) => {
    const { select, from, columns, search = [], extraFilters, defaultSort, tieBreaker } = config;

    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const size = Math.min(MAX_SIZE, Math.max(1, parseInt(query.size, 10) || DEFAULT_SIZE));

    const params = [];
    const add = (value) => {
        params.push(value);
        return `$${params.length}`;
    };

    const where = [];

    for (const filter of toArray(query.filter)) {
        const column = filter && columns[filter.field];
        if (!column || column.filter === false) continue;

        const value = String(filter.value ?? '').trim();
        if (!value) continue;

        if (typeof column.filter === 'function') {
            const condition = column.filter(value, add);
            if (condition) where.push(condition);
        } else if (column.filter === 'exact') {
            where.push(`${column.sql} = ${add(value)}`);
        } else {
            where.push(`${column.sql}::text ILIKE ${add(`%${escapeLike(value)}%`)}`);
        }
    }

    const term = String(query.search ?? '').trim();
    if (term && search.length) {
        const placeholder = add(`%${escapeLike(term)}%`);
        where.push(`(${search.map((expr) => `${expr} ILIKE ${placeholder}`).join(' OR ')})`);
    }

    if (extraFilters) {
        where.push(...extraFilters(query, add));
    }

    const orderBy = toArray(query.sort)
        .filter((sort) => sort && columns[sort.field] && columns[sort.field].sort !== false)
        .map((sort) => {
            const column = columns[sort.field];
            const dir = sort.dir === 'desc' ? 'DESC' : 'ASC';
            return `${column.sortSql || column.sql} ${dir} NULLS LAST`;
        });
    if (!orderBy.length && defaultSort) orderBy.push(defaultSort);
    if (tieBreaker) orderBy.push(tieBreaker);

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const filterParams = params.slice();

    const [rows, count] = await Promise.all([
        pool.query(
            `SELECT ${select} FROM ${from} ${whereSql}
             ORDER BY ${orderBy.join(', ')}
             LIMIT ${add(size)} OFFSET ${add((page - 1) * size)}`,
            params
        ),
        pool.query(`SELECT COUNT(*) AS total FROM ${from} ${whereSql}`, filterParams),
    ]);

    const total = Number(count.rows[0].total);

    return {
        data: rows.rows,
        last_page: Math.max(1, Math.ceil(total / size)),
        last_row: total,
    };
};

module.exports = { paginate };
