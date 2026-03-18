/**
 * sync_supabase.ts
 * Lê o Excel local e sincroniza com o Supabase.
 *
 * Uso: node --loader ts-node/esm scripts/sync_supabase.ts
 *
 * Requer backend/.env com:
 *   SUPABASE_URL=https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ...
 */

import XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createClient } from '@supabase/supabase-js';

// ── Setup ──────────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// Carrega .env manualmente (sem dependencia extra)
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
        const [key, ...rest] = line.split('=');
        if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
    }
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('\n[ERRO] Variaveis de ambiente nao encontradas.');
    console.error('Crie o arquivo backend/.env com:');
    console.error('  SUPABASE_URL=https://xxxx.supabase.co');
    console.error('  SUPABASE_SERVICE_ROLE_KEY=eyJ...\n');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const EXCEL_PATH = process.env.EXCEL_PATH || path.resolve(__dirname, '../../Base de Dados de Vendas.xlsx');

// ── Helpers (mesma logica do backend/index.ts) ─────────────────────────────────
function parseCurrency(value: any): number {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    const str = String(value).replace('R$', '').trim().replace(/\./g, '').replace(',', '.');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
}

function parseDate(value: any): string {
    if (!value) return '';
    if (typeof value === 'number') {
        const d = new Date(Math.round((value - 25569) * 86400 * 1000));
        return d.toISOString().split('T')[0];
    }
    const str = String(value).trim();
    const ddmmyyyy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmmyyyy) {
        return `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`;
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? str : d.toISOString().split('T')[0];
}

function getRowValue(row: any, ...keys: string[]): any {
    for (const key of keys) {
        if (row[key] !== undefined) return row[key];
        const lowKey = key.toLowerCase();
        for (const rKey in row) {
            if (rKey.toLowerCase() === lowKey) return row[rKey];
        }
    }
    return undefined;
}

function getSheet<T = any>(wb: XLSX.WorkBook, sheetName: string): T[] {
    const sheet = wb.Sheets[sheetName];
    return sheet ? XLSX.utils.sheet_to_json<T>(sheet) : [];
}

// Upsert em lotes para evitar timeout
async function upsertBatch(table: string, rows: any[], conflictCol: string) {
    const BATCH = 500;
    let total = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const { error } = await supabase.from(table).upsert(batch, { onConflict: conflictCol });
        if (error) throw new Error(`[${table}] upsert erro: ${error.message}`);
        total += batch.length;
    }
    return total;
}

async function insertBatch(table: string, rows: any[]) {
    const BATCH = 500;
    let total = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const { error } = await supabase.from(table).insert(batch);
        if (error) throw new Error(`[${table}] insert erro: ${error.message}`);
        total += batch.length;
    }
    return total;
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
    console.log('\n========================================');
    console.log(' CRM Kalled Pistoes - Sync Excel -> Supabase');
    console.log('========================================\n');

    if (!fs.existsSync(EXCEL_PATH)) {
        console.error(`[ERRO] Excel nao encontrado: ${EXCEL_PATH}`);
        process.exit(1);
    }

    console.log('[1/6] Lendo Excel...');
    const wb = XLSX.readFile(EXCEL_PATH);

    const rawMetas     = getSheet(wb, 'Metas Representantes');
    const rawClientes  = getSheet(wb, 'Clientes');
    const rawCross     = getSheet(wb, 'Cross');
    const rawVendas    = getSheet(wb, 'Vendas');
    const rawVendasRep = getSheet(wb, 'Vendas Representantes');
    const rawVisitas   = getSheet(wb, 'Visitas Tecnicas');

    console.log(`   Representantes: ${rawMetas.length} | Clientes: ${rawClientes.length} | Produtos: ${rawCross.length}`);
    console.log(`   Vendas: ${rawVendas.length} | Vendas Rep: ${rawVendasRep.length} | Visitas: ${rawVisitas.length}`);

    // ── 1. REPRESENTANTES ──────────────────────────────────────────────────────
    console.log('\n[2/6] Sincronizando representantes...');
    const repsToUpsert = rawMetas
        .map((row: any) => ({
            nome:        String(getRowValue(row, 'Vendedor', 'vendedor') || '').trim(),
            estado:      String(getRowValue(row, 'Estado', 'estado') || '').trim() || null,
            meta_mensal: parseCurrency(getRowValue(row, 'Meta', 'meta')) || null,
            updated_at:  new Date().toISOString(),
        }))
        .filter(r => r.nome);

    const repsCount = await upsertBatch('representantes', repsToUpsert, 'nome');
    console.log(`   ${repsCount} representantes sincronizados`);

    // Busca IDs dos representantes para usar como FK
    const { data: repsData } = await supabase.from('representantes').select('id, nome');
    const repMap = new Map<string, string>((repsData || []).map(r => [r.nome, r.id]));

    // ── 2. CLIENTES ────────────────────────────────────────────────────────────
    console.log('\n[3/6] Sincronizando clientes...');
    const clientesToUpsert = rawClientes
        .map((row: any) => {
            const nome = String(getRowValue(row, 'Cliente', 'cliente', 'Razão Social') || '').trim();
            const repNome = String(getRowValue(row, 'Representante', 'representante') || '').trim();
            return {
                nome,
                status:           String(getRowValue(row, 'Status', 'status') || '').trim() || null,
                grupo:            String(getRowValue(row, 'Grupo', 'grupo') || '').trim() || null,
                desconto:         String(getRowValue(row, 'Desconto', 'desconto') || '').trim() || null,
                pagamento:        String(getRowValue(row, 'Pagamento', 'pagamento') || '').trim() || null,
                prazo:            String(getRowValue(row, 'Prazo', 'prazo') || '').trim() || null,
                representante_id: repMap.get(repNome) || null,
                updated_at:       new Date().toISOString(),
            };
        })
        .filter(c => c.nome);

    const clientesCount = await upsertBatch('clientes', clientesToUpsert, 'nome');
    console.log(`   ${clientesCount} clientes sincronizados`);

    const { data: clientesData } = await supabase.from('clientes').select('id, nome');
    const clienteMap = new Map<string, string>((clientesData || []).map(c => [c.nome, c.id]));

    // ── 3. PRODUTOS (Cross) ────────────────────────────────────────────────────
    console.log('\n[4/6] Sincronizando produtos...');
    const produtosToUpsert = rawCross
        .map((row: any) => {
            const pn = String(getRowValue(row, 'PN', 'pn') || '').trim();
            if (!pn) return null;
            const linhas: string[] = [];
            if (getRowValue(row, 'Metal Leve')) linhas.push('Metal Leve');
            if (getRowValue(row, 'Sulloy'))     linhas.push('Sulloy');
            if (getRowValue(row, 'KS'))         linhas.push('KS');
            if (getRowValue(row, 'Apex'))       linhas.push('Apex');
            return {
                pn,
                descricao: String(getRowValue(row, 'Descrição', 'Descricao', 'descricao') || '').trim() || null,
                linhas,
            };
        })
        .filter(Boolean) as any[];

    const produtosCount = await upsertBatch('produtos', produtosToUpsert, 'pn');
    console.log(`   ${produtosCount} produtos sincronizados`);

    const { data: produtosData } = await supabase.from('produtos').select('id, pn');
    const produtoMap = new Map<string, string>((produtosData || []).map(p => [p.pn, p.id]));

    // ── 4-6. DADOS TRANSACIONAIS — truncate + reinsert ─────────────────────────
    console.log('\n[5/6] Recriando dados transacionais...');

    // Truncate em ordem (respeita FK constraints)
    for (const t of ['vendas', 'vendas_representantes', 'visitas_tecnicas']) {
        const { error } = await supabase.from(t).delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) throw new Error(`Truncate ${t}: ${error.message}`);
    }
    console.log('   Dados transacionais removidos');

    // Vendas
    const vendasRows = rawVendas
        .map((row: any) => {
            const data    = parseDate(getRowValue(row, 'Data', 'data'));
            const cliente = String(getRowValue(row, 'Cliente', 'cliente') || '').trim();
            const sku     = String(getRowValue(row, 'Código (SKU)', 'Codigo', 'codigo', 'PN', 'pn') || '').trim();
            if (!data || !cliente) return null;
            // Descobre representante via cliente
            const clienteId = clienteMap.get(cliente);
            const repNome   = rawClientes.find((c: any) =>
                String(getRowValue(c, 'Cliente', 'cliente') || '').trim() === cliente
            );
            const repId = repNome
                ? repMap.get(String(getRowValue(repNome, 'Representante', 'representante') || '').trim())
                : undefined;
            return {
                data,
                cliente_id:       clienteId || null,
                produto_id:       produtoMap.get(sku) || null,
                quantidade:       parseCurrency(getRowValue(row, 'Quantidade', 'quantidade')) || null,
                valor:            parseCurrency(getRowValue(row, 'Valor', 'valor')) || null,
                representante_id: repId || null,
            };
        })
        .filter(Boolean) as any[];

    const vendasCount = await insertBatch('vendas', vendasRows);
    console.log(`   vendas: ${vendasCount} linhas inseridas`);

    // Vendas Representantes
    const vendasRepRows = rawVendasRep
        .map((row: any) => {
            const data     = parseDate(getRowValue(row, 'Data', 'data'));
            const vendedor = String(getRowValue(row, 'Vendedor', 'vendedor') || '').trim();
            const cliente  = String(getRowValue(row, 'Cliente', 'cliente') || '').trim();
            if (!data || !vendedor) return null;
            return {
                data,
                representante_id: repMap.get(vendedor) || null,
                cliente_id:       clienteMap.get(cliente) || null,
                valor_pedido:     parseCurrency(getRowValue(row, 'Valor do Pedido', ' Valor do Pedido ', 'Valor', 'valor')) || null,
            };
        })
        .filter(Boolean) as any[];

    const vrCount = await insertBatch('vendas_representantes', vendasRepRows);
    console.log(`   vendas_representantes: ${vrCount} linhas inseridas`);

    // Visitas Técnicas
    const visitasRows = rawVisitas
        .map((row: any) => {
            const data     = parseDate(getRowValue(row, 'Data', 'data'));
            const rep      = String(getRowValue(row, 'Representante', 'representante', 'Vendedor', 'vendedor') || '').trim();
            const cliente  = String(getRowValue(row, 'Cliente', 'cliente') || '').trim();
            if (!data || !rep) return null;
            return {
                data,
                tipo_visita:      String(getRowValue(row, 'Tipo de Visita', 'tipo de visita') || '').trim() || null,
                representante_id: repMap.get(rep) || null,
                cliente_id:       clienteMap.get(cliente) || null,
                custo_visita:     parseCurrency(getRowValue(row, 'Custo da Visita (R$)', 'Custo da Visita', 'custo da visita (r$)', 'custo da visita')) || 0,
            };
        })
        .filter(Boolean) as any[];

    const visitasCount = await insertBatch('visitas_tecnicas', visitasRows);
    console.log(`   visitas_tecnicas: ${visitasCount} linhas inseridas`);

    // ── Summary ────────────────────────────────────────────────────────────────
    console.log('\n========================================');
    console.log(' Sync concluido com sucesso!');
    console.log('========================================');
    console.log(` representantes : ${repsCount}`);
    console.log(` clientes       : ${clientesCount}`);
    console.log(` produtos       : ${produtosCount}`);
    console.log(` vendas         : ${vendasCount}`);
    console.log(` vendas_rep     : ${vrCount}`);
    console.log(` visitas        : ${visitasCount}`);
    console.log('========================================\n');
}

main().catch(err => {
    console.error('\n[ERRO FATAL]', err.message);
    process.exit(1);
});
