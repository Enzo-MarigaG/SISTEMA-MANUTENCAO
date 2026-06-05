-- AlterTable
ALTER TABLE "ServiceOrder" ADD COLUMN     "signatureCustomer" TEXT,
ADD COLUMN     "signatureTechnician" TEXT,
ADD COLUMN     "signedAt" TIMESTAMP(3);
