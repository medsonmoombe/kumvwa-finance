-- C1 was applied before the console-specific OTP purpose was introduced.
-- PostgreSQL supports safely adding an enum value without rewriting rows.
ALTER TYPE "OtpPurpose" ADD VALUE IF NOT EXISTS 'console_2fa';
