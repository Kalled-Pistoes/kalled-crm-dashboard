import { useState, useRef } from 'react';
import { Upload, Database, CheckCircle, AlertCircle, RefreshCw, FileSpreadsheet } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface SyncResult {
    success: boolean;
    counts: {
        representantes: number;
        clientes: number;
        produtos: number;
        vendas: number;
        vendas_representantes: number;
        visitas: number;
        catalogo: number;
    };
}

function FileInput({ label, hint, file, onSelect }: { label: string; hint: string; file: File | null; onSelect: (f: File) => void }) {
    const ref = useRef<HTMLInputElement>(null);
    return (
        <div
            onClick={() => ref.current?.click()}
            className={`relative border-2 border-dashed rounded-xl p-5 cursor-pointer transition-all
                ${file ? 'border-sky-500/60 bg-sky-500/5' : 'border-white/10 bg-white/3 hover:border-white/20 hover:bg-white/5'}`}
        >
            <input ref={ref} type="file" accept=".xlsx,.xls" className="hidden"
                onChange={e => { if (e.target.files?.[0]) onSelect(e.target.files[0]); }} />
            <div className="flex items-center gap-3">
                <FileSpreadsheet className={`w-8 h-8 flex-shrink-0 ${file ? 'text-sky-400' : 'text-slate-500'}`} />
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{label}</p>
                    <p className="text-xs text-slate-400 truncate">{file ? file.name : hint}</p>
                    {file && <p className="text-[10px] text-sky-400 mt-0.5">{(file.size / 1024 / 1024).toFixed(2)} MB • clique para trocar</p>}
                </div>
                {!file && <Upload className="w-4 h-4 text-slate-500 ml-auto flex-shrink-0" />}
                {file && <CheckCircle className="w-4 h-4 text-sky-400 ml-auto flex-shrink-0" />}
            </div>
        </div>
    );
}

function CountRow({ label, value }: { label: string; value: number }) {
    return (
        <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
            <span className="text-sm text-slate-400">{label}</span>
            <span className="text-sm font-semibold text-white tabular-nums">{value.toLocaleString('pt-BR')}</span>
        </div>
    );
}

export default function SyncPage() {
    const [vendasFile, setVendasFile] = useState<File | null>(null);
    const [catalogoFile, setCatalogoFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<SyncResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const toBase64 = (file: File): Promise<string> =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

    const handleSync = async () => {
        if (!vendasFile) { setError('Selecione o arquivo "Base de Dados de Vendas.xlsx"'); return; }
        setLoading(true);
        setError(null);
        setResult(null);
        try {
            const vendas = await toBase64(vendasFile);
            const catalogo = catalogoFile ? await toBase64(catalogoFile) : undefined;
            const token = localStorage.getItem('crm_token');
            const res = await fetch(`${API_BASE}/api/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ vendas, catalogo }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
            setResult(data);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-xl mx-auto py-4">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                    <Database className="w-5 h-5 text-sky-400" />
                </div>
                <div>
                    <h1 className="text-lg font-bold text-white">Atualizar Base de Dados</h1>
                    <p className="text-xs text-slate-400">Envie os arquivos Excel para sincronizar com o Supabase</p>
                </div>
            </div>

            {/* File Inputs */}
            <div className="space-y-3 mb-5">
                <FileInput
                    label="Base de Dados de Vendas"
                    hint="Base de Dados de Vendas.xlsx (obrigatório)"
                    file={vendasFile}
                    onSelect={setVendasFile}
                />
                <FileInput
                    label="Catálogo de Produtos"
                    hint="Catalogo_Kalled.xlsx (opcional)"
                    file={catalogoFile}
                    onSelect={setCatalogoFile}
                />
            </div>

            {/* Sync Button */}
            <button
                onClick={handleSync}
                disabled={loading || !vendasFile}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2
                    bg-sky-500 hover:bg-sky-400 disabled:bg-white/5 disabled:text-slate-500 disabled:cursor-not-allowed text-white"
            >
                {loading
                    ? <><RefreshCw className="w-4 h-4 animate-spin" /> Sincronizando...</>
                    : <><Upload className="w-4 h-4" /> Sincronizar Agora</>
                }
            </button>

            {/* Error */}
            {error && (
                <div className="mt-4 flex items-start gap-2 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-300">{error}</p>
                </div>
            )}

            {/* Success */}
            {result?.success && (
                <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                    <div className="flex items-center gap-2 mb-3">
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        <p className="text-sm font-semibold text-emerald-300">Sincronização concluída com sucesso!</p>
                    </div>
                    <div className="bg-white/3 rounded-lg p-3">
                        <CountRow label="Representantes" value={result.counts.representantes} />
                        <CountRow label="Clientes" value={result.counts.clientes} />
                        <CountRow label="Produtos (Cross)" value={result.counts.produtos} />
                        <CountRow label="Vendas" value={result.counts.vendas} />
                        <CountRow label="Vendas por Representante" value={result.counts.vendas_representantes} />
                        <CountRow label="Visitas Técnicas" value={result.counts.visitas} />
                        {result.counts.catalogo > 0 && <CountRow label="Catálogo de Produtos" value={result.counts.catalogo} />}
                    </div>
                </div>
            )}
        </div>
    );
}
