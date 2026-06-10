import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'filterRows',
    standalone: true,
})
export class FilterRowsPipe implements PipeTransform {
    transform(rows: any[] | null | undefined, searchTerm: string): any[] {
        const source = rows || [];
        const normalizedTerm = searchTerm.trim().toLowerCase();

        if (!normalizedTerm) {
            return [...source];
        }

        return source.filter((row) =>
            Object.values(row || {}).some((value) => value != null && String(value).toLowerCase().includes(normalizedTerm)),
        );
    }
}
