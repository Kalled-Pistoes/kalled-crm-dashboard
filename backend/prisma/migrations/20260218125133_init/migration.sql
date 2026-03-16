-- CreateTable
CREATE TABLE "vendas" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "data" DATETIME NOT NULL,
    "clienteNome" TEXT NOT NULL,
    "produtoSku" TEXT NOT NULL,
    "quantidade" REAL NOT NULL,
    "valor" REAL NOT NULL,
    CONSTRAINT "vendas_clienteNome_fkey" FOREIGN KEY ("clienteNome") REFERENCES "clientes" ("nome") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "vendas_produtoSku_fkey" FOREIGN KEY ("produtoSku") REFERENCES "produtos" ("sku") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "clientes" (
    "nome" TEXT NOT NULL PRIMARY KEY,
    "semCNPJ" TEXT,
    "desconto" TEXT,
    "pagamento" TEXT,
    "prazo" TEXT,
    "representanteNome" TEXT,
    "status" TEXT,
    CONSTRAINT "clientes_representanteNome_fkey" FOREIGN KEY ("representanteNome") REFERENCES "representantes" ("nome") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "produtos" (
    "sku" TEXT NOT NULL PRIMARY KEY,
    "descricao" TEXT,
    "metalLeve" TEXT,
    "ks" TEXT,
    "rioSulense" TEXT
);

-- CreateTable
CREATE TABLE "representantes" (
    "nome" TEXT NOT NULL PRIMARY KEY,
    "estado" TEXT,
    "meta" REAL
);

-- CreateTable
CREATE TABLE "visitas_tecnicas" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "data" DATETIME NOT NULL,
    "tipoVisita" TEXT,
    "representanteNome" TEXT NOT NULL,
    "clienteNome" TEXT,
    "custo" REAL,
    CONSTRAINT "visitas_tecnicas_representanteNome_fkey" FOREIGN KEY ("representanteNome") REFERENCES "representantes" ("nome") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "visitas_tecnicas_clienteNome_fkey" FOREIGN KEY ("clienteNome") REFERENCES "clientes" ("nome") ON DELETE SET NULL ON UPDATE CASCADE
);
