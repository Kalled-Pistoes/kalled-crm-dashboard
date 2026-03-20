/**
 * run_sync.js — Lançador da sincronização Excel -> Supabase
 * Executado via: node run_sync.js
 */
const { spawn } = require('child_process');
const path = require('path');

const projectDir = path.dirname(require.main.filename);
const backendDir = path.join(projectDir, 'backend');

console.log('');
console.log('  ============================================');
console.log('   Sincronizacao Excel -> Supabase');
console.log('   CRM Kalled Pistoes');
console.log('  ============================================');
console.log('');
console.log('  Diretorio: ' + projectDir);
console.log('');

const child = spawn(
  'node',
  ['--loader', 'ts-node/esm', '--no-warnings', 'scripts/sync_supabase.ts'],
  { cwd: backendDir, stdio: 'inherit', shell: false }
);

child.on('error', (err) => {
  console.error('\n[ERRO] Falha ao iniciar node:', err.message);
});

child.on('close', (code) => {
  console.log('');
  if (code === 0) {
    console.log('  ============================================');
    console.log('   [SUCESSO] Supabase atualizado com sucesso!');
    console.log('  ============================================');
  } else {
    console.log('  ============================================');
    console.log('  [ERRO] Sincronizacao falhou (codigo: ' + code + ')');
    console.log('  Verifique backend\\.env e a conexao com internet.');
    console.log('  ============================================');
  }
  console.log('');
  console.log('  Pressione qualquer tecla para fechar...');
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once('data', () => process.exit(code ?? 1));
  }
});
