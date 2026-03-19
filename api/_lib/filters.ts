import { SupabaseClient } from '@supabase/supabase-js';

export interface QueryFilters {
    ano?: string;
    mes?: string;
    linha?: string;
    grupo?: string;
}

// Aplica filtros de data a uma query Supabase.
// defaultCurrentYear: se true, usa ano atual como padrão quando nenhum filtro é fornecido.
// Use para tabelas grandes (vendas); não use para tabelas pequenas (visitas).
export function applyDateFilter(
    q: any,
    filters: QueryFilters,
    options: { limitYTD?: boolean; defaultCurrentYear?: boolean } = {}
): any {
    const { ano, mes } = filters;
    const { limitYTD = false, defaultCurrentYear = false } = options;
    const today = new Date();
    const currentYear = today.getFullYear().toString();

    if (!ano && !mes && !defaultCurrentYear) return q; // sem filtro

    const yearToUse = ano || currentYear;

    if (mes) {
        const m = mes.padStart(2, '0');
        const monthNum = parseInt(m);
        const nextMonth = monthNum === 12
            ? `${parseInt(yearToUse) + 1}-01-01`
            : `${yearToUse}-${String(monthNum + 1).padStart(2, '0')}-01`;
        q = q.gte('data', `${yearToUse}-${m}-01`).lt('data', nextMonth);
    } else if (limitYTD) {
        const maxMes = String(today.getMonth() + 1).padStart(2, '0');
        q = q.gte('data', `${yearToUse}-01-01`).lte('data', `${yearToUse}-${maxMes}-31`);
    } else {
        q = q.gte('data', `${yearToUse}-01-01`).lte('data', `${yearToUse}-12-31`);
    }
    return q;
}

// Busca IDs de produtos de uma determinada linha
export async function getProdutoIdsForLinha(supabase: SupabaseClient, linha: string): Promise<string[]> {
    const { data } = await supabase.from('produtos').select('id').contains('linhas', [linha]);
    return (data || []).map((p: any) => p.id);
}

// Busca IDs de clientes de um determinado grupo (status)
export async function getClienteIdsForGrupo(supabase: SupabaseClient, grupo: string): Promise<string[]> {
    const { data } = await supabase.from('clientes').select('id').eq('status', grupo);
    return (data || []).map((c: any) => c.id);
}

// Aplica todos os filtros comuns (linha, grupo, rep) a uma query de vendas
// Usa defaultCurrentYear=true para garantir que tabelas grandes sejam sempre filtradas
//
// IMPORTANTE: retorna um Proxy que oculta .then/.catch/.finally do query builder.
// Sem isso, funções async que retornam um Supabase query builder (que é "thenable")
// o executam prematuramente via Promise Resolution Procedure — causando
// "q.limit is not a function" no chamador.
export async function applyVendasFilters(
    supabase: SupabaseClient,
    q: any,
    filters: QueryFilters,
    repId?: string
): Promise<any> {
    q = applyDateFilter(q, filters, { defaultCurrentYear: true });
    if (repId) q = q.eq('representante_id', repId);
    if (filters.linha) {
        const ids = await getProdutoIdsForLinha(supabase, filters.linha);
        if (ids.length === 0) q = q.eq('id', '00000000-0000-0000-0000-000000000000');
        else q = q.in('produto_id', ids);
    }
    if (filters.grupo) {
        const ids = await getClienteIdsForGrupo(supabase, filters.grupo);
        if (ids.length === 0) q = q.eq('id', '00000000-0000-0000-0000-000000000000');
        else q = q.in('cliente_id', ids);
    }
    // Proxy oculta .then para o runtime não tratar o query builder como Promise
    return new Proxy(q, {
        get(target, prop, receiver) {
            if (prop === 'then' || prop === 'catch' || prop === 'finally') return undefined;
            const val = Reflect.get(target, prop, receiver);
            return typeof val === 'function' ? val.bind(target) : val;
        },
    });
}

// Agrupa array por chave e soma um campo numérico
export function groupBySum<T>(
    rows: T[],
    keyFn: (row: T) => string,
    valueFn: (row: T) => number
): Record<string, number> {
    const map: Record<string, number> = {};
    for (const row of rows) {
        const k = keyFn(row);
        map[k] = (map[k] || 0) + valueFn(row);
    }
    return map;
}

// Extrai YYYY-MM de uma data ISO
export function toYearMonth(dateStr: string): string {
    return dateStr.substring(0, 7);
}

export function toYear(dateStr: string): string {
    return dateStr.substring(0, 4);
}
