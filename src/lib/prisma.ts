import { PrismaClient } from "@prisma/client";
import { getPrismaDatasourceUrl } from "./prisma-datasource";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

// O build de producao do Next avalia este modulo em grafos distintos (camada
// RSC e camada SSR) dentro do mesmo processo. Registrar a instancia em
// globalThis em TODOS os ambientes garante um unico PrismaClient — e um unico
// pool de conexoes — por processo. Sem isso, cada camada abre seu proprio pool
// e, somadas, estouram o max_connections do banco (erro P2037) e esgotam o
// pool entre si (erro P2024).
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(process.env.DATABASE_URL
      ? { datasourceUrl: getPrismaDatasourceUrl(process.env.DATABASE_URL) }
      : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

globalForPrisma.prisma = prisma;
