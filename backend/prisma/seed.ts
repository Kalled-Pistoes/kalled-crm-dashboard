import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

const prisma = new PrismaClient();

// Helper to parse currency string "R$ 1.000,00" -> 1000.00
function parseCurrency(value: any): number {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    const str = String(value).replace('R$', '').trim().replace(/\./g, '').replace(',', '.');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
}

// Helper to parse Excel serial date or string date
function parseDate(value: any): Date {
    if (!value) return new Date();
    if (typeof value === 'number') {
        // Excel serial date
        return new Date(Math.round((value - 25569) * 86400 * 1000));
    }
    // Try parsing string
    const d = new Date(value);
    return isNaN(d.getTime()) ? new Date() : d;
}

async function main() {
    const filePath = path.resolve(__dirname, '../../Base de Dados de Vendas.xlsx');

    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }

    console.log(`Reading Excel file from: ${filePath}`);
    const workbook = XLSX.readFile(filePath);

    // 1. Import Representantes ("Metas Representantes")
    const repSheet = workbook.Sheets['Metas Representantes'];
    if (repSheet) {
        const data = XLSX.utils.sheet_to_json(repSheet);
        console.log(`Importing ${data.length} Representantes...`);

        for (const row of data) {
            if (!row['Vendedor']) continue;

            await prisma.representante.upsert({
                where: { nome: String(row['Vendedor']) },
                update: {
                    estado: row['Estado'],
                    meta: parseCurrency(row['Meta'])
                },
                create: {
                    nome: String(row['Vendedor']),
                    estado: row['Estado'],
                    meta: parseCurrency(row['Meta'])
                }
            });
        }
    }
}

// Fetch all existing representatives for validation
const existingReps = await prisma.representante.findMany({ select: { nome: true } });
const validRepNames = new Set(existingReps.map(r => r.nome));

// 2. Import Clientes ("Clientes")
const clientSheet = workbook.Sheets['Clientes'];
if (clientSheet) {
    const data = XLSX.utils.sheet_to_json(clientSheet);
    console.log(`Importing ${data.length} Clientes...`);

    for (const row of data) {
        const nome = row['Cliente'] || row['Razão Social'];
        if (!nome) continue;

        // Ensure representative exists or connect fails? 
        // Upsert is safer to ignore missing reps but we should verify.
        // For now, let's just try to connect if rep exists in row.

        await prisma.cliente.upsert({
            where: { nome: String(nome) },
            update: {
                semCNPJ: row['Clientes sem CNPJ'], // Adjust type if boolean in excel
                desconto: String(row['Desconto']),
                pagamento: row['Pagamento'],
                prazo: row['Prazo'],
                status: row['Status'],
                prazo: row['Prazo'],
                status: row['Status'],
                representanteNome: (row['Representante'] && validRepNames.has(String(row['Representante']))) ? String(row['Representante']) : null
            },
            create: {
                nome: String(nome),
                semCNPJ: row['Clientes sem CNPJ'],
                desconto: String(row['Desconto']),
                pagamento: row['Pagamento'],
                prazo: row['Prazo'],
                status: row['Status'],
                prazo: row['Prazo'],
                status: row['Status'],
                representanteNome: (row['Representante'] && validRepNames.has(String(row['Representante']))) ? String(row['Representante']) : null
            }
        });
    }
}

// 3. Import Produtos ("Cross")
const prodSheet = workbook.Sheets['Cross'];
if (prodSheet) {
    const data = XLSX.utils.sheet_to_json(prodSheet);
    console.log(`Importing ${data.length} Produtos...`);

    for (const row of data) {
        if (!row['PN']) continue;

        await prisma.produto.upsert({
            where: { sku: String(row['PN']) },
            update: {
                descricao: row['Descrição'],
                metalLeve: row['Metal Leve'],
                ks: row['KS'],
                rioSulense: row['Rio Sulense']
            },
            create: {
                sku: String(row['PN']),
                descricao: row['Descrição'],
                metalLeve: row['Metal Leve'],
                ks: row['KS'],
                rioSulense: row['Rio Sulense']
            }
        });
    }
}

// 4. Import Vendas ("Vendas")
const salesSheet = workbook.Sheets['Vendas'];
if (salesSheet) {
    const data = XLSX.utils.sheet_to_json(salesSheet);
    console.log(`Importing ${data.length} Vendas...`);

    // Using createMany might be faster but need to ensure foreign keys exist
    // Or just loop and create, catching errors if needed.
    // For simplicity and safety, loop.

    // We should probably wipe table first or use create? 
    // Since Vendas has auto-inc ID, we can't easily upsert unless we have an external ID.
    // Let's delete all and re-import to avoid duplicates on re-seed?
    // Or just create and assume empty db for now.

    // To be safe, let's check if we can match by all fields? Too slow.
    // Let's just create.
    await prisma.venda.deleteMany({}); // CLEAR EXISTING DATA FOR IDEMPOTENCY

    for (const row of data) {
        if (!row['Cliente'] || !row['Código']) continue; // Skip invalid

        try {
            await prisma.venda.create({
                data: {
                    data: parseDate(row['Data']),
                    clienteNome: String(row['Cliente']),
                    produtoSku: String(row['Código']),
                    quantidade: parseFloat(row['Quantidade']) || 0,
                    valor: parseCurrency(row['Valor'])
                }
            });
        } catch (e) {
            console.warn(`Error importing sales row: ${JSON.stringify(row)} - ${e.message}`);
        }
    }
}

// 5. Import Visitas ("Visitas Tecnicas")
const visitSheet = workbook.Sheets['Visitas Tecnicas'];
if (visitSheet) {
    const data = XLSX.utils.sheet_to_json(visitSheet);
    console.log(`Importing ${data.length} Visitas...`);

    await prisma.visita.deleteMany({}); // Clear existing

    for (const row of data) {
        // "Data", "Tipo de Visita", "Representante", "Cliente", "Custo da Visita"
        if (!row['Representante']) continue;

        try {
            await prisma.visita.create({
                data: {
                    data: parseDate(row['Data']),
                    tipoVisita: row['Tipo de Visita'],
                    representanteNome: String(row['Representante']),
                    clienteNome: row['Cliente'] ? String(row['Cliente']) : null,
                    custo: parseCurrency(row['Custo da Visita'])
                }
            });
        } catch (e) {
            console.warn(`Error importing visit row: ${JSON.stringify(row)} - ${e.message}`);
        }
    }
}
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
