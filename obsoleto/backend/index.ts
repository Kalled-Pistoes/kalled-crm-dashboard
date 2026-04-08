import Fastify from 'fastify';
import cors from '@fastify/cors';
import staticPlugin from '@fastify/static';
import XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import * as os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fastify = Fastify({ logger: true });

// ── Caminho do Excel ──────────────────────────────────────────────────────────
const EXCEL_PATH = path.resolve(__dirname, '../Base de Dados de Vendas.xlsx');

// ── Auth ───────────────────────────────────────────────────────────────────────
const USERS_PATH = path.join(__dirname, 'data', 'users.json');
const JWT_SECRET = process.env.JWT_SECRET ?? 'crm-kalled-local-2025';

interface AuthUser {
    id: string;
    username: string;
    role: string;
    representante: string | null;
}

declare module 'fastify' {
    interface FastifyRequest {
        user?: AuthUser;
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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

interface Mappings {
    skuToLine: Record<string, string[]>;
    clienteToGrupo: Record<string, string>;
    clienteToEstado: Record<string, string>;
    clienteToRep: Record<string, string>;
}

function filterData(data: any[], query: any, mappings: Mappings, limitYTD: boolean = false) {
    const { ano, mes, linha, grupo } = query;
    return data.filter(row => {
        const dateStr = parseDate(getRowValue(row, 'Data', 'data'));
        if (!dateStr) return false;

        // Filtro de Ano
        if (ano && !dateStr.startsWith(ano)) return false;

        // Filtro de Mês / YTD
        const m = dateStr.substring(5, 7);
        if (mes) {
            if (m !== mes.padStart(2, '0')) return false;
        } else if (limitYTD) {
            // Se comparando com ano anterior sem mês definido, compara apenas até o mês atual (congruente/YTD)
            const today = new Date(); // Local time: 2026-02-20
            const maxMes = String(today.getMonth() + 1).padStart(2, '0');
            if (m > maxMes) return false;
        }

        // Filtro de Linha (via Join com Cross)
        if (linha) {
            const sku = getRowValue(row, 'Código (SKU)', 'Codigo', 'codigo', 'PN', 'pn');
            const productLines = mappings.skuToLine[sku] || [];
            if (!productLines.includes(linha)) return false;
        }

        // Filtro de Grupo (via Join com Clientes)
        if (grupo) {
            const cli = getRowValue(row, 'Cliente', 'cliente');
            const cliGrupo = mappings.clienteToGrupo[cli] || 'Sem Grupo';
            if (cliGrupo !== grupo) return false;
        }

        // Filtro por representante (automático via JWT — injeta _representante na query)
        const _representante = (query as any)._representante;
        if (_representante) {
            const cli = String(getRowValue(row, 'Cliente', 'cliente') || '').trim();
            const directRep = String(getRowValue(row, 'Representante', 'representante', 'Vendedor', 'vendedor') || '').trim();
            const repViaCliente = cli ? mappings.clienteToRep[cli] : undefined;
            if (repViaCliente !== _representante && directRep !== _representante) return false;
        }

        return true;
    });
}

// ── Leitura do Excel (com cache de 5 minutos) ─────────────────────────────────
let _cachedWb: XLSX.WorkBook | null = null;
let _cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

function loadWorkbook(): XLSX.WorkBook {
    const now = Date.now();
    if (_cachedWb && (now - _cacheTime) < CACHE_TTL) return _cachedWb;
    if (!fs.existsSync(EXCEL_PATH)) throw new Error(`Arquivo não encontrado: ${EXCEL_PATH}`);

    // Copia para temp antes de ler — evita falha quando o Excel está aberto (lock Windows)
    const tmpPath = path.join(os.tmpdir(), `crm_wb_${Date.now()}.xlsx`);
    try {
        fs.copyFileSync(EXCEL_PATH, tmpPath);
        _cachedWb = XLSX.readFile(tmpPath);
        _cacheTime = now;
    } finally {
        try { fs.unlinkSync(tmpPath); } catch {}
    }

    return _cachedWb!;
}

function getSheet<T = any>(wb: XLSX.WorkBook, sheetName: string): T[] {
    const sheet = wb.Sheets[sheetName];
    return sheet ? XLSX.utils.sheet_to_json<T>(sheet) : [];
}

function normalizeName(name: any): string {
    if (!name) return '';
    return String(name).toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[-\/]/g, ' ')
        .trim();
}

function getMappings(wb: XLSX.WorkBook): Mappings {
    const rawCross = getSheet(wb, 'Cross');
    const rawClientes = getSheet(wb, 'Clientes');
    const rawReps = getSheet(wb, 'Metas Representantes');

    const skuToLine: Record<string, string[]> = {};
    rawCross.forEach((row: any) => {
        const sku = getRowValue(row, 'PN', 'pn');
        if (!sku) return;
        const lines: string[] = [];
        if (getRowValue(row, 'Metal Leve')) lines.push('Metal Leve');
        if (getRowValue(row, 'Sulloy')) lines.push('Sulloy');
        if (getRowValue(row, 'KS')) lines.push('KS');
        if (getRowValue(row, 'Apex')) lines.push('Apex');
        skuToLine[sku] = lines;
    });

    const clienteToGrupo: Record<string, string> = {};
    const clienteToRep: Record<string, string> = {};
    rawClientes.forEach((row: any) => {
        const cliente = getRowValue(row, 'Cliente', 'cliente');
        const status = getRowValue(row, 'Status', 'status');
        const rep = getRowValue(row, 'Representante', 'representante');
        if (cliente) {
            clienteToGrupo[cliente] = status || 'Sem Grupo';
            if (rep) clienteToRep[cliente] = rep;
        }
    });

    const repToEstado: Record<string, string> = {};
    const normalizedRepToEstado: Record<string, string> = {};

    rawReps.forEach((row: any) => {
        const rep = getRowValue(row, 'Vendedor', 'vendedor');
        const estado = getRowValue(row, 'Estado', 'estado');
        if (rep && estado) {
            repToEstado[rep] = estado;
            normalizedRepToEstado[normalizeName(rep)] = estado;
        }
    });

    const clienteToEstado: Record<string, string> = {};
    Object.keys(clienteToRep).forEach(cli => {
        const rep = clienteToRep[cli];
        // Tenta match exato primeiro, depois normalizado
        let estado = repToEstado[rep];
        if (!estado) {
            estado = normalizedRepToEstado[normalizeName(rep)];
        }

        // Se ainda não achou, tenta ver se o nome do rep contém algum nome da lista de metas (ou vice-versa)
        if (!estado && rep) {
            const normRep = normalizeName(rep);
            if (normRep.length > 5) {
                for (const [normMeta, st] of Object.entries(normalizedRepToEstado)) {
                    if (normMeta.length > 5 && (normRep.includes(normMeta) || normMeta.includes(normRep))) {
                        estado = st;
                        break;
                    }
                }
            }
        }

        if (estado) clienteToEstado[cli] = estado;
    });

    return { skuToLine, clienteToGrupo, clienteToEstado, clienteToRep };
}

// ── Cors ──────────────────────────────────────────────────────────────────────
fastify.register(cors, { origin: true });

// ── Serve Frontend Estático ───────────────────────────────────────────────────
const frontendDist = path.resolve(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDist)) {
    fastify.register(staticPlugin, {
        root: frontendDist,
        prefix: '/',
        decorateReply: false,
    });
}

// ── Auth Helpers ───────────────────────────────────────────────────────────────
async function initUsers() {
    const dir = path.dirname(USERS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(USERS_PATH)) {
        const hash = await bcrypt.hash('admin123!', 10);
        fs.writeFileSync(USERS_PATH, JSON.stringify([{
            id: randomUUID(), username: 'admin', passwordHash: hash,
            role: 'admin', representante: null, createdAt: new Date().toISOString()
        }], null, 2));
        console.log('[CRM] Usuário admin criado: admin / admin123!');
    }
}

function readUsers(): any[] { return JSON.parse(fs.readFileSync(USERS_PATH, 'utf8')); }
function writeUsers(users: any[]) { fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2)); }

function requireAdmin(request: any, reply: any): boolean {
    if (request.user?.role !== 'admin') {
        reply.status(403).send({ error: 'Acesso restrito ao administrador' });
        return false;
    }
    return true;
}

// ── Middleware: JWT Auth ───────────────────────────────────────────────────────
fastify.addHook('preHandler', async (request, reply) => {
    if (!request.url.startsWith('/api/')) return;
    if (request.url.startsWith('/api/auth/') || request.url === '/api/health') return;
    const auth = request.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: 'Token de acesso necessário' });
    try {
        const payload = jwt.verify(auth.slice(7), JWT_SECRET) as any;
        request.user = { id: payload.id, username: payload.username, role: payload.role, representante: payload.representante };
        if (payload.role === 'representante' && payload.representante) {
            (request.query as any)._representante = payload.representante;
        }
    } catch {
        return reply.status(401).send({ error: 'Token inválido ou expirado' });
    }
});

// ── Auth Endpoints ─────────────────────────────────────────────────────────────
fastify.post('/api/auth/login', async (request, reply) => {
    const { username, password } = request.body as { username: string; password: string };
    if (!username || !password) return reply.status(400).send({ error: 'Usuário e senha são obrigatórios' });
    const users = readUsers();
    const user = users.find((u: any) => u.username === username);
    if (!user || !await bcrypt.compare(password, user.passwordHash))
        return reply.status(401).send({ error: 'Usuário ou senha incorretos' });
    const payload = { id: user.id, username: user.username, role: user.role, representante: user.representante };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
    return { token, user: payload };
});

fastify.get('/api/auth/me', async (request) => request.user);

fastify.get('/api/admin/users', async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    return readUsers().map(({ passwordHash: _, ...u }: any) => u);
});

fastify.post('/api/admin/users', async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { username, password, role, representante } = request.body as any;
    if (!username || !password || !role)
        return reply.status(400).send({ error: 'Campos obrigatórios: username, password, role' });
    const users = readUsers();
    if (users.find((u: any) => u.username === username))
        return reply.status(409).send({ error: 'Usuário já existe' });
    const newUser = {
        id: randomUUID(), username,
        passwordHash: await bcrypt.hash(password, 10),
        role, representante: representante || null, createdAt: new Date().toISOString()
    };
    users.push(newUser);
    writeUsers(users);
    const { passwordHash: _, ...out } = newUser;
    return reply.status(201).send(out);
});

fastify.put('/api/admin/users/:id', async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { id } = request.params as { id: string };
    const { password, role, representante } = request.body as any;
    const users = readUsers();
    const idx = users.findIndex((u: any) => u.id === id);
    if (idx === -1) return reply.status(404).send({ error: 'Usuário não encontrado' });
    if (password) users[idx].passwordHash = await bcrypt.hash(password, 10);
    if (role !== undefined) users[idx].role = role;
    if (representante !== undefined) users[idx].representante = representante || null;
    writeUsers(users);
    const { passwordHash: _, ...out } = users[idx];
    return out;
});

fastify.delete('/api/admin/users/:id', async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { id } = request.params as { id: string };
    if (id === request.user?.id)
        return reply.status(400).send({ error: 'Não é possível excluir sua própria conta' });
    const users = readUsers();
    const idx = users.findIndex((u: any) => u.id === id);
    if (idx === -1) return reply.status(404).send({ error: 'Usuário não encontrado' });
    users.splice(idx, 1);
    writeUsers(users);
    return { success: true };
});

// ── Endpoints ─────────────────────────────────────────────────────────────────
fastify.get('/api/health', async () => ({ status: 'ok', message: 'CRM Backend rodando (v3)' }));

fastify.get('/api/dashboard/stats', async (request, reply) => {
    try {
        const wb = loadWorkbook();
        const mappings = getMappings(wb);
        const rawVendas = getSheet(wb, 'Vendas');

        const query: any = request.query;
        const currentYear = query.ano || '2026';
        const vendas = filterData(rawVendas, query, mappings);

        const anoAnterior = String(parseInt(currentYear) - 1);
        const queryAnterior = { ...query, ano: anoAnterior };

        const today = new Date();
        const isActualCurrentYear = currentYear === String(today.getFullYear());
        const limitYTD = !query.mes && isActualCurrentYear;

        const vendasAnterior = filterData(rawVendas, queryAnterior, mappings, limitYTD);

        const sumValues = (arr: any[]) => arr.reduce((acc, r) => acc + parseCurrency(getRowValue(r, 'Valor', 'valor')), 0);
        const sumPecas = (arr: any[]) => arr.reduce((acc, r) => acc + (parseFloat(getRowValue(r, 'Quantidade', 'quantidade')) || 0), 0);

        const _userRep = (query as any)._representante;
        const _rawClis = getSheet(wb, 'Clientes');
        const _rawReps = getSheet(wb, 'Metas Representantes');
        const totalClientesCount = _userRep
            ? _rawClis.filter((c: any) => String(getRowValue(c, 'Representante', 'representante') || '').trim() === _userRep).length
            : _rawClis.length;
        const totalRepsCount = _userRep
            ? _rawReps.filter((r: any) => String(getRowValue(r, 'Vendedor', 'vendedor') || '').trim() === _userRep).length
            : _rawReps.length;

        return {
            totalVendas: vendas.length,
            totalClientes: totalClientesCount,
            totalProdutos: getSheet(wb, 'Cross').length,
            totalRepresentantes: totalRepsCount,
            valorTotalVendas: sumValues(vendas),
            valorTotalVendasAnoAnterior: sumValues(vendasAnterior),
            totalPecas: sumPecas(vendas),
            totalPecasAnoAnterior: sumPecas(vendasAnterior)
        };
    } catch (e: any) { reply.status(500).send({ error: e.message }); }
});

fastify.get('/api/vendas', async (request, reply) => {
    try {
        const wb = loadWorkbook();
        const mappings = getMappings(wb);
        const rows = filterData(getSheet(wb, 'Vendas'), request.query, mappings);
        return rows.map((row: any) => ({
            data: parseDate(getRowValue(row, 'Data', 'data')),
            cliente: getRowValue(row, 'Cliente', 'cliente') ?? '',
            codigo: getRowValue(row, 'Código (SKU)', 'PN', 'pn') ?? '',
            quantidade: parseFloat(getRowValue(row, 'Quantidade', 'quantidade')) || 0,
            valor: parseCurrency(getRowValue(row, 'Valor', 'valor'))
        }));
    } catch (e: any) { reply.status(500).send({ error: e.message }); }
});

fastify.get('/api/visitas', async (request, reply) => {
    try {
        const wb = loadWorkbook();
        const mappings = getMappings(wb);
        const rows = filterData(getSheet(wb, 'Visitas Tecnicas'), request.query, mappings);
        return rows.map((row: any) => ({
            data: parseDate(getRowValue(row, 'Data', 'data')),
            tipoVisita: getRowValue(row, 'Tipo de Visita', 'tipo de visita') ?? '',
            representante: getRowValue(row, 'Representante', 'representante', 'Vendedor', 'vendedor') ?? '',
            cliente: getRowValue(row, 'Cliente', 'cliente') ?? '',
            custo: parseCurrency(getRowValue(row, 'Custo da Visita (R$)', 'Custo da Visita', 'custo da visita (r$)', 'custo da visita'))
        }));
    } catch (e: any) { reply.status(500).send({ error: e.message }); }
});

fastify.get('/api/vendas/por-mes', async (request, reply) => {
    try {
        const wb = loadWorkbook();
        const mappings = getMappings(wb);
        const vendas = filterData(getSheet(wb, 'Vendas'), request.query, mappings);
        const map: Record<string, number> = {};
        vendas.forEach((row: any) => {
            const dateStr = parseDate(getRowValue(row, 'Data', 'data'));
            if (!dateStr) return;
            const mes = dateStr.substring(0, 7);
            map[mes] = (map[mes] || 0) + parseCurrency(getRowValue(row, 'Valor', 'valor'));
        });
        return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([mes, total]) => ({ mes, total }));
    } catch (e: any) { reply.status(500).send({ error: e.message }); }
});

fastify.get('/api/vendas/comparativo-anual', async (request, reply) => {
    try {
        const wb = loadWorkbook();
        const mappings = getMappings(wb);
        const rawVendas = getSheet(wb, 'Vendas');

        // Estrutura: { '2024': total, '2025': total ... }
        const map: Record<string, number> = {};

        rawVendas.forEach((row: any) => {
            const dateStr = parseDate(getRowValue(row, 'Data', 'data'));
            if (!dateStr) return;

            const [ano] = dateStr.split('-');
            const valor = parseCurrency(getRowValue(row, 'Valor', 'valor'));

            map[ano] = (map[ano] || 0) + valor;
        });

        // Converte para formato: [ { ano: '2024', total: val }, ... ]
        const result = Object.entries(map)
            .map(([ano, total]) => ({ ano, total }))
            .sort((a, b) => a.ano.localeCompare(b.ano));

        return result;
    } catch (e: any) { reply.status(500).send({ error: e.message }); }
});

fastify.get('/api/vendas/por-estado', async (request, reply) => {
    try {
        const wb = loadWorkbook();
        const mappings = getMappings(wb);
        const vendas = filterData(getSheet(wb, 'Vendas'), request.query, mappings);
        const map: Record<string, number> = {};
        vendas.forEach((row: any) => {
            const cliente = getRowValue(row, 'Cliente', 'cliente');
            const estado = mappings.clienteToEstado[cliente] || 'Desconhecido';
            map[estado] = (map[estado] || 0) + parseCurrency(getRowValue(row, 'Valor', 'valor'));
        });
        return Object.entries(map)
            .map(([estado, total]) => ({ estado, total }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 3);
    } catch (e: any) { reply.status(500).send({ error: e.message }); }
});

fastify.get('/api/vendas/ranking', async (request, reply) => {
    try {
        const wb = loadWorkbook();
        const mappings = getMappings(wb);
        const query: any = request.query;

        // Carrega vendas e metas
        const rawVendasReps = getSheet(wb, 'Vendas Representantes');
        const rawMetasReps = getSheet(wb, 'Metas Representantes');

        // Filtra as vendas (reaproveitando a lógica de filtros de data)
        const vendasFiltradas = filterData(rawVendasReps, query, mappings);

        // Agrupa faturamento por vendedor
        const faturamentoPorVendedor: Record<string, number> = {};
        vendasFiltradas.forEach(row => {
            const vendedor = getRowValue(row, 'Vendedor');
            const valor = parseCurrency(getRowValue(row, ' Valor do Pedido ', 'valor do pedido', 'Valor', 'valor'));
            if (vendedor) {
                const normName = normalizeName(vendedor);
                // Usamos o nome normalizado como chave, mas guardaremos o nome original depois
                faturamentoPorVendedor[normName] = (faturamentoPorVendedor[normName] || 0) + valor;
            }
        });

        // Determina o número de meses para o cálculo da meta
        const numMeses = query.mes ? 1 : 12;

        // Mapeia metas (normalizado) e aplica o multiplicador de meses
        const metasPorVendedor: Record<string, { originalName: string, meta: number }> = {};
        rawMetasReps.forEach(row => {
            const vendedor = getRowValue(row, 'Vendedor');
            const metaMensal = parseFloat(getRowValue(row, 'Meta')) || 0;
            if (vendedor) {
                metasPorVendedor[normalizeName(vendedor)] = {
                    originalName: vendedor,
                    meta: metaMensal * numMeses
                };
            }
        });

        // Consolida o ranking
        const ranking = Object.entries(faturamentoPorVendedor).map(([normName, faturamento]) => {
            const metaInfo = metasPorVendedor[normName];
            const meta = metaInfo?.meta || 0;
            const nome = metaInfo?.originalName || normName; // Tenta usar o nome da aba de metas se disponível

            return {
                nome,
                faturamento,
                media: faturamento / numMeses,
                meta,
                percentMeta: meta > 0 ? (faturamento / meta) * 100 : 0
            };
        });

        // Ordena por faturamento decrescente
        return ranking.sort((a, b) => b.faturamento - a.faturamento);
    } catch (e: any) { reply.status(500).send({ error: e.message }); }
});

fastify.get('/api/vendas/top-skus', async (request, reply) => {
    try {
        const wb = loadWorkbook();
        const mappings = getMappings(wb);
        const query: any = request.query;
        const vendas = filterData(getSheet(wb, 'Vendas'), query, mappings);

        const map: Record<string, number> = {};
        vendas.forEach((row: any) => {
            const sku = getRowValue(row, 'SKU', 'sku', 'Produto', 'produto');
            const qtd = parseFloat(getRowValue(row, 'Quantidade', 'quantidade', 'Qtd', 'qtd')) || 0;
            if (sku) {
                map[sku] = (map[sku] || 0) + qtd;
            }
        });

        return Object.entries(map)
            .map(([nome, quantidade]) => ({ nome, quantidade }))
            .sort((a, b) => b.quantidade - a.quantidade)
            .slice(0, 5);
    } catch (e: any) { reply.status(500).send({ error: e.message }); }
});

fastify.get('/api/clientes/top', async (request, reply) => {
    try {
        const wb = loadWorkbook();
        const mappings = getMappings(wb);
        const query: any = request.query;
        const vendas = filterData(getSheet(wb, 'Vendas'), query, mappings);

        const map: Record<string, { totalVendas: number, valorTotal: number, estado: string }> = {};
        vendas.forEach((row: any) => {
            const cliente = getRowValue(row, 'Cliente', 'cliente');
            if (cliente) {
                if (!map[cliente]) {
                    map[cliente] = {
                        totalVendas: 0,
                        valorTotal: 0,
                        estado: mappings.clienteToEstado[cliente] || 'Desconhecido'
                    };
                }
                map[cliente].totalVendas += 1;
                map[cliente].valorTotal += parseCurrency(getRowValue(row, 'Valor', 'valor'));
            }
        });

        return Object.entries(map)
            .map(([nome, data]) => ({ nome, ...data }))
            .sort((a, b) => b.valorTotal - a.valorTotal)
            .slice(0, 5);
    } catch (e: any) { reply.status(500).send({ error: e.message }); }
});

fastify.get('/api/clientes', async (request, reply) => {
    try {
        const wb = loadWorkbook();
        const clientesStr = getSheet(wb, 'Clientes');
        const rawVendas = getSheet(wb, 'Vendas');

        // Mapear a data da última compra por cliente
        const ultimaCompraMap: Record<string, string> = {};
        rawVendas.forEach((row: any) => {
            const cliente = getRowValue(row, 'Cliente', 'cliente');
            const dataRow = parseDate(getRowValue(row, 'Data', 'data'));
            if (cliente && dataRow) {
                const normCli = normalizeName(cliente);
                // Guarda a data mais recente
                if (!ultimaCompraMap[normCli] || dataRow > ultimaCompraMap[normCli]) {
                    ultimaCompraMap[normCli] = dataRow;
                }
            }
        });

        const today = new Date(); // Local time reference

        const _userRep = (request.query as any)._representante;
        const filteredClientesStr = _userRep
            ? clientesStr.filter((c: any) => String(getRowValue(c, 'Representante', 'representante') || '').trim() === _userRep)
            : clientesStr;
        const clientesEnriquecidos = filteredClientesStr.map((c: any) => {
            const nomeCli = getRowValue(c, 'Cliente', 'cliente', 'Razão Social') ?? '';
            const normCli = normalizeName(nomeCli);
            const ultimaCompra = ultimaCompraMap[normCli];
            let status = c.Status ?? '';

            if (ultimaCompra) {
                const ufDate = new Date(`${ultimaCompra}T12:00:00Z`); // Avoid timezone shift
                const diffTime = Math.abs(today.getTime() - ufDate.getTime());
                const diffMonths = diffTime / (1000 * 60 * 60 * 24 * 30.44); // ~months

                if (diffMonths > 4) {
                    status = 'Inativo';
                } else {
                    status = 'Ativo';
                }
            } else {
                status = 'Inativo'; // Se nunca comprou, inativo
            }

            return {
                ...c,
                Status: status,
                ultimaCompra: ultimaCompra || undefined
            };
        });

        return clientesEnriquecidos;
    } catch (e: any) { reply.status(500).send({ error: e.message }); }
});

fastify.get('/api/clientes/:nome/vendas-por-mes', async (request, reply) => {
    try {
        const wb = loadWorkbook();
        const { nome } = request.params as { nome: string };
        const normNome = normalizeName(decodeURIComponent(nome));
        const rawVendas = getSheet(wb, 'Vendas');
        const map: Record<string, number> = {};
        rawVendas.forEach((row: any) => {
            const cli = getRowValue(row, 'Cliente', 'cliente');
            if (!cli || normalizeName(cli) !== normNome) return;
            const dateStr = parseDate(getRowValue(row, 'Data', 'data'));
            if (!dateStr) return;
            const mes = dateStr.substring(0, 7);
            map[mes] = (map[mes] || 0) + parseCurrency(getRowValue(row, 'Valor', 'valor'));
        });
        return Object.entries(map)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([mes, total]) => ({ mes, total }));
    } catch (e: any) { reply.status(500).send({ error: e.message }); }
});

fastify.get('/api/clientes/:nome/itens-nao-comprados', async (request, reply) => {
    try {
        const wb = loadWorkbook();
        const { nome } = request.params as { nome: string };
        const normNome = normalizeName(decodeURIComponent(nome));
        const rawVendas = getSheet(wb, 'Vendas');
        const skusComprados = new Set<string>();
        rawVendas.forEach((row: any) => {
            const cli = getRowValue(row, 'Cliente', 'cliente');
            if (!cli || normalizeName(cli) !== normNome) return;
            const sku = getRowValue(row, 'Código (SKU)', 'Codigo', 'codigo', 'PN', 'pn');
            if (sku) skusComprados.add(String(sku).trim());
        });
        const rawCross = getSheet(wb, 'Cross');
        const naoComprados = rawCross
            .filter((row: any) => {
                const pn = getRowValue(row, 'PN', 'pn');
                return pn && !skusComprados.has(String(pn).trim());
            })
            .map((row: any) => {
                const pn = getRowValue(row, 'PN', 'pn');
                const descricao = String(getRowValue(row, 'Descrição', 'Descricao', 'descricao') ?? '').trim();
                const linhas: string[] = [];
                const refs: Record<string, string> = {};
                const addRef = (col: string, brand: string) => {
                    const v = getRowValue(row, col);
                    const s = v !== null && v !== undefined ? String(v).trim() : '';
                    if (s && s.toUpperCase() !== 'N/A') { linhas.push(brand); refs[brand] = s; }
                };
                addRef('Metal Leve', 'Metal Leve');
                addRef('Sulloy', 'Sulloy');
                addRef('KS', 'KS');
                addRef('Apex', 'Apex');
                return { pn: String(pn).trim(), descricao, linhas, refs };
            });
        return {
            totalItens: rawCross.length,
            totalComprados: rawCross.length - naoComprados.length,
            naoComprados
        };
    } catch (e: any) { reply.status(500).send({ error: e.message }); }
});

fastify.get('/api/representantes', async (request, reply) => {
    try {
        const wb = loadWorkbook();
        const rawReps = getSheet(wb, 'Metas Representantes');
        const _userRep = (request.query as any)._representante;
        return rawReps
            .filter((row: any) => {
                if (!_userRep) return true;
                return String(getRowValue(row, 'Vendedor', 'vendedor') || '').trim() === _userRep;
            })
            .map((row: any) => ({
                nome: getRowValue(row, 'Vendedor', 'vendedor') ?? '',
                meta: parseFloat(getRowValue(row, 'Meta', 'meta')) || 0,
                estado: getRowValue(row, 'Estado', 'estado') ?? '',
            })).filter((r: any) => r.nome);
    } catch (e: any) { reply.status(500).send({ error: e.message }); }
});

fastify.get('/api/representantes/:nome/vendas-por-mes', async (request, reply) => {
    try {
        const wb = loadWorkbook();
        const { nome } = request.params as { nome: string };
        const normNome = normalizeName(decodeURIComponent(nome));
        const rawVendasReps = getSheet(wb, 'Vendas Representantes');
        const map: Record<string, number> = {};
        rawVendasReps.forEach((row: any) => {
            const vendedor = getRowValue(row, 'Vendedor', 'vendedor');
            if (!vendedor || normalizeName(vendedor) !== normNome) return;
            const dateStr = parseDate(getRowValue(row, 'Data', 'data'));
            if (!dateStr) return;
            const mes = dateStr.substring(0, 7);
            map[mes] = (map[mes] || 0) + parseCurrency(getRowValue(row, ' Valor do Pedido ', 'Valor do Pedido', 'valor do pedido', 'Valor', 'valor'));
        });
        return Object.entries(map)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([mes, total]) => ({ mes, total }));
    } catch (e: any) { reply.status(500).send({ error: e.message }); }
});

fastify.get('/api/representantes/:nome/visitas-por-mes', async (request, reply) => {
    try {
        const wb = loadWorkbook();
        const { nome } = request.params as { nome: string };
        const normNome = normalizeName(decodeURIComponent(nome));
        const rawVisitas = getSheet(wb, 'Visitas Tecnicas');
        const map: Record<string, number> = {};
        rawVisitas.forEach((row: any) => {
            const rep = getRowValue(row, 'Representante', 'representante', 'Vendedor', 'vendedor');
            if (!rep || normalizeName(rep) !== normNome) return;
            const dateStr = parseDate(getRowValue(row, 'Data', 'data'));
            if (!dateStr) return;
            const mes = dateStr.substring(0, 7);
            map[mes] = (map[mes] || 0) + parseCurrency(getRowValue(row, 'Custo da Visita (R$)', 'Custo da Visita', 'custo da visita (r$)', 'custo da visita'));
        });
        return Object.entries(map)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([mes, custo]) => ({ mes, custo }));
    } catch (e: any) { reply.status(500).send({ error: e.message }); }
});

fastify.get('/api/representantes/:nome/clientes', async (request, reply) => {
    try {
        const wb = loadWorkbook();
        const { nome } = request.params as { nome: string };
        const normNome = normalizeName(decodeURIComponent(nome));
        const rawClientes = getSheet(wb, 'Clientes');
        const rawVendas = getSheet(wb, 'Vendas');
        const ultimaCompraMap: Record<string, string> = {};
        rawVendas.forEach((row: any) => {
            const cli = getRowValue(row, 'Cliente', 'cliente');
            const dateStr = parseDate(getRowValue(row, 'Data', 'data'));
            if (cli && dateStr) {
                const norm = normalizeName(cli);
                if (!ultimaCompraMap[norm] || dateStr > ultimaCompraMap[norm]) ultimaCompraMap[norm] = dateStr;
            }
        });
        const today = new Date();
        return rawClientes
            .filter((row: any) => {
                const rep = getRowValue(row, 'Representante', 'representante');
                return rep && normalizeName(rep) === normNome;
            })
            .map((row: any) => {
                const clienteNome = getRowValue(row, 'Cliente', 'cliente', 'Razão Social') ?? '';
                const ultimaCompra = ultimaCompraMap[normalizeName(clienteNome)] || null;
                let status = 'Inativo';
                if (ultimaCompra) {
                    const diffMonths = (today.getTime() - new Date(`${ultimaCompra}T12:00:00Z`).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
                    status = diffMonths <= 4 ? 'Ativo' : 'Inativo';
                }
                return { nome: clienteNome, ultimaCompra, status };
            });
    } catch (e: any) { reply.status(500).send({ error: e.message }); }
});

fastify.get('/api/representantes/:nome/comparativo-mes', async (request, reply) => {
    try {
        const wb = loadWorkbook();
        const { nome } = request.params as { nome: string };
        const query = request.query as { mes?: string };
        const normNome = normalizeName(decodeURIComponent(nome));
        const mesFiltro = (query.mes ?? '').padStart(2, '0');

        // Meta do representante
        const rawReps = getSheet(wb, 'Metas Representantes');
        let meta = 0;
        rawReps.forEach((row: any) => {
            const v = getRowValue(row, 'Vendedor', 'vendedor');
            if (v && normalizeName(v) === normNome) meta = parseFloat(getRowValue(row, 'Meta', 'meta')) || 0;
        });

        // Totais por ano — mesma fonte do gráfico de vendas (Vendas Representantes)
        const rawVendasReps = getSheet(wb, 'Vendas Representantes');
        const totaisMap: Record<string, number> = {};
        rawVendasReps.forEach((row: any) => {
            const vendedor = getRowValue(row, 'Vendedor', 'vendedor');
            if (!vendedor || normalizeName(vendedor) !== normNome) return;
            const dateStr = parseDate(getRowValue(row, 'Data', 'data'));
            if (!dateStr) return;
            if (mesFiltro && dateStr.substring(5, 7) !== mesFiltro) return;
            const ano = dateStr.substring(0, 4);
            totaisMap[ano] = (totaisMap[ano] || 0) + parseCurrency(getRowValue(row, ' Valor do Pedido ', 'Valor do Pedido', 'valor do pedido', 'Valor', 'valor'));
        });

        // Clientes do representante (para lista de quem comprou)
        const rawClientes = getSheet(wb, 'Clientes');
        const repClientesNorm = new Set<string>();
        rawClientes.forEach((row: any) => {
            const rep = getRowValue(row, 'Representante', 'representante');
            if (rep && normalizeName(rep) === normNome) {
                const c = getRowValue(row, 'Cliente', 'cliente', 'Razão Social');
                if (c) repClientesNorm.add(normalizeName(String(c)));
            }
        });

        // Clientes por ano — da aba Vendas (nome + valor comprado no período)
        const rawVendas = getSheet(wb, 'Vendas');
        const clientesMap: Record<string, Map<string, number>> = {};
        rawVendas.forEach((row: any) => {
            const cli = getRowValue(row, 'Cliente', 'cliente');
            if (!cli || !repClientesNorm.has(normalizeName(String(cli)))) return;
            const dateStr = parseDate(getRowValue(row, 'Data', 'data'));
            if (!dateStr) return;
            if (mesFiltro && dateStr.substring(5, 7) !== mesFiltro) return;
            const ano = dateStr.substring(0, 4);
            const valor = parseCurrency(getRowValue(row, 'Valor', 'valor'));
            const nomeCliente = String(cli).trim();
            if (!clientesMap[ano]) clientesMap[ano] = new Map();
            clientesMap[ano].set(nomeCliente, (clientesMap[ano].get(nomeCliente) ?? 0) + valor);
        });

        // Combina totais (Vendas Representantes) + clientes com valores (Vendas)
        const anos = new Set([...Object.keys(totaisMap), ...Object.keys(clientesMap)]);
        return Array.from(anos).sort().map(ano => {
            const clientesEntries = Array.from(clientesMap[ano]?.entries() ?? [])
                .map(([nome, total]) => ({ nome, total }))
                .sort((a, b) => b.total - a.total);
            return {
                ano,
                total: totaisMap[ano] ?? 0,
                meta,
                percentMeta: meta > 0 ? ((totaisMap[ano] ?? 0) / meta) * 100 : null,
                clientes: clientesEntries,
            };
        });
    } catch (e: any) { reply.status(500).send({ error: e.message }); }
});

fastify.get('/api/representantes/:nome/clientes-periodo', async (request, reply) => {
    try {
        const wb = loadWorkbook();
        const { nome } = request.params as { nome: string };
        const query = request.query as { mes?: string; ano?: string };
        const normNome = normalizeName(decodeURIComponent(nome));

        const rawClientes = getSheet(wb, 'Clientes');
        const repClientesNorm = new Set<string>();
        const clienteNomeMap: Record<string, string> = {};
        rawClientes.forEach((row: any) => {
            const rep = getRowValue(row, 'Representante', 'representante');
            if (rep && normalizeName(rep) === normNome) {
                const c = getRowValue(row, 'Cliente', 'cliente', 'Razão Social');
                if (c) {
                    const norm = normalizeName(String(c));
                    repClientesNorm.add(norm);
                    clienteNomeMap[norm] = String(c).trim();
                }
            }
        });

        // Fonte correta: Vendas Representantes (filtrada por Vendedor = este rep)
        const rawVendasReps = getSheet(wb, 'Vendas Representantes');
        const clientesAtivosNorm = new Set<string>();
        rawVendasReps.forEach((row: any) => {
            const vendedor = getRowValue(row, 'Vendedor', 'vendedor');
            if (!vendedor || normalizeName(vendedor) !== normNome) return;
            const dateStr = parseDate(getRowValue(row, 'Data', 'data'));
            if (!dateStr) return;
            if (query.mes && !dateStr.startsWith(query.mes)) return;
            if (!query.mes && query.ano && !dateStr.startsWith(query.ano)) return;
            const cli = getRowValue(row, 'Cliente', 'cliente');
            if (cli) clientesAtivosNorm.add(normalizeName(String(cli)));
        });

        // Tenta mapear para o nome exibido na aba Clientes; se não encontrar, retorna o nome da VendasReps
        const rawVendas = getSheet(wb, 'Vendas');
        const vendasNomeMap: Record<string, string> = {};
        rawVendas.forEach((row: any) => {
            const cli = getRowValue(row, 'Cliente', 'cliente');
            if (cli) vendasNomeMap[normalizeName(String(cli))] = String(cli).trim();
        });

        return Array.from(clientesAtivosNorm).map(norm =>
            clienteNomeMap[norm] ?? vendasNomeMap[norm] ?? null
        ).filter(Boolean);
    } catch (e: any) { reply.status(500).send({ error: e.message }); }
});

fastify.get('/api/representantes/:nome/visitas-por-cliente', async (request, reply) => {
    try {
        const wb = loadWorkbook();
        const { nome } = request.params as { nome: string };
        const normNome = normalizeName(decodeURIComponent(nome));
        const rawVisitas = getSheet(wb, 'Visitas Tecnicas');
        const map: Record<string, { custo: number; ultimaVisita: string }> = {};
        rawVisitas.forEach((row: any) => {
            const rep = getRowValue(row, 'Representante', 'representante', 'Vendedor', 'vendedor');
            if (!rep || normalizeName(rep) !== normNome) return;
            const cliente = String(getRowValue(row, 'Cliente', 'cliente') ?? '').trim();
            if (!cliente) return;
            const dateStr = parseDate(getRowValue(row, 'Data', 'data'));
            const custo = parseCurrency(getRowValue(row, 'Custo da Visita (R$)', 'Custo da Visita', 'custo da visita (r$)', 'custo da visita'));
            if (!map[cliente]) map[cliente] = { custo: 0, ultimaVisita: '' };
            map[cliente].custo += custo;
            if (dateStr && dateStr > map[cliente].ultimaVisita) map[cliente].ultimaVisita = dateStr;
        });
        return Object.entries(map)
            .map(([cliente, d]) => ({ cliente, custo: d.custo, mes: d.ultimaVisita ? d.ultimaVisita.substring(0, 7) : '' }))
            .sort((a, b) => b.custo - a.custo);
    } catch (e: any) { reply.status(500).send({ error: e.message }); }
});

// ── SPA Fallback (React Router) ───────────────────────────────────────────────
// Rotas não-API retornam index.html para o React Router funcionar
fastify.setNotFoundHandler((request, reply) => {
    if (!request.url.startsWith('/api/')) {
        const indexPath = path.join(frontendDist, 'index.html');
        if (fs.existsSync(indexPath)) {
            return reply.type('text/html').send(fs.readFileSync(indexPath));
        }
    }
    reply.status(404).send({ error: 'Not found' });
});

// Iniciando
const start = async () => {
    try {
        // Inicializa usuários (cria admin se necessário)
        await initUsers();
        // Pré-carrega o Excel em cache antes de abrir o servidor
        try {
            loadWorkbook();
            console.log('[CRM] Planilha carregada em cache');
        } catch (e: any) {
            console.warn('[CRM] Aviso: não foi possível pré-carregar planilha:', e.message);
        }
        await fastify.listen({ port: 3000, host: '0.0.0.0' });
        console.log('Servidor rodando em http://localhost:3000');
    } catch (err) {
        console.error('[ERRO] Falha ao iniciar servidor:', err);
        process.exit(1);
    }
};
start();
