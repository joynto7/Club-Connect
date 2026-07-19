-- AlterTable: Payment.stripePaymentId -> Payment.transactionId (gateway switch: Stripe -> SSLCommerz)
ALTER TABLE "Payment" RENAME COLUMN "stripePaymentId" TO "transactionId";
ALTER INDEX "Payment_stripePaymentId_key" RENAME TO "Payment_transactionId_key";
ALTER TABLE "Payment" ADD COLUMN "validationId" TEXT;
ALTER TABLE "Payment" ALTER COLUMN "currency" SET DEFAULT 'BDT';
