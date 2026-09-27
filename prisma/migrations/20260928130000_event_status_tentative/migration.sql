-- Status „vorgemerkt“ (Terminplanung Phase 6). Eigene Migration, weil ein neuer Enum-Wert
-- nicht in derselben Transaktion benutzt werden darf.
ALTER TYPE "EventStatus" ADD VALUE 'TENTATIVE' BEFORE 'SCHEDULED';
