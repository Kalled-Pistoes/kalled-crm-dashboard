/**
 * Script de upload de imagens dos produtos para o Supabase Storage
 * 
 * Como usar:
 * 1. Vá em https://supabase.com/dashboard/project/fiuqspnmpuvtlhoklfqp/settings/api
 * 2. Copie a "service_role" key (em "Project API Keys")
 * 3. Cole abaixo em SUPABASE_SERVICE_KEY
 * 4. Rode: node scripts/upload-imagens-supabase.mjs
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ──────────────────────────────────────────────
// CONFIGURAÇÃO — cole a service_role key aqui
// ──────────────────────────────────────────────
const SUPABASE_URL = 'https://fiuqspnmpuvtlhoklfqp.supabase.co';
const SUPABASE_SERVICE_KEY = 'COLE_AQUI_SUA_SERVICE_ROLE_KEY'; // ← edite isso
const BUCKET = 'produtos-imagens';
const IMAGENS_DIR = path.join(__dirname, '..', 'frontend', 'public', 'Imagens');

// ──────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function uploadImagens() {
    if (SUPABASE_SERVICE_KEY === 'COLE_AQUI_SUA_SERVICE_ROLE_KEY') {
        console.error('❌ Erro: substitua COLE_AQUI_SUA_SERVICE_ROLE_KEY pela chave real!');
        console.error('   Vá em: https://supabase.com/dashboard/project/fiuqspnmpuvtlhoklfqp/settings/api');
        process.exit(1);
    }

    if (!fs.existsSync(IMAGENS_DIR)) {
        console.error(`❌ Pasta não encontrada: ${IMAGENS_DIR}`);
        process.exit(1);
    }

    const arquivos = fs.readdirSync(IMAGENS_DIR).filter(f => 
        ['.png', '.jpg', '.jpeg', '.webp'].includes(path.extname(f).toLowerCase())
    );

    if (arquivos.length === 0) {
        console.log('⚠️  Nenhuma imagem encontrada em:', IMAGENS_DIR);
        return;
    }

    console.log(`📂 Encontradas ${arquivos.length} imagem(ns) para upload...\n`);

    let sucesso = 0;
    let erros = 0;

    for (const arquivo of arquivos) {
        const filePath = path.join(IMAGENS_DIR, arquivo);
        const fileBuffer = fs.readFileSync(filePath);
        const ext = path.extname(arquivo).toLowerCase();
        const mimeTypes = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
        const contentType = mimeTypes[ext] || 'image/png';

        const { error } = await supabase.storage
            .from(BUCKET)
            .upload(arquivo, fileBuffer, {
                contentType,
                upsert: true  // substitui se já existir
            });

        if (error) {
            console.error(`  ❌ Erro ao enviar "${arquivo}":`, error.message);
            erros++;
        } else {
            const { data } = supabase.storage.from(BUCKET).getPublicUrl(arquivo);
            console.log(`  ✅ "${arquivo}" → ${data.publicUrl}`);
            sucesso++;
        }
    }

    console.log(`\n📊 Resultado: ${sucesso} enviada(s) com sucesso, ${erros} erro(s).`);
    
    if (sucesso > 0) {
        console.log('\n🔗 URL base para usar no frontend:');
        console.log(`   https://fiuqspnmpuvtlhoklfqp.supabase.co/storage/v1/object/public/${BUCKET}/{cod}.png`);
    }
}

uploadImagens().catch(console.error);
