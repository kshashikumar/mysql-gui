import { FilterRowsPipe } from './filter-rows.pipe';

describe('FilterRowsPipe', () => {
    const rows = [
        { id: 1, name: 'Alice', email: 'alice@example.com', note: null },
        { id: 2, name: 'Bob', email: 'support@example.com', note: 'Active' },
        { id: 30, name: 'Carol', email: 'carol@example.com', note: undefined },
    ];

    let pipe: FilterRowsPipe;

    beforeEach(() => {
        pipe = new FilterRowsPipe();
    });

    it('returns all rows for an empty search term without changing the source array', () => {
        const result = pipe.transform(rows, '  ');

        expect(result).toEqual(rows);
        expect(result).not.toBe(rows);
        expect(rows.length).toBe(3);
    });

    it('matches text across all columns without regard to case', () => {
        expect(pipe.transform(rows, 'ALICE')).toEqual([rows[0]]);
        expect(pipe.transform(rows, 'support')).toEqual([rows[1]]);
    });

    it('matches numeric values and safely ignores null values', () => {
        expect(pipe.transform(rows, '30')).toEqual([rows[2]]);
        expect(pipe.transform(rows, 'null')).toEqual([]);
    });

    it('returns an empty array when no rows match', () => {
        expect(pipe.transform(rows, 'missing')).toEqual([]);
    });
});
