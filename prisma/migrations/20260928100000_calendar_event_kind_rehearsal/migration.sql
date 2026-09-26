-- Eigene Migration: ein neuer Enum-Wert darf in Postgres nicht in derselben Transaktion benutzt werden.
ALTER TYPE "CalendarEventKind" ADD VALUE 'REHEARSAL';
