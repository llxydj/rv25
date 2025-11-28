-- Create tables for PDF report scheduling and history

-- Scheduled PDF Reports table
CREATE TABLE IF NOT EXISTS scheduled_pdf_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  title TEXT NOT NULL,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('daily', 'weekly', 'monthly', 'custom')),
  schedule_config JSONB NOT NULL, -- { day_of_week, day_of_month, time, etc. }
  filters JSONB NOT NULL, -- Same filters as PDFReportGenerator
  recipients TEXT[] DEFAULT ARRAY[]::TEXT[], -- Email addresses
  enabled BOOLEAN DEFAULT true,
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PDF Report History table
CREATE TABLE IF NOT EXISTS pdf_report_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scheduled_report_id UUID REFERENCES scheduled_pdf_reports(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL, -- URL to stored PDF file
  file_size BIGINT, -- Size in bytes
  filters JSONB NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE, -- Optional expiration date
  download_count INTEGER DEFAULT 0
);

-- Indexes for performance
CREATE INDEX idx_scheduled_pdf_reports_created_by ON scheduled_pdf_reports(created_by);
CREATE INDEX idx_scheduled_pdf_reports_enabled ON scheduled_pdf_reports(enabled);
CREATE INDEX idx_scheduled_pdf_reports_next_run ON scheduled_pdf_reports(next_run_at) WHERE enabled = true;
CREATE INDEX idx_pdf_report_history_created_by ON pdf_report_history(created_by);
CREATE INDEX idx_pdf_report_history_generated_at ON pdf_report_history(generated_at DESC);
CREATE INDEX idx_pdf_report_history_report_type ON pdf_report_history(report_type);

-- Enable RLS
ALTER TABLE scheduled_pdf_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdf_report_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for scheduled_pdf_reports
CREATE POLICY "Users can view their own scheduled reports"
  ON scheduled_pdf_reports FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can create their own scheduled reports"
  ON scheduled_pdf_reports FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own scheduled reports"
  ON scheduled_pdf_reports FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own scheduled reports"
  ON scheduled_pdf_reports FOR DELETE
  USING (auth.uid() = created_by);

-- RLS Policies for pdf_report_history
CREATE POLICY "Users can view their own report history"
  ON pdf_report_history FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can create their own report history"
  ON pdf_report_history FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Admin can view all reports
CREATE POLICY "Admins can view all scheduled reports"
  ON scheduled_pdf_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can view all report history"
  ON pdf_report_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

