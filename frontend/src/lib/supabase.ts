import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url ?? '', key ?? '');

export interface CatalogoProduto {
    id: string;
    cod: string;
    pa: string | null;
    descricao: string | null;
    grupo: string | null;
    montadora: string | null;
    veiculo: string | null;
    ano_aplicacao: string | null;
    motor: string | null;
    sobremedida: string | null;
    qtd_pistoes: number | null;
    diametro_cilindro: number | null;
    ref_metal_leve_sulloy: string | null;
    ref_anel_kalled: string | null;
    lancamentos: boolean | null;
}

export const catalogoConfigured = !!(url && key);