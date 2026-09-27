-- CreateEnum
CREATE TYPE "EducationLevel" AS ENUM ('primary', 'junior_secondary', 'senior_secondary', 'certificate', 'diploma', 'degree', 'postgraduate', 'none');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "educationLevel" "EducationLevel";

-- AlterTable
ALTER TABLE "Role" ALTER COLUMN "permissions" DROP DEFAULT;
