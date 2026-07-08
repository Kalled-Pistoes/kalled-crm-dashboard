export interface ClienteStatusLike {
    Status?: string;
    status?: string | null;
    ultimaCompra?: string | null;
}

export function normalizeClientName(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function parseDateOnly(dateStr?: string | null): Date | null {
    if (!dateStr) return null;
    const [year, month, day] = dateStr.split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(Date.UTC(year, month - 1, day, 12));
}

export function getInactiveMonths(ultimaCompra?: string | null, today = new Date()): number | null {
    const lastDate = parseDateOnly(ultimaCompra);
    if (!lastDate) return null;

    const currentUtc = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 12));
    let months = (currentUtc.getUTCFullYear() - lastDate.getUTCFullYear()) * 12
        + (currentUtc.getUTCMonth() - lastDate.getUTCMonth());

    if (currentUtc.getUTCDate() < lastDate.getUTCDate()) months -= 1;
    return Math.max(0, months);
}

export function getStatusBadgeLabel(cliente: ClienteStatusLike): string {
    const status = cliente.Status ?? cliente.status ?? '';
    if (status.toLowerCase() === 'ativo') return 'Ativo';

    const inactiveMonths = getInactiveMonths(cliente.ultimaCompra);
    if (inactiveMonths === null) return 'Inativo (Sem compras)';
    if (inactiveMonths === 0) return 'Inativo (< 1 mês)';

    return `Inativo (${inactiveMonths} ${inactiveMonths === 1 ? 'mês' : 'meses'})`;
}
