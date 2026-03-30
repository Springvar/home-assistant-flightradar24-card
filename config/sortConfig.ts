import type { SortCriterion } from '../types/config';

export const sortConfig: SortCriterion[] = [
    { field: 'id', comparator: 'oneOf', value: '${selectedFlights}', order: 'DESC' },
    { field: 'altitude', comparator: 'eq', value: 0, order: 'ASC' },
    { field: 'closest_passing_distance ?? distance_to_tracker', order: 'ASC' }
];
