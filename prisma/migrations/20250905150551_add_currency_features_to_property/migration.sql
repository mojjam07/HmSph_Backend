-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'NGN',
ADD COLUMN     "features" TEXT[];
