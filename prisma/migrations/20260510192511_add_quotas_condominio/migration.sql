-- AlterTable
ALTER TABLE "condominio" ADD COLUMN     "max_moradores" INTEGER DEFAULT 600,
ADD COLUMN     "max_pacotes_30d" INTEGER DEFAULT 2000,
ADD COLUMN     "max_unidades" INTEGER DEFAULT 200;
