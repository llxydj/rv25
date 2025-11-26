-- Add documentation for logo file path
COMMENT ON SCHEMA public IS 'Public schema for RVOIS application. Logo file located at public/assets/radiant-logo.png for PDF reports.';

-- Add comment to reports table for PDF generation
COMMENT ON TABLE public.reports IS 'Incident reports with PDF generation support. Logo file located at public/assets/radiant-logo.png.';